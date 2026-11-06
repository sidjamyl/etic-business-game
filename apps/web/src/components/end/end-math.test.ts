import { describe, expect, test } from "bun:test";
import { type Actor, type GameState, gameEngine, publicView, teamView } from "@etic/engine";
import {
  bestNetCash,
  economicExplanation,
  finalFormula,
  finalRanking,
  hasBreakdown,
  impactExplanation,
  impactScore,
  netCashOf,
  placeLabel,
  placeSuffix,
  resultTagline,
  scoreValue,
  scoreWeights,
  unitsLabel,
} from "./end-math.ts";

const clean = (text: string) => text.replace(/\s/g, " ");

const ORGANIZER: Actor = { kind: "organizer", userId: "org", name: "Org" };
const TEAMS = ["t1", "t2", "t3"] as const;

function member(teamId: string): Actor {
  return { kind: "team", teamId, userId: `u-${teamId}`, name: `Joueur ${teamId}` };
}

function apply(state: GameState, actor: Actor, type: string, payload?: unknown): GameState {
  const result = gameEngine.applyCommand(state, actor, { type, payload });
  if (!result.ok) throw new Error(`${type} refused: ${result.refusal.message}`);
  return result.state;
}

/** A game ended by the organizer: t1 best, t2 in debt, t3 with a negative net cash. */
function endedGame(): GameState {
  let state = gameEngine.createGame({
    id: "g-end",
    seed: "end",
    config: { stepsPerDay: 4, countdownDays: 30 },
    teams: TEAMS.map((id, index) => ({
      id,
      name: `Équipe ${index + 1}`,
      members: [{ userId: `u-${id}`, name: `Joueur ${id}` }],
    })),
  });
  for (const id of TEAMS) {
    state = apply(state, member(id), "lobby.setCompanyName", { companyName: `Société ${id}` });
    state = apply(state, member(id), "lobby.chooseRegion", { region: "azura" });
  }
  state = apply(state, ORGANIZER, "control.start");
  const [t1, t2, t3] = TEAMS.map((id) => state.teams[id]);
  if (!t1 || !t2 || !t3) throw new Error("missing team");
  t1.cash = 90_000;
  t2.cash = 60_000;
  t2.finance.debt = 20_000;
  t3.cash = 10_000;
  t3.finance.debt = 15_000;
  return apply(state, ORGANIZER, "control.end");
}

/** The ended game once the organizer has revealed every rank and shown the breakdown. */
function revealedGame(): GameState {
  let state = endedGame();
  for (const _ of TEAMS) state = apply(state, ORGANIZER, "control.revealNext");
  return apply(state, ORGANIZER, "control.showBreakdown");
}

describe("final ranking", () => {
  test("teams get nothing before the breakdown, even once every rank is revealed", () => {
    let state = endedGame();
    expect(teamView(state, "t1")?.results).toBeNull();
    for (const _ of TEAMS) state = apply(state, ORGANIZER, "control.revealNext");
    expect(teamView(state, "t1")?.results).toBeNull();
    expect(finalRanking(null)).toEqual([]);
    expect(finalRanking(undefined)).toEqual([]);
    // The projector sees names and ranks only: no breakdown to show yet.
    const partial = publicView(state).results;
    expect(partial?.ranking.some(hasBreakdown)).toBe(false);
    expect(finalRanking(partial)).toEqual([]);
  });

  test("after the breakdown, every line carries its scores, best first", () => {
    const state = revealedGame();
    const results = teamView(state, "t2")?.results ?? null;
    const ranking = finalRanking(results);
    expect(ranking.map((entry) => entry.teamId)).toEqual(["t1", "t2", "t3"]);
    expect(ranking.map((entry) => entry.rank)).toEqual([1, 2, 3]);
    expect(ranking.map((entry) => entry.netCash)).toEqual([90_000, 40_000, -5_000]);
    expect(results?.ranking.every(hasBreakdown)).toBe(true);
  });

  test("the displayed figures match the server's computation", () => {
    const state = revealedGame();
    const ranking = finalRanking(teamView(state, "t1")?.results);
    const best = bestNetCash(ranking);
    expect(best).toBe(90_000);
    for (const entry of ranking) {
      const team = state.teams[entry.teamId];
      if (!team) throw new Error("missing team");
      expect(netCashOf(team)).toBe(entry.netCash);
      expect(impactScore(entry.environmental, entry.social)).toBe(entry.impact);
      const economic = entry.netCash > 0 ? (100 * entry.netCash) / best : 0;
      expect(entry.economic).toBeCloseTo(economic, 1);
    }
  });

  test("the best net cash never goes below zero", () => {
    expect(bestNetCash([{ netCash: -500 }, { netCash: -20 }])).toBe(0);
    expect(bestNetCash([])).toBe(0);
    expect(bestNetCash([{ netCash: 1_200 }, { netCash: 3_400 }])).toBe(3_400);
  });

  test("net cash is cash minus debt, rounded like the ranking", () => {
    expect(netCashOf({ cash: 1_000.6, finance: { debt: 300 } })).toBe(701);
    expect(netCashOf({ cash: 10_000, finance: { debt: 15_000 } })).toBe(-5_000);
  });
});

describe("wording", () => {
  test("scores keep one decimal, French style", () => {
    expect(scoreValue(79.3)).toBe("79,3");
    expect(scoreValue(100)).toBe("100,0");
    expect(scoreValue(0)).toBe("0,0");
    expect(clean(scoreWeights.economic)).toBe("70 %");
    expect(clean(scoreWeights.impact)).toBe("30 %");
  });

  test("places use French ordinals", () => {
    expect(placeSuffix(1)).toBe("re");
    expect(placeLabel(1)).toBe("1re");
    expect(placeLabel(2)).toBe("2e");
    expect(placeLabel(4)).toBe("4e");
  });

  test("taglines: victory, podium, then the others", () => {
    expect(resultTagline(1, 4)).toContain("Victoire");
    expect(resultTagline(2, 4)).toContain("podium");
    expect(resultTagline(3, 4)).toContain("podium");
    expect(resultTagline(4, 4)).not.toContain("podium");
    // Last of three is not celebrated as a podium.
    expect(resultTagline(3, 3)).not.toContain("podium");
  });

  test("economic score explanation covers every case", () => {
    expect(clean(economicExplanation(40_000, 90_000, 44.4))).toBe("100 × ₢40 000 ÷ ₢90 000 = 44,4");
    expect(economicExplanation(90_000, 90_000, 100)).toContain("meilleure trésorerie nette");
    expect(economicExplanation(-5_000, 90_000, 0)).toContain("nulle ou négative");
    expect(economicExplanation(0, 90_000, 0)).toContain("nulle ou négative");
    expect(economicExplanation(-5_000, 0, 0)).toContain("Aucune entreprise");
  });

  test("impact and final formulas show the team's figures", () => {
    const entry = { environmental: 62.3, social: 58.1, impact: 60.2, economic: 87.5, final: 79.3 };
    expect(impactExplanation(entry)).toBe("(62,3 + 58,1) ÷ 2 = 60,2");
    expect(clean(finalFormula(entry))).toBe("70 % × 87,5 + 30 % × 60,2 = 79,3");
  });

  test("units are pluralised from two", () => {
    expect(unitsLabel(0)).toBe("0 unité");
    expect(unitsLabel(1)).toBe("1 unité");
    expect(clean(unitsLabel(1_240))).toBe("1 240 unités");
  });
});
