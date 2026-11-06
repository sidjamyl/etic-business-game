import { describe, expect, test } from "bun:test";
import { progressionRules } from "@etic/content";
import { gameEngine, milestoneProgress, type TeamState } from "@etic/engine";
import {
  branchIds,
  branchName,
  branchStatus,
  chosenBranch,
  daysUntil,
  developmentProgress,
  investBlocker,
  isUnlockableTier,
  machinesFor,
  milestoneRatio,
  otherBranch,
  productNames,
  recipeMaterials,
  relativeDay,
  salesLabel,
  tierMilestone,
  tierNames,
  tierProducts,
  tierStatus,
} from "./progression-math.ts";

function newTeam(): TeamState {
  const state = gameEngine.createGame({
    id: "g-progression",
    seed: "progression",
    config: { stepsPerDay: 4, countdownDays: 30 },
    teams: [{ id: "t1", name: "Équipe 1" }],
  });
  const team = state.teams.t1;
  if (!team) throw new Error("missing team");
  return team;
}

const ids = (list: { id: string }[]) => list.map((item) => item.id);

describe("tiers and branches", () => {
  test("each tier lists its products in catalog order", () => {
    expect(ids(tierProducts(1))).toEqual(["bread", "bottled-water", "soap"]);
    expect(ids(tierProducts(2))).toEqual(["clothing", "packaged-meal", "kettle"]);
    expect(ids(tierProducts(3))).toEqual(["laptop", "console"]);
    expect(ids(tierProducts(3, "tech"))).toEqual(["laptop"]);
    expect(ids(tierProducts(3, "leisure"))).toEqual(["console"]);
  });

  test("names come from the content", () => {
    expect(tierNames[1]).toBe("Essentiels");
    expect(productNames(tierProducts(2))).toBe("Vêtements, Plats préparés, Bouilloire");
    expect(branchIds).toEqual(["tech", "leisure"]);
    expect(branchName("leisure")).toBe("Loisirs");
    expect(otherBranch("tech")).toBe("leisure");
    expect(otherBranch("leisure")).toBe("tech");
  });

  test("a branch product shows its materials and the machines sold for it", () => {
    const [laptop] = tierProducts(3, "tech");
    if (!laptop) throw new Error("missing laptop");
    expect(recipeMaterials(laptop)).toEqual([
      "Composants électroniques",
      "Métal",
      "Plastique",
      "Batteries",
    ]);
    // The auction-only next-generation line is left out.
    expect(machinesFor("laptop")).toEqual(["Ligne électronique Tech"]);
    expect(machinesFor("console")).toEqual(["Ligne électronique Loisirs"]);
  });

  test("the branch is committed as soon as the tier-3 project starts", () => {
    const team = newTeam();
    expect(chosenBranch(team.progression)).toBeNull();
    expect(branchStatus(team.progression, "tech")).toBe("open");

    team.progression = {
      unlockedTier: 2,
      branch: null,
      project: { tier: 3, branch: "leisure", completesOnDay: 80 },
    };
    expect(chosenBranch(team.progression)).toBe("leisure");
    expect(branchStatus(team.progression, "leisure")).toBe("chosen");
    expect(branchStatus(team.progression, "tech")).toBe("closed");

    team.progression = { unlockedTier: 3, branch: "tech", project: null };
    expect(branchStatus(team.progression, "tech")).toBe("chosen");
    expect(branchStatus(team.progression, "leisure")).toBe("closed");
  });
});

describe("milestones", () => {
  test("count units delivered and paid of the previous tier, as the engine does", () => {
    const team = newTeam();
    team.stats.sold = { bread: 150, soap: 80, clothing: 30, kettle: 12 };
    const rule = progressionRules.tiers[2];
    const quote = { sold: 230, required: rule.milestoneUnits, cost: rule.cost, days: rule.days };
    expect(tierMilestone(team, 2)).toEqual({ tier: 2, salesTier: 1, ...quote });
    // Same figures as the team view's next milestone.
    expect(milestoneProgress(team)).toEqual({ tier: 2, ...quote });
    expect(tierMilestone(team, 3).sold).toBe(42);
    expect(tierMilestone(team, 3).salesTier).toBe(2);
  });

  test("only tiers 2 and 3 are opened by a project", () => {
    expect(isUnlockableTier(1)).toBe(false);
    expect(isUnlockableTier(2)).toBe(true);
    expect(isUnlockableTier(3)).toBe(true);
    expect(isUnlockableTier(4)).toBe(false);
  });

  test("ratio stays between 0 and 1", () => {
    expect(milestoneRatio(0, 400)).toBe(0);
    expect(milestoneRatio(100, 400)).toBe(0.25);
    expect(milestoneRatio(450, 400)).toBe(1);
    expect(milestoneRatio(5, 0)).toBe(1);
  });

  test("sales are counted in French", () => {
    expect(salesLabel(0)).toBe("0 vente");
    expect(salesLabel(1)).toBe("1 vente");
    expect(salesLabel(170)).toBe("170 ventes");
    expect(salesLabel(1200)).toBe(`${(1200).toLocaleString("fr-FR")} ventes`);
  });
});

describe("tier status", () => {
  test("from the start: tier 1 open, tier 2 waits for its milestone, tier 3 comes later", () => {
    const { progression } = newTeam();
    expect(tierStatus(progression, 1, true)).toEqual({ kind: "unlocked" });
    expect(tierStatus(progression, 2, false)).toEqual({ kind: "locked" });
    expect(tierStatus(progression, 2, true)).toEqual({ kind: "ready" });
    expect(tierStatus(progression, 3, true)).toEqual({ kind: "later" });
  });

  test("a project in progress shows its completion day", () => {
    const progression = {
      unlockedTier: 1 as const,
      branch: null,
      project: { tier: 2 as const, branch: null, completesOnDay: 52 },
    };
    expect(tierStatus(progression, 2, true)).toEqual({ kind: "developing", completesOnDay: 52 });
    expect(tierStatus(progression, 3, false)).toEqual({ kind: "later" });
  });

  test("once tier 3 is reached every tier is unlocked", () => {
    const progression = { unlockedTier: 3 as const, branch: "tech" as const, project: null };
    for (const tier of [1, 2, 3] as const) {
      expect(tierStatus(progression, tier, false)).toEqual({ kind: "unlocked" });
    }
  });
});

describe("investBlocker", () => {
  const ok = {
    status: "running" as const,
    sold: 400,
    required: 400,
    salesTier: 1,
    cost: 20_000,
    available: 20_000,
  };

  test("allows the project once the milestone is met and the cash is there", () => {
    expect(investBlocker(ok)).toBeNull();
  });

  test("decisions wait while the game is not running", () => {
    expect(investBlocker({ ...ok, status: "paused" })?.kind).toBe("paused");
    expect(investBlocker({ ...ok, status: "ended" })?.kind).toBe("ended");
    expect(investBlocker({ ...ok, status: "lobby" })?.kind).toBe("not-started");
  });

  test("explains the missing sales, then the missing cash", () => {
    expect(investBlocker({ ...ok, sold: 230, available: 0 })).toEqual({
      kind: "milestone",
      message: "Jalon non atteint : encore 170 ventes de produits du palier 1.",
    });
    expect(investBlocker({ ...ok, available: 15_000 })).toEqual({
      kind: "cash",
      message: `Trésorerie disponible insuffisante : il manque ₢${(5000).toLocaleString("fr-FR")}.`,
    });
  });
});

describe("development timing", () => {
  test("progress runs from the start of the project to its completion day", () => {
    // Started on day 42 for 10 days: ready at the start of day 52.
    expect(developmentProgress(52, 10, { day: 42, step: 0 }, 4)).toBe(0);
    expect(developmentProgress(52, 10, { day: 47, step: 0 }, 4)).toBe(0.5);
    expect(developmentProgress(52, 10, { day: 47, step: 2 }, 4)).toBeCloseTo(0.55);
    expect(developmentProgress(52, 10, { day: 53, step: 0 }, 4)).toBe(1);
    expect(developmentProgress(52, 0, { day: 40, step: 0 }, 4)).toBe(1);
  });

  test("days left count the sub-steps already spent", () => {
    expect(daysUntil(52, { day: 45, step: 0 }, 4)).toBe(7);
    expect(daysUntil(52, { day: 45, step: 2 }, 4)).toBe(6.5);
    expect(daysUntil(52, { day: 53, step: 0 }, 4)).toBe(0);
  });

  test("relative day labels", () => {
    expect(relativeDay(52, 52)).toBe("aujourd'hui");
    expect(relativeDay(53, 52)).toBe("demain");
    expect(relativeDay(59, 52)).toBe("dans 7 j");
  });
});
