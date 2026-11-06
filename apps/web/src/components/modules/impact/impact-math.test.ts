import { describe, expect, test } from "bun:test";
import { deliveryRules, impactRules, type RegionId, scoreRules } from "@etic/content";
import {
  type Actor,
  type Command,
  computeRanking,
  type GameState,
  gameEngine,
  impactScores,
  type TeamState,
} from "@etic/engine";
import { ratingTone } from "@/components/game/impact-badge";
import {
  averageLabel,
  averageWageRatio,
  countedScores,
  countLabel,
  countPhrase,
  ECONOMIC_POINTS,
  FAIR_FROM,
  formatScore,
  fromStart,
  GOOD_FROM,
  IMPACT_POINTS,
  impactScore,
  joinFrench,
  levelLabels,
  ofPlace,
  optionLabel,
  optionMode,
  optionsByImpact,
  producedByTier,
  productionSentence,
  purchasesSentence,
  ratingLevel,
  scoreContribution,
  signedScore,
  socialBase,
  socialEquation,
  totalPenalties,
  transportMix,
  transportSentence,
} from "./impact-math.ts";

/** Intl uses (narrow) no-break spaces in French: compare with plain spaces. */
const clean = (text: string) => text.replace(/\s/g, " ");

const ORGANIZER: Actor = { kind: "organizer", userId: "org", name: "Org" };

function member(teamId: string): Actor {
  return { kind: "team", teamId, userId: `u-${teamId}`, name: `Joueur ${teamId}` };
}

function apply(state: GameState, actor: Actor, command: Command): GameState {
  const result = gameEngine.applyCommand(state, actor, command);
  if (!result.ok) throw new Error(`${command.type} refused: ${result.refusal.message}`);
  return result.state;
}

/** A running game, one member per team, companies "Société 1", "Société 2"… */
function startedGame(regions: RegionId[]): GameState {
  let state = gameEngine.createGame({
    id: "g-impact",
    seed: "impact",
    config: { stepsPerDay: 4, countdownDays: 30 },
    teams: regions.map((_, index) => ({
      id: `t${index + 1}`,
      name: `Équipe ${index + 1}`,
      joinCode: `CODE-${index + 1}`,
      members: [{ userId: `u-t${index + 1}`, name: `Joueur t${index + 1}` }],
    })),
  });
  for (const [index, region] of regions.entries()) {
    const actor = member(`t${index + 1}`);
    state = apply(state, actor, {
      type: "lobby.setCompanyName",
      payload: { companyName: `Société ${index + 1}` },
    });
    state = apply(state, actor, { type: "lobby.chooseRegion", payload: { region } });
  }
  return apply(state, ORGANIZER, { type: "control.start" });
}

function teamOf(state: GameState, id: string): TeamState {
  const team = state.teams[id];
  if (!team) throw new Error(`missing team ${id}`);
  return team;
}

/** A fresh team of a started game, its facts free to set. */
function freshTeam(region: RegionId = "azura"): TeamState {
  return teamOf(startedGame([region]), "t1");
}

describe("levels", () => {
  test("thresholds", () => {
    expect(ratingLevel(100)).toBe("good");
    expect(ratingLevel(GOOD_FROM)).toBe("good");
    expect(ratingLevel(64.9)).toBe("fair");
    expect(ratingLevel(FAIR_FROM)).toBe("fair");
    expect(ratingLevel(39.9)).toBe("poor");
    expect(ratingLevel(0)).toBe("poor");
    expect(levelLabels).toEqual({ good: "Bon", fair: "Moyen", poor: "Faible" });
  });

  test("always agree with the shared badge colours", () => {
    const colour = { good: "text-success", fair: "text-warning", poor: "text-destructive" };
    for (let value = 0; value <= 100; value += 0.5) {
      expect(ratingTone(value)).toContain(colour[ratingLevel(value)]);
    }
  });
});

describe("formatting", () => {
  test("scores keep one decimal, never -0", () => {
    expect(formatScore(62.5)).toBe("62,5");
    expect(formatScore(50)).toBe("50");
    expect(formatScore(12.34)).toBe("12,3");
    expect(formatScore(53.400000000000006)).toBe("53,4");
    expect(formatScore(-0.04)).toBe("0");
  });

  test("signed gaps use the minus sign", () => {
    expect(signedScore(12.5)).toBe("+12,5");
    expect(signedScore(-8)).toBe("−8");
    expect(signedScore(0)).toBe("0");
    expect(signedScore(0.04)).toBe("0");
    expect(signedScore(-0.04)).toBe("0");
  });

  test("gap to the starting level", () => {
    expect(impactRules.neutral).toBe(50);
    expect(fromStart(62.5)).toBe(12.5);
    expect(fromStart(50)).toBe(0);
    expect(fromStart(41.9)).toBeCloseTo(-8.1, 10);
  });

  test("counts and lists in French", () => {
    expect(countLabel(0, "jour", "jours")).toBe("0 jour");
    expect(countLabel(1, "jour", "jours")).toBe("1 jour");
    expect(countLabel(3, "jour", "jours")).toBe("3 jours");
    expect(clean(countLabel(1200, "unité", "unités"))).toBe("1 200 unités");
    expect(countPhrase(0, "Aucun licenciement", "licenciement", "licenciements")).toBe(
      "Aucun licenciement",
    );
    expect(countPhrase(1, "Aucun licenciement", "licenciement", "licenciements")).toBe(
      "1 licenciement",
    );
    expect(countPhrase(4, "Aucun licenciement", "licenciement", "licenciements")).toBe(
      "4 licenciements",
    );
    expect(joinFrench([])).toBe("");
    expect(joinFrench(["a"])).toBe("a");
    expect(joinFrench(["a", "b"])).toBe("a et b");
    expect(joinFrench(["a", "b", "c"])).toBe("a, b et c");
    expect(ofPlace("Azura")).toBe("d'Azura");
    expect(ofPlace("Ferronia")).toBe("de Ferronia");
    expect(ofPlace("Port-Libre")).toBe("de Port-Libre");
  });
});

describe("final score (R18)", () => {
  test("weights", () => {
    expect(IMPACT_POINTS).toBe(30);
    expect(ECONOMIC_POINTS).toBe(70);
    expect(IMPACT_POINTS + ECONOMIC_POINTS).toBe(100);
  });

  test("impact score and its points", () => {
    expect(impactScore(62.5, 47.3)).toBe(54.9);
    expect(impactScore(50, 50)).toBe(50);
    expect(scoreContribution(56.3)).toBe(16.9);
    expect(scoreContribution(100)).toBe(IMPACT_POINTS);
    expect(scoreContribution(0)).toBe(0);
  });

  test("matches the ranking computed by the engine", () => {
    const state = startedGame(["azura", "ferronia"]);
    const team = teamOf(state, "t1");
    team.impact.purchases = {
      units: 300,
      environmentalSum: 300 * 72,
      socialSum: 300 * 64,
      lowRatedUnits: 0,
    };
    team.impact.transport = { units: 120, environmentalSum: 120 * 90, expressUnits: 0 };
    team.hr.wageRatioSum = 112;
    team.hr.employeeDays = 100;
    team.hr.layoffs = 1;
    team.cash = 80_000;
    const scores = impactScores(team);
    const entry = computeRanking(state).find((line) => line.teamId === "t1");
    expect(entry?.impact).toBe(impactScore(scores.environmental, scores.social));
    const economicPart = scoreRules.economicWeight * (entry?.economic ?? 0);
    expect(entry?.final ?? 0).toBeCloseTo(economicPart + scoreContribution(entry?.impact ?? 0), 0);
  });
});

describe("social indicator before penalties (N20)", () => {
  test("starting level without data", () => {
    const scores = impactScores(freshTeam());
    expect(scores.social).toBe(impactRules.neutral);
    expect(socialBase(scores)).toBe(impactRules.neutral);
    expect(totalPenalties(scores.breakdown.social.penalties)).toBe(0);
    expect(countedScores([scores.breakdown.social.wages, scores.breakdown.social.suppliers])).toBe(
      0,
    );
    expect(socialEquation(socialBase(scores), 0, 0)).toBe(
      "Aucune sous-note ni pénalité : niveau de départ",
    );
  });

  test("sub-scores minus penalties gives the indicator", () => {
    const team = freshTeam();
    team.hr.wageRatioSum = 108;
    team.hr.employeeDays = 100;
    team.impact.purchases = {
      units: 200,
      environmentalSum: 200 * 60,
      socialSum: 200 * 45,
      lowRatedUnits: 0,
    };
    team.hr.strikeDays = 4;
    team.hr.layoffs = 2;
    const scores = impactScores(team);
    const penalties = totalPenalties(scores.breakdown.social.penalties);
    expect(scores.breakdown.social.wages).toBe(66);
    expect(scores.breakdown.social.suppliers).toBe(45);
    expect(penalties).toBe(4 + 2 * impactRules.penalties.perLayoff);
    expect(socialBase(scores)).toBe(55.5);
    expect(socialBase(scores) - penalties).toBeCloseTo(scores.social, 10);
    expect(clean(socialEquation(socialBase(scores), penalties, 2))).toBe(
      "Moyenne des sous-notes 55,5 − pénalités 10",
    );
  });

  test("read back from the indicator whatever the rounding", () => {
    for (const [ratio, social, strikes] of [
      [1.013, 37.35, 3],
      [1.21, 81.05, 0],
      [0.97, 52.25, 25],
    ] as const) {
      const team = freshTeam();
      team.hr.wageRatioSum = ratio * 37;
      team.hr.employeeDays = 37;
      team.impact.purchases = {
        units: 40,
        environmentalSum: 0,
        socialSum: social * 40,
        lowRatedUnits: 0,
      };
      team.hr.strikeDays = strikes;
      const scores = impactScores(team);
      if (scores.social === 0) continue;
      const penalties = totalPenalties(scores.breakdown.social.penalties);
      expect(socialBase(scores) - penalties).toBeCloseTo(scores.social, 10);
    }
  });

  test("floored at 0 when the penalties exceed the sub-scores", () => {
    const team = freshTeam();
    team.impact.purchases = {
      units: 100,
      environmentalSum: 0,
      socialSum: 100 * 30,
      lowRatedUnits: 100,
    };
    team.blackMarket.convictions = 2;
    team.hr.massResignations = 1;
    const scores = impactScores(team);
    const penalties = totalPenalties(scores.breakdown.social.penalties);
    expect(scores.social).toBe(0);
    expect(penalties).toBe(
      2 * impactRules.penalties.perConviction + impactRules.penalties.perMassResignation,
    );
    expect(socialBase(scores)).toBe(30);
    expect(socialEquation(socialBase(scores), penalties, 1)).toBe(
      "Sous-note 30 − pénalités 45 (minimum 0)",
    );
  });

  test("penalties without any sub-score start from 50", () => {
    const team = freshTeam();
    team.hr.layoffs = 5;
    const scores = impactScores(team);
    expect(scores.social).toBe(35);
    expect(socialBase(scores)).toBe(50);
    expect(socialEquation(50, 15, 0)).toBe("Niveau de départ 50 − pénalités 15");
  });
});

describe("facts behind the sub-scores", () => {
  test("average wage ratio", () => {
    expect(averageWageRatio({ wageRatioSum: 0, employeeDays: 0 })).toBeNull();
    expect(averageWageRatio({ wageRatioSum: 108, employeeDays: 100 })).toBeCloseTo(1.08, 10);
  });

  test("units produced per tier", () => {
    expect(producedByTier({})).toEqual({ 1: 0, 2: 0, 3: 0 });
    expect(producedByTier({ bread: 600, soap: 10, kettle: 260, laptop: 5 })).toEqual({
      1: 610,
      2: 260,
      3: 5,
    });
  });

  test("customer deliveries per option and goods sent to other companies", () => {
    const team = freshTeam();
    team.impact.transport = { units: 1120, environmentalSum: 0, expressUnits: 150 };
    team.stats.shippedUnits = { green: 400, standard: 450, express: 150 };
    const mix = transportMix(team);
    expect(mix).toEqual({
      total: 1120,
      byOption: { green: 400, standard: 450, express: 150 },
      deliveries: 1000,
      trades: 120,
    });
    expect(clean(transportSentence(mix))).toBe(
      "1 120 unités expédiées, dont 120 vers d'autres entreprises.",
    );

    team.stats.shippedUnits = {};
    team.impact.transport = { units: 10, environmentalSum: 0, expressUnits: 0 };
    expect(transportSentence(transportMix(team))).toBe(
      "10 unités envoyées à d'autres entreprises.",
    );

    team.stats.shippedUnits = { standard: 5 };
    team.impact.transport = { units: 5, environmentalSum: 0, expressUnits: 0 };
    expect(transportMix(team).trades).toBe(0);
    expect(transportSentence(transportMix(team))).toBe("5 unités expédiées.");
  });

  test("transport options from the cleanest", () => {
    expect(optionsByImpact).toEqual(["green", "standard", "express"]);
    const ratings = optionsByImpact.map((option) => deliveryRules.options[option].environmental);
    expect([...ratings].sort((a, b) => b - a)).toEqual(ratings);
    expect(optionLabel("green")).toBe("Verte");
    expect(optionLabel("standard")).toBe("Standard");
    expect(optionLabel("express")).toBe("Express");
    expect(optionMode("green")).toBe("rail ou électrique");
    expect(optionMode("express")).toBe("avion");
  });

  test("sub-scores that count", () => {
    expect(countedScores([null, null, null])).toBe(0);
    expect(countedScores([null, 0, 72.5])).toBe(2);
    expect(averageLabel(0)).toBe("Aucune sous-note calculée : niveau de départ");
    expect(averageLabel(1)).toBe("Une seule sous-note calculée");
    expect(averageLabel(3)).toBe("Moyenne des 3 sous-notes calculées");
  });
});

describe("sentences", () => {
  test("purchases: low-rated suppliers and black market apart", () => {
    expect(clean(purchasesSentence(1240, 320, 50))).toBe(
      "1 240 unités de matières achetées, dont 270 chez des fournisseurs mal notés et 50 au marché noir.",
    );
    expect(purchasesSentence(1, 0, 0)).toBe("1 unité de matière achetée.");
    expect(purchasesSentence(100, 30, 0)).toBe(
      "100 unités de matières achetées, dont 30 chez des fournisseurs mal notés.",
    );
    expect(purchasesSentence(100, 100, 100)).toBe(
      "100 unités de matières achetées, dont 100 au marché noir.",
    );
  });

  test("production per tier", () => {
    expect(productionSentence({ 1: 600, 2: 260, 3: 0 })).toBe(
      "860 unités produites : 600 au palier 1 et 260 au palier 2.",
    );
    expect(productionSentence({ 1: 1, 2: 0, 3: 0 })).toBe("1 unité produite au palier 1.");
    expect(productionSentence({ 1: 10, 2: 5, 3: 2 })).toBe(
      "17 unités produites : 10 au palier 1, 5 au palier 2 et 2 au palier 3.",
    );
  });
});
