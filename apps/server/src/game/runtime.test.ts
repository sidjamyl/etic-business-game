import { describe, expect, test } from "bun:test";
import { type Actor, applyPatch, type TeamView } from "@etic/engine";
import { TRPCError } from "@trpc/server";
import { silentLogger } from "../test-helpers.ts";
import { createAppRouter } from "../trpc/router.ts";
import { createCallerFactory, type SessionUser } from "../trpc/trpc.ts";
import { GameManager } from "./manager.ts";
import { createMemoryPersistence } from "./persistence.ts";
import { RateLimiter } from "./rate-limit.ts";
import type { GameRuntime, StreamMessage } from "./runtime.ts";
import { makeReady, testEngine, testTeams } from "./test-engine.ts";

const organizer: Actor = { kind: "organizer", userId: "org", name: "Org" };
const lina: SessionUser = { id: "u-a", name: "Lina", email: "l@x", role: "participant" };
const sami: SessionUser = { id: "u-b", name: "Sami", email: "s@x", role: "participant" };
const boss: SessionUser = { id: "org", name: "Org", email: "o@x", role: "organizer" };
const stranger: SessionUser = { id: "u-z", name: "Zoé", email: "z@x", role: "participant" };

function setup(options: { now?: () => number } = {}) {
  const memory = createMemoryPersistence();
  const manager = new GameManager({
    engine: testEngine,
    persistence: memory.persistence,
    logger: silentLogger,
    saveDebounceMs: 0,
    ...options,
  });
  return { manager, memory };
}

async function startedGame(manager: GameManager, msPerDay = 60_000): Promise<GameRuntime> {
  const runtime = await manager.create({ name: "Test", teams: testTeams, msPerDay });
  makeReady(runtime.snapshot);
  runtime.submit(organizer, { type: "control.start" });
  // Give each team some cash to spend.
  for (const team of Object.values(runtime.snapshot.teams)) team.cash = 100;
  return runtime;
}

async function take<T>(iterator: AsyncGenerator<T>, count: number): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterator) {
    items.push(item);
    if (items.length === count) break;
  }
  return items;
}

describe("GameRuntime", () => {
  test("a subscriber receives the full view, then patches that rebuild the live view", async () => {
    const { manager } = setup();
    const runtime = await startedGame(manager);
    const controller = new AbortController();
    const stream = runtime.streamTeam("a", "u-a", controller.signal);
    const first = (await stream.next()).value as StreamMessage<TeamView>;
    expect(first.kind).toBe("full");
    let view = first.kind === "full" ? first.view : (null as never);

    runtime.step();
    runtime.submit(
      { kind: "team", teamId: "a", userId: "u-a", name: "Lina" },
      { type: "test.spend", payload: { amount: 10 } },
    );
    for (const message of await take(stream, 2)) {
      expect(message.kind).toBe("patch");
      if (message.kind === "patch") view = applyPatch(view, message.ops);
    }
    controller.abort();
    expect(view.clock.time).toEqual({ day: 1, step: 1 });
    expect(view.team.cash).toBe(90);
    expect(view.team.log.at(-1)).toMatchObject({ actor: "Lina" });
  });

  test("a team stream never carries another team's private changes", async () => {
    const { manager } = setup();
    const runtime = await startedGame(manager);
    const controller = new AbortController();
    const stream = runtime.streamTeam("b", "u-b", controller.signal);
    await stream.next(); // full view
    runtime.submit(
      { kind: "team", teamId: "a", userId: "u-a", name: "Lina" },
      { type: "test.spend", payload: { amount: 10 } },
    );
    runtime.step();
    const [message] = await take(stream, 1);
    controller.abort();
    const serialized = JSON.stringify(message);
    expect(serialized).not.toContain("Lina");
    expect(serialized).not.toContain("u-a");
    expect(serialized).toContain('"step"');
  });

  test("the public stream carries the clock and announcements only", async () => {
    const { manager } = setup();
    const runtime = await startedGame(manager);
    const controller = new AbortController();
    const [full] = await take(runtime.streamPublic(controller.signal), 1);
    controller.abort();
    const serialized = JSON.stringify(full);
    expect(serialized).toContain("La partie commence.");
    expect(serialized).not.toContain("cash");
    expect(serialized).not.toContain("u-a");
  });

  test("the timer advances steps while running and stops when paused", async () => {
    const { manager } = setup();
    const runtime = await startedGame(manager, 40); // 10 ms per step
    // Wait until the clock has clearly moved, without depending on scheduler precision.
    for (
      let i = 0;
      i < 100 && runtime.snapshot.time.day * 4 + runtime.snapshot.time.step < 7;
      i++
    ) {
      await Bun.sleep(10);
    }
    runtime.submit(organizer, { type: "control.pause" });
    const { day, step } = runtime.snapshot.time;
    expect(day * 4 + step).toBeGreaterThanOrEqual(7);
    await Bun.sleep(40);
    expect(runtime.snapshot.time).toEqual({ day, step });
    await runtime.stop();
  });

  test("the wall-clock end is converted to an end day and recomputed after a pause", async () => {
    let now = 0;
    const { manager } = setup({ now: () => now });
    const runtime = await startedGame(manager); // 60 s per day
    runtime.setEndsAt(organizer, new Date(10 * 60_000)); // 10 minutes → days 1..10
    expect(runtime.snapshot.endDay).toBe(10);
    runtime.submit(organizer, { type: "control.pause" });
    now = 5 * 60_000; // a 5-minute lunch while still on day 1
    runtime.submit(organizer, { type: "control.resume" });
    await Promise.resolve();
    expect(runtime.snapshot.endDay).toBe(5);
    await runtime.stop();
  });
});

describe("restore after a crash", () => {
  test("running games come back paused with the same simulated time", async () => {
    const { manager, memory } = setup();
    const runtime = await startedGame(manager);
    runtime.step();
    runtime.step();
    await runtime.flush();
    const time = runtime.snapshot.time;

    const restarted = new GameManager({
      engine: testEngine,
      persistence: memory.persistence,
      logger: silentLogger,
      saveDebounceMs: 0,
    });
    const [restored] = await restarted.restore();
    expect(restored?.snapshot.status).toBe("paused");
    expect(restored?.snapshot.time).toEqual(time);
  });

  test("journal entries newer than the snapshot are replayed", async () => {
    const { manager, memory } = setup();
    const runtime = await startedGame(manager);
    await runtime.flush();
    const staleSnapshot = structuredClone(runtime.snapshot);
    runtime.step();
    runtime.submit(
      { kind: "team", teamId: "a", userId: "u-a", name: "Lina" },
      { type: "test.spend", payload: { amount: 7 } },
    );
    runtime.step();
    await runtime.flush();
    const live = runtime.snapshot;
    // Simulate a crash between journal append and snapshot write.
    const stored = memory.games.get(live.id);
    if (stored) stored.state = staleSnapshot;

    const restarted = new GameManager({
      engine: testEngine,
      persistence: memory.persistence,
      logger: silentLogger,
      saveDebounceMs: 0,
    });
    const [restored] = await restarted.restore();
    expect(restored?.snapshot.time).toEqual(live.time);
    expect(restored?.snapshot.teams.a?.cash).toBe(live.teams.a?.cash);
  });
});

describe("game router", () => {
  async function routerSetup() {
    const { manager } = setup();
    const runtime = await startedGame(manager);
    const appRouter = createAppRouter({ manager, limiter: new RateLimiter(10, 10, () => 0) });
    const call = createCallerFactory(appRouter);
    return { runtime, call };
  }

  async function code(promise: Promise<unknown>) {
    try {
      await promise;
      return "OK";
    } catch (error) {
      return error instanceof TRPCError ? error.code : String(error);
    }
  }

  test("team commands are resolved to the caller's own team", async () => {
    const { runtime, call } = await routerSetup();
    const result = await call({ user: lina }).game.command({
      gameId: runtime.id,
      command: { type: "test.spend", payload: { amount: 10 } },
    });
    expect(result).toEqual({ ok: true });
    expect(runtime.snapshot.teams.a?.cash).toBe(90);
    expect(runtime.snapshot.teams.b?.cash).toBe(100);
  });

  test("refusals come back as data with a French message (pause, O1)", async () => {
    const { runtime, call } = await routerSetup();
    await call({ user: boss }).admin.control({ gameId: runtime.id, action: "pause" });
    const result = await call({ user: sami }).game.command({
      gameId: runtime.id,
      command: { type: "test.spend", payload: { amount: 10 } },
    });
    expect(result).toMatchObject({ ok: false, refusal: { code: "GAME_PAUSED" } });
  });

  test("non-members and unknown games are rejected", async () => {
    const { runtime, call } = await routerSetup();
    const command = { type: "test.spend", payload: { amount: 1 } };
    expect(await code(call({ user: stranger }).game.command({ gameId: runtime.id, command }))).toBe(
      "FORBIDDEN",
    );
    expect(await code(call({ user: lina }).game.command({ gameId: "nope", command }))).toBe(
      "NOT_FOUND",
    );
  });

  test("participants cannot drive the clock", async () => {
    const { runtime, call } = await routerSetup();
    expect(
      await code(call({ user: lina }).admin.control({ gameId: runtime.id, action: "pause" })),
    ).toBe("FORBIDDEN");
  });

  test("commands beyond 10 per second are rate-limited", async () => {
    const { runtime, call } = await routerSetup();
    const caller = call({ user: lina });
    const command = { type: "test.spend", payload: { amount: 1 } };
    for (let i = 0; i < 10; i++) await caller.game.command({ gameId: runtime.id, command });
    expect(await code(caller.game.command({ gameId: runtime.id, command }))).toBe(
      "TOO_MANY_REQUESTS",
    );
  });

  test("the team stream is only available to members", async () => {
    const { runtime, call } = await routerSetup();
    const iterable = await call({ user: lina }).game.stream({ gameId: runtime.id });
    const first = await (iterable as AsyncIterable<StreamMessage<TeamView>>)
      [Symbol.asyncIterator]()
      .next();
    expect(first.value?.kind).toBe("full");
    const denied = (await call({ user: stranger }).game.stream({
      gameId: runtime.id,
    })) as AsyncIterable<unknown>;
    // Generators fail on their first read; over SSE tRPC sends this error to the client.
    expect(await code(denied[Symbol.asyncIterator]().next())).toBe("FORBIDDEN");
  });
});
