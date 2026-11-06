import { describe, expect, test } from "bun:test";
import { cards, startRules } from "@etic/content";
import { buildRegistry } from "./commands.ts";
import { controlCommands } from "./control.ts";
import { createEngine } from "./engine.ts";
import { lobbyCommands } from "./lobby.ts";
import type { Actor, Command, GameState } from "./types.ts";
import { publicView, teamView } from "./views.ts";

const engine = createEngine({ commands: buildRegistry(controlCommands, lobbyCommands) });
const organizer: Actor = { kind: "organizer", userId: "org", name: "Org" };
const player = (userId: string, name = userId): Actor => ({ kind: "player", userId, name });
const member = (teamId: string, userId: string): Actor => ({
  kind: "team",
  teamId,
  userId,
  name: userId,
});

function lobby(memberCap = 2): GameState {
  return engine.createGame({
    id: "g",
    seed: "s",
    memberCap,
    config: { stepsPerDay: 4, countdownDays: 30 },
    teams: [
      { id: "t1", name: "Équipe 1", joinCode: "LYNX-11" },
      { id: "t2", name: "Équipe 2", joinCode: "OURS-22" },
    ],
  });
}

function apply(state: GameState, actor: Actor, command: Command) {
  return engine.applyCommand(state, actor, command);
}

function must(state: GameState, actor: Actor, command: Command): GameState {
  const result = apply(state, actor, command);
  if (!result.ok) throw new Error(result.refusal.message);
  return result.state;
}

function refusal(state: GameState, actor: Actor, command: Command) {
  const result = apply(state, actor, command);
  return result.ok ? null : result.refusal;
}

const join = (teamId: string): Command => ({ type: "lobby.join", payload: { teamId } });

function readyGame(): GameState {
  let state = lobby();
  state = must(state, player("a"), join("t1"));
  state = must(state, player("b"), join("t2"));
  for (const [teamId, userId] of [
    ["t1", "a"],
    ["t2", "b"],
  ] as const) {
    state = must(state, member(teamId, userId), {
      type: "lobby.setCompanyName",
      payload: { companyName: `Société ${teamId}` },
    });
    state = must(state, member(teamId, userId), {
      type: "lobby.chooseRegion",
      payload: { region: "ferronia" },
    });
  }
  return state;
}

describe("joining", () => {
  test("a player joins a team and it is logged", () => {
    const state = must(lobby(), player("a", "Lina"), join("t1"));
    expect(state.teams.t1?.members.a).toEqual({ userId: "a", name: "Lina" });
    expect(state.teams.t1?.log.at(-1)?.message).toBe("Lina rejoint l'équipe.");
  });

  test("joining the same team twice is harmless", () => {
    const once = must(lobby(), player("a"), join("t1"));
    expect(must(once, player("a"), join("t1")).teams.t1?.members).toEqual(once.teams.t1?.members);
  });

  test("a player belongs to one team per game", () => {
    const state = must(lobby(), player("a"), join("t1"));
    expect(refusal(state, player("a"), join("t2"))?.code).toBe("ALREADY_IN_TEAM");
  });

  test("a full team refuses new members with « Équipe complète » (O4)", () => {
    let state = must(lobby(1), player("a"), join("t1"));
    expect(refusal(state, player("b"), join("t1"))).toEqual({
      code: "TEAM_FULL",
      message: "Équipe complète.",
    });
    state = must(state, organizer, { type: "admin.setMemberCap", payload: { memberCap: 2 } });
    expect(apply(state, player("b"), join("t1")).ok).toBe(true);
  });

  test("joining stays open after the start and during a pause (N6), not after the end", () => {
    let state = must(readyGame(), organizer, { type: "control.start" });
    expect(apply(state, player("c"), join("t1")).ok).toBe(true);
    state = must(state, organizer, { type: "control.pause" });
    expect(apply(state, player("c"), join("t1")).ok).toBe(true);
    state = must(state, organizer, { type: "control.end" });
    expect(refusal(state, player("c"), join("t1"))?.code).toBe("GAME_ENDED");
  });
});

describe("company setup", () => {
  test("name and region are visible to competitors in the lobby (R21)", () => {
    const view = teamView(readyGame(), "t2");
    expect(view?.competitors.t1).toMatchObject({
      companyName: "Société t1",
      region: "ferronia",
      ready: true,
    });
    expect(JSON.stringify(view?.competitors)).not.toContain("LYNX-11");
  });

  test("company names are trimmed and validated", () => {
    const state = must(lobby(), player("a"), join("t1"));
    const blank = refusal(state, member("t1", "a"), {
      type: "lobby.setCompanyName",
      payload: { companyName: "   " },
    });
    expect(blank).toEqual({
      code: "INVALID_PAYLOAD",
      message: "Le nom de l'entreprise est obligatoire.",
    });
  });

  test("unknown regions are refused", () => {
    const state = must(lobby(), player("a"), join("t1"));
    expect(
      refusal(state, member("t1", "a"), { type: "lobby.chooseRegion", payload: { region: "mars" } })
        ?.code,
    ).toBe("INVALID_PAYLOAD");
  });

  test("name and region are locked once the game starts", () => {
    const state = must(readyGame(), organizer, { type: "control.start" });
    expect(
      refusal(state, member("t1", "a"), {
        type: "lobby.chooseRegion",
        payload: { region: "azura" },
      })?.code,
    ).toBe("INVALID_STATE");
  });
});

describe("start", () => {
  test("the start is refused while a team is not ready, naming it", () => {
    const state = must(lobby(), player("a"), join("t1"));
    expect(refusal(state, organizer, { type: "control.start" })).toEqual({
      code: "NOT_READY",
      message: "Équipes pas prêtes (membre, nom et région requis) : Équipe 1, Équipe 2.",
    });
  });

  test("the start credits the starting cash and deals distinct secret cards", () => {
    const state = must(readyGame(), organizer, { type: "control.start" });
    const teams = Object.values(state.teams);
    expect(teams.map((t) => t.cash)).toEqual([startRules.startingCash, startRules.startingCash]);
    const dealt = teams.map((t) => t.card?.id);
    expect(new Set(dealt).size).toBe(2);
    for (const id of dealt) expect(cards.map((c): string => c.id)).toContain(id ?? "");
    expect(teams.every((t) => t.card?.used === false)).toBe(true);
  });

  test("a team sees its own card, competitors never do", () => {
    const state = must(readyGame(), organizer, { type: "control.start" });
    const own: string | undefined = state.teams.t1?.card?.id;
    expect(teamView(state, "t1")?.team.card?.id as string | undefined).toBe(own);
    expect(JSON.stringify(teamView(state, "t2")?.competitors)).not.toContain(own ?? "?");
    expect(JSON.stringify(publicView(state))).not.toContain('"card"');
  });
});

describe("organizer membership tools", () => {
  test("move a member to another team", () => {
    const state = must(readyGame(), organizer, {
      type: "admin.moveMember",
      payload: { userId: "a", toTeamId: "t2" },
    });
    expect(state.teams.t1?.members.a).toBeUndefined();
    expect(state.teams.t2?.members.a).toBeDefined();
  });

  test("moving into a full team is refused", () => {
    const state = must(readyGame(), organizer, {
      type: "admin.setMemberCap",
      payload: { memberCap: 1 },
    });
    expect(
      refusal(state, organizer, {
        type: "admin.moveMember",
        payload: { userId: "a", toTeamId: "t2" },
      })?.code,
    ).toBe("TEAM_FULL");
  });

  test("remove a member", () => {
    const state = must(readyGame(), organizer, {
      type: "admin.removeMember",
      payload: { userId: "a" },
    });
    expect(state.teams.t1?.members.a).toBeUndefined();
  });
});
