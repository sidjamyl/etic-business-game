import type { RegionId } from "@etic/content";
import type { Engine } from "./engine.ts";
import type { Actor, Command, GameState } from "./types.ts";

/** Test helpers shared by module tests. Not part of the public API. */
export const ORGANIZER: Actor = { kind: "organizer", userId: "org", name: "Org" };

export function memberOf(teamId: string): Actor {
  return { kind: "team", teamId, userId: `u-${teamId}`, name: `Joueur ${teamId}` };
}

export function mustApply(engine: Engine, state: GameState, actor: Actor, command: Command) {
  const result = engine.applyCommand(state, actor, command);
  if (!result.ok) throw new Error(`${command.type} refused: ${result.refusal.message}`);
  return result.state;
}

export function refusalOf(engine: Engine, state: GameState, actor: Actor, command: Command) {
  const result = engine.applyCommand(state, actor, command);
  return result.ok ? null : result.refusal;
}

/** A running game with one member per team and the given home regions. */
export function startedGame(engine: Engine, regions: RegionId[], seed = "test-seed"): GameState {
  let state = engine.createGame({
    id: "g-test",
    seed,
    config: { stepsPerDay: 4, countdownDays: 30 },
    teams: regions.map((_, index) => ({
      id: `t${index + 1}`,
      name: `Équipe ${index + 1}`,
      joinCode: `CODE-${index + 1}`,
      members: [{ userId: `u-t${index + 1}`, name: `Joueur t${index + 1}` }],
    })),
  });
  for (const [index, region] of regions.entries()) {
    const actor = memberOf(`t${index + 1}`);
    state = mustApply(engine, state, actor, {
      type: "lobby.setCompanyName",
      payload: { companyName: `Société ${index + 1}` },
    });
    state = mustApply(engine, state, actor, { type: "lobby.chooseRegion", payload: { region } });
  }
  return mustApply(engine, state, ORGANIZER, { type: "control.start" });
}

/** Advances whole simulated days. */
export function advanceDays(engine: Engine, state: GameState, days: number): GameState {
  let current = state;
  for (let i = 0; i < days * current.config.stepsPerDay; i++) current = engine.step(current);
  return current;
}
