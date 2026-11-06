import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { buildRegistry, defineCommand } from "./commands.ts";
import { controlCommands } from "./control.ts";
import { createEngine, type JournalEntry } from "./engine.ts";
import { refuse } from "./errors.ts";
import { lobbyCommands } from "./lobby.ts";
import { logTeam } from "./log.ts";
import { nextInt } from "./rng.ts";
import type { GameSystem } from "./systems.ts";
import type { Actor, GameState } from "./types.ts";
import { publicView, teamOfUser, teamView } from "./views.ts";

// A tiny test module: a team decision and a system using randomness every day.
const testCommands = [
  defineCommand({
    type: "test.spend",
    actor: "team",
    schema: z.object({ amount: z.int().positive() }),
    apply: (draft, { amount }, actor) => {
      if (actor.kind !== "team") return;
      const team = draft.teams[actor.teamId];
      if (!team) return;
      if (team.cash < amount) refuse("INSUFFICIENT_FUNDS", "Trésorerie insuffisante.");
      team.cash -= amount;
      logTeam(draft, team.id, {
        kind: "decision",
        message: `Dépense de ${amount}`,
        actor: actor.name,
      });
    },
  }),
];
const lottery: GameSystem = {
  name: "lottery",
  onDay: (draft) => {
    for (const team of Object.values(draft.teams)) team.cash += nextInt(draft.rng, 0, 100);
  },
};
const ended: string[] = [];
const endHook: GameSystem = { name: "end", onEnd: (draft) => void ended.push(draft.id) };

const engine = createEngine({
  commands: buildRegistry(controlCommands, lobbyCommands, testCommands),
  systems: [lottery, endHook],
});

const organizer: Actor = { kind: "organizer", userId: "org", name: "Org" };
const lina: Actor = { kind: "team", teamId: "a", userId: "u1", name: "Lina" };
const intruder: Actor = { kind: "team", teamId: "a", userId: "u2", name: "Sami" };

function newGame(seed = "seed-1"): GameState {
  const state = engine.createGame({
    id: "g1",
    seed,
    config: { stepsPerDay: 4, countdownDays: 30 },
    teams: [
      { id: "a", name: "Alpha", members: [{ userId: "u1", name: "Lina" }] },
      { id: "b", name: "Bravo", members: [{ userId: "u2", name: "Sami" }] },
    ],
  });
  for (const team of Object.values(state.teams)) {
    team.companyName = `${team.name} SA`;
    team.region = "azura";
  }
  return state;
}

function must(result: ReturnType<typeof engine.applyCommand>): GameState {
  if (!result.ok) throw new Error(`refused: ${result.refusal.code}`);
  return result.state;
}

function started(seed?: string) {
  const state = must(engine.applyCommand(newGame(seed), organizer, { type: "control.start" }));
  for (const team of Object.values(state.teams)) team.cash = 1_000;
  return state;
}

function run(state: GameState, steps: number) {
  let current = state;
  for (let i = 0; i < steps; i++) current = engine.step(current);
  return current;
}

describe("commands", () => {
  test("applyCommand never mutates its input", () => {
    const before = started();
    const snapshot = structuredClone(before);
    must(engine.applyCommand(before, lina, { type: "test.spend", payload: { amount: 10 } }));
    expect(before).toEqual(snapshot);
  });

  test("team decisions are refused before the start", () => {
    const result = engine.applyCommand(newGame(), lina, {
      type: "test.spend",
      payload: { amount: 10 },
    });
    expect(result.ok ? null : result.refusal.code).toBe("GAME_NOT_STARTED");
  });

  test("team decisions are refused while paused, with a reason (O1)", () => {
    const paused = must(engine.applyCommand(started(), organizer, { type: "control.pause" }));
    const result = engine.applyCommand(paused, lina, {
      type: "test.spend",
      payload: { amount: 10 },
    });
    expect(result.ok ? null : result.refusal.code).toBe("GAME_PAUSED");
    const resumed = must(engine.applyCommand(paused, organizer, { type: "control.resume" }));
    expect(
      engine.applyCommand(resumed, lina, { type: "test.spend", payload: { amount: 10 } }).ok,
    ).toBe(true);
  });

  test("a member can only act for their own team", () => {
    const result = engine.applyCommand(started(), intruder, {
      type: "test.spend",
      payload: { amount: 10 },
    });
    expect(result.ok ? null : result.refusal.code).toBe("FORBIDDEN");
  });

  test("participants cannot send organizer commands", () => {
    const result = engine.applyCommand(started(), lina, { type: "control.pause" });
    expect(result.ok ? null : result.refusal.code).toBe("FORBIDDEN");
  });

  test("invalid payloads and unknown commands are refused", () => {
    const state = started();
    const bad = engine.applyCommand(state, lina, { type: "test.spend", payload: { amount: -1 } });
    expect(bad.ok ? null : bad.refusal.code).toBe("INVALID_PAYLOAD");
    const unknown = engine.applyCommand(state, lina, { type: "nope" });
    expect(unknown.ok ? null : unknown.refusal.code).toBe("UNKNOWN_COMMAND");
  });

  test("a handler refusal leaves the state untouched", () => {
    const state = started();
    const result = engine.applyCommand(state, lina, {
      type: "test.spend",
      payload: { amount: 5_000 },
    });
    expect(result.ok ? null : result.refusal).toEqual({
      code: "INSUFFICIENT_FUNDS",
      message: "Trésorerie insuffisante.",
    });
  });

  test("decisions are recorded in the team's activity log with the member's name", () => {
    const state = must(
      engine.applyCommand(started(), lina, { type: "test.spend", payload: { amount: 10 } }),
    );
    expect(state.teams.a?.log.at(-1)).toMatchObject({ kind: "decision", actor: "Lina" });
  });
});

describe("time", () => {
  test("a day has 4 sub-steps; daily systems run once per new day", () => {
    const state = run(started(), 4);
    expect(state.time).toEqual({ day: 2, step: 0 });
    expect(run(started(), 3).teams.a?.cash).toBe(1_000);
    expect(state.teams.a?.cash).not.toBe(1_000);
  });

  test("steps do nothing unless the game is running", () => {
    const lobby = newGame();
    expect(engine.step(lobby)).toBe(lobby);
    const paused = must(engine.applyCommand(started(), organizer, { type: "control.pause" }));
    expect(engine.step(paused)).toBe(paused);
  });

  test("the game ends after the last scheduled day, running end hooks", () => {
    ended.length = 0;
    let state = must(
      engine.applyCommand(started(), organizer, {
        type: "control.setEndDay",
        payload: { endDay: 3 },
      }),
    );
    state = run(state, 4 * 3 - 1);
    expect(state.status).toBe("running");
    state = engine.step(state);
    expect(state.status).toBe("ended");
    expect(state.time.day).toBe(3);
    expect(ended).toEqual(["g1"]);
    const after = engine.applyCommand(state, lina, { type: "test.spend", payload: { amount: 1 } });
    expect(after.ok ? null : after.refusal.code).toBe("GAME_ENDED");
  });

  test("the countdown covers the last 30 simulated days", () => {
    const state = must(
      engine.applyCommand(started(), organizer, {
        type: "control.setEndDay",
        payload: { endDay: 31 },
      }),
    );
    expect(publicView(state).clock.countdown).toBe(false);
    const later = run(state, 4);
    expect(publicView(later).clock).toMatchObject({ countdown: true, daysRemaining: 30 });
  });

  test("the organizer can end the game manually", () => {
    const state = must(engine.applyCommand(started(), organizer, { type: "control.end" }));
    expect(state.status).toBe("ended");
  });
});

describe("determinism and replay", () => {
  function play(seed: string) {
    const journal: JournalEntry[] = [];
    let state = started(seed);
    const initial = state;
    for (let i = 0; i < 40; i++) {
      if (i % 7 === 3) {
        const command = { type: "test.spend", payload: { amount: 5 } };
        journal.push({ kind: "command", actor: lina, command });
        const result = engine.applyCommand(state, lina, command);
        if (result.ok) state = result.state;
      }
      journal.push({ kind: "step" });
      state = engine.step(state);
    }
    return { initial, journal, state };
  }

  test("same seed and same commands give the same final state", () => {
    expect(play("alpha").state).toEqual(play("alpha").state);
    expect(play("alpha").state.teams.a?.cash).not.toBe(play("beta").state.teams.a?.cash);
  });

  test("replaying the journal from a snapshot reproduces the live state", () => {
    const { initial, journal, state } = play("gamma");
    expect(engine.replay(initial, journal)).toEqual(state);
    // From a mid-game snapshot too.
    const mid = engine.replay(initial, journal.slice(0, 20));
    expect(engine.replay(mid, journal.slice(20))).toEqual(state);
  });

  test("journalSeq counts every accepted command and step", () => {
    const { journal, state } = play("delta");
    expect(state.journalSeq).toBe(journal.length + 1); // + control.start
  });
});

describe("views", () => {
  test("a team view never contains another team's private data", () => {
    const view = teamView(started(), "a");
    const serialized = JSON.stringify(view);
    expect(view?.team.id).toBe("a");
    expect(serialized).not.toContain("u2");
    expect(view?.competitors.b).toEqual({
      id: "b",
      name: "Bravo",
      companyName: "Bravo SA",
      region: "azura",
      memberCount: 1,
      ready: true,
      tier: 1,
      branch: null,
    });
  });

  test("teamOfUser resolves membership", () => {
    const state = started();
    expect(teamOfUser(state, "u2")).toBe("b");
    expect(teamOfUser(state, "zz")).toBeNull();
  });
});
