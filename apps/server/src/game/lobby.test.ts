import { describe, expect, test } from "bun:test";
import { gameEngine, type TeamView } from "@etic/engine";
import { TRPCError } from "@trpc/server";
import { silentLogger } from "../test-helpers.ts";
import { createAppRouter } from "../trpc/router.ts";
import { createCallerFactory, type SessionUser } from "../trpc/trpc.ts";
import { generateJoinCode, normalizeJoinCode } from "./join-code.ts";
import { GameManager } from "./manager.ts";
import { createMemoryPersistence } from "./persistence.ts";
import { RateLimiter } from "./rate-limit.ts";
import type { StreamMessage } from "./runtime.ts";

const boss: SessionUser = { id: "org", name: "Org", email: "o@x", role: "organizer" };
const user = (id: string): SessionUser => ({ id, name: id, email: `${id}@x`, role: "participant" });

function setup() {
  const manager = new GameManager({
    engine: gameEngine,
    persistence: createMemoryPersistence().persistence,
    logger: silentLogger,
    saveDebounceMs: 0,
  });
  const call = createCallerFactory(createAppRouter({ manager, limiter: new RateLimiter() }));
  return { manager, call };
}

async function code(promise: Promise<unknown>) {
  try {
    await promise;
    return "OK";
  } catch (error) {
    return error instanceof TRPCError ? error.code : String(error);
  }
}

async function createGame(call: ReturnType<typeof setup>["call"], memberCap?: number) {
  const { gameId } = await call({ user: boss }).admin.createGame({
    name: "Journée ETIC",
    teamNames: ["Équipe 1", "Équipe 2", "Équipe 3", "Équipe 4"],
    ...(memberCap ? { memberCap } : {}),
  });
  const detail = await call({ user: boss }).admin.game({ gameId });
  return { gameId, detail };
}

describe("join codes", () => {
  test("codes look like WORD-NN and avoid taken ones", () => {
    const taken = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const generated = generateJoinCode(taken);
      expect(generated).toMatch(/^[A-Z]+-\d{2}$/);
      expect(taken.has(generated)).toBe(false);
      taken.add(generated);
    }
  });

  test("codes are normalized for comparison", () => {
    expect(normalizeJoinCode(" lynx-42 ")).toBe("LYNX-42");
  });
});

describe("lobby routes", () => {
  test("the organizer creates a game with one unique code per team", async () => {
    const { call } = setup();
    const { detail } = await createGame(call);
    expect(detail.teams).toHaveLength(4);
    expect(new Set(detail.teams.map((t) => t.joinCode)).size).toBe(4);
    expect(detail.memberCap).toBe(4);
    expect(detail.status).toBe("lobby");
  });

  test("only the organizer can create games", async () => {
    const { call } = setup();
    expect(
      await code(call({ user: user("a") }).admin.createGame({ name: "x", teamNames: ["1", "2"] })),
    ).toBe("FORBIDDEN");
  });

  test("a player joins with a code typed in lowercase and sees the game as current", async () => {
    const { call } = setup();
    const { gameId, detail } = await createGame(call);
    const joinCode = detail.teams[1]?.joinCode.toLowerCase() ?? "";
    const result = await call({ user: user("a") }).game.join({ code: ` ${joinCode} ` });
    expect(result).toEqual({ ok: true, gameId, teamId: "t2" });
    expect(await call({ user: user("a") }).game.current()).toEqual([
      { gameId, name: "Journée ETIC", teamId: "t2", status: "lobby", msPerDay: 60_000 },
    ]);
  });

  test("an invalid code is rejected with « Code invalide »", async () => {
    const { call } = setup();
    await createGame(call);
    expect(await code(call({ user: user("a") }).game.join({ code: "NOPE-00" }))).toBe("NOT_FOUND");
  });

  test("a full team refuses the code", async () => {
    const { call } = setup();
    const { detail } = await createGame(call, 1);
    const joinCode = detail.teams[0]?.joinCode ?? "";
    await call({ user: user("a") }).game.join({ code: joinCode });
    expect(await call({ user: user("b") }).game.join({ code: joinCode })).toEqual({
      ok: false,
      refusal: { code: "TEAM_FULL", message: "Équipe complète." },
    });
  });

  test("full lobby flow: setup by teams, start refused until ready, then started", async () => {
    const { call, manager } = setup();
    const { gameId, detail } = await createGame(call);
    const regions = ["azura", "nordhaven", "ferronia", "port-libre"] as const;
    const notReady = await call({ user: boss }).admin.control({ gameId, action: "start" });
    expect(notReady).toMatchObject({ ok: false, refusal: { code: "NOT_READY" } });
    for (const [index, team] of detail.teams.entries()) {
      const player = call({ user: user(`p${index}`) });
      await player.game.join({ code: team.joinCode });
      await player.game.command({
        gameId,
        command: { type: "lobby.setCompanyName", payload: { companyName: `Boîte ${index}` } },
      });
      await player.game.command({
        gameId,
        command: { type: "lobby.chooseRegion", payload: { region: regions[index] } },
      });
    }
    expect(await call({ user: boss }).admin.control({ gameId, action: "start" })).toEqual({
      ok: true,
    });
    const state = manager.get(gameId)?.snapshot;
    expect(state?.status).toBe("running");
    expect(Object.values(state?.teams ?? {}).every((t) => t.cash === 50_000)).toBe(true);
  });

  test("a moved player's stream ends, so the old team's data stops flowing", async () => {
    const { call, manager } = setup();
    const { gameId, detail } = await createGame(call);
    await call({ user: user("a") }).game.join({ code: detail.teams[0]?.joinCode ?? "" });
    const runtime = manager.get(gameId);
    if (!runtime) throw new Error("no runtime");
    const stream = runtime.streamTeam("t1", "a");
    expect((await stream.next()).value?.kind).toBe("full");
    await call({ user: boss }).admin.moveMember({ gameId, userId: "a", toTeamId: "t2" });
    const next = await stream.next();
    expect(next.done).toBe(true);
    // The new team's stream works.
    const fresh = (await call({ user: user("a") }).game.stream({ gameId })) as AsyncIterable<
      StreamMessage<TeamView>
    >;
    const first = await fresh[Symbol.asyncIterator]().next();
    expect(first.value?.kind === "full" ? first.value.view.team.id : null).toBe("t2");
  });
});

describe("organizer end-of-game routes", () => {
  test("live ranking is organizer-only; the reveal is driven by admin.control", async () => {
    const { call, manager } = setup();
    const { gameId, detail } = await createGame(call);
    const regions = ["azura", "nordhaven", "ferronia", "port-libre"] as const;
    for (const [index, team] of detail.teams.entries()) {
      const player = call({ user: user(`p${index}`) });
      await player.game.join({ code: team.joinCode });
      await player.game.command({
        gameId,
        command: { type: "lobby.setCompanyName", payload: { companyName: `Boîte ${index}` } },
      });
      await player.game.command({
        gameId,
        command: { type: "lobby.chooseRegion", payload: { region: regions[index] } },
      });
    }
    await call({ user: boss }).admin.control({ gameId, action: "start" });
    expect(await code(call({ user: user("p0") }).admin.ranking({ gameId }))).toBe("FORBIDDEN");
    expect(await call({ user: boss }).admin.ranking({ gameId })).toHaveLength(4);
    await call({ user: boss }).admin.control({ gameId, action: "end" });
    expect(await call({ user: boss }).admin.control({ gameId, action: "revealNext" })).toEqual({
      ok: true,
    });
    expect(manager.get(gameId)?.snapshot.results?.revealedCount).toBe(1);
  });
});

describe("games for the screens", () => {
  test("a finished game stays current, so players can see the results", async () => {
    const { call } = setup();
    const { gameId, detail } = await createGame(call);
    await call({ user: user("a") }).game.join({ code: detail.teams[0]?.joinCode ?? "" });
    await call({ user: boss }).admin.control({ gameId, action: "end" });
    expect((await call({ user: user("a") }).game.current())[0]).toMatchObject({
      gameId,
      status: "ended",
    });
  });

  test("the projector gets the game name and speed without signing in", async () => {
    const { call } = setup();
    const { gameId } = await createGame(call);
    expect(await call({ user: null }).screen.info({ gameId })).toEqual({
      name: "Journée ETIC",
      msPerDay: 60_000,
    });
  });
});
