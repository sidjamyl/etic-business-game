import type { RegionId } from "@etic/content";
import {
  type Actor,
  type Command,
  type GameState,
  gameEngine,
  type TeamState,
  type TeamView,
  teamView,
} from "@etic/engine";

/** Test helpers of the Échanges module: a real game driven through the engine. Tests only. */

export const ORGANIZER: Actor = { kind: "organizer", userId: "org", name: "Org" };

export function member(teamId: string): Actor {
  return { kind: "team", teamId, userId: `u-${teamId}`, name: `Joueur ${teamId}` };
}

export function apply(state: GameState, actor: Actor, command: Command): GameState {
  const result = gameEngine.applyCommand(state, actor, command);
  if (!result.ok) throw new Error(`${command.type} refused: ${result.refusal.message}`);
  return result.state;
}

export function refusal(state: GameState, actor: Actor, command: Command): string | null {
  const result = gameEngine.applyCommand(state, actor, command);
  return result.ok ? null : result.refusal.message;
}

/** A running game, one company per name, in the given home regions (t1, t2…). */
export function startedGame(companies: string[], regions: RegionId[]): GameState {
  let state = gameEngine.createGame({
    id: "g-trades",
    seed: "trades",
    config: { stepsPerDay: 4, countdownDays: 30 },
    teams: companies.map((_, index) => ({
      id: `t${index + 1}`,
      name: `Équipe ${index + 1}`,
      joinCode: `CODE-${index + 1}`,
      members: [{ userId: `u-t${index + 1}`, name: `Joueur t${index + 1}` }],
    })),
  });
  for (const [index, companyName] of companies.entries()) {
    const actor = member(`t${index + 1}`);
    const region = regions[index];
    if (!region) throw new Error("missing region");
    state = apply(state, actor, { type: "lobby.setCompanyName", payload: { companyName } });
    state = apply(state, actor, { type: "lobby.chooseRegion", payload: { region } });
  }
  return apply(state, ORGANIZER, { type: "control.start" });
}

export function advanceDays(state: GameState, days: number): GameState {
  let current = state;
  for (let i = 0; i < days * current.config.stepsPerDay; i++) current = gameEngine.step(current);
  return current;
}

export function teamOf(state: GameState, id: string): TeamState {
  const team = state.teams[id];
  if (!team) throw new Error(`no team ${id}`);
  return team;
}

export function viewOf(state: GameState, id: string): TeamView {
  const view = teamView(state, id);
  if (!view) throw new Error(`no view for ${id}`);
  return view;
}

/** Id of the latest trade offer. */
export function lastOfferId(state: GameState): string {
  const ids = Object.keys(state.trades.offers);
  const id = ids[ids.length - 1];
  if (!id) throw new Error("no offer");
  return id;
}

export function offerCommand(payload: Record<string, unknown> = {}): Command {
  return {
    type: "trade.offer",
    payload: {
      buyerTeamId: "t2",
      good: { kind: "item", item: "flour", quantity: 100 },
      price: 1_000,
      option: "standard",
      shippingPaidBy: "buyer",
      ...payload,
    },
  };
}
