import { describe, expect, test } from "bun:test";
import { gameEngine as engine } from "../index.ts";
import { advanceDays, memberOf, mustApply, refusalOf, startedGame } from "../testkit.ts";
import type { GameState, TeamState } from "../types.ts";
import { teamView } from "../views.ts";
import { canProduce } from "./progression.ts";
import { newMachine } from "./shared.ts";

const t1 = memberOf("t1");
const invest = (tier: 2 | 3, branch?: "tech" | "leisure") => ({
  type: "progression.invest",
  payload: branch ? { tier, branch } : { tier },
});

function team(state: GameState): TeamState {
  const found = state.teams.t1;
  if (!found) throw new Error("no team");
  return found;
}

function withSales(sold: Partial<TeamState["stats"]["sold"]>) {
  const state = startedGame(engine, ["ferronia", "azura"]);
  team(state).stats.sold = sold;
  return state;
}

describe("unlocking tier 2", () => {
  test("refused until 400 tier-1 units are sold, naming the progress", () => {
    const state = withSales({ bread: 250, soap: 100 });
    expect(refusalOf(engine, state, t1, invest(2))).toEqual({
      code: "NOT_READY",
      message: "Jalon non atteint : 350 / 400 produits du palier 1 vendus.",
    });
    expect(teamView(state, "t1")?.nextMilestone).toMatchObject({
      tier: 2,
      sold: 350,
      required: 400,
    });
  });

  test("the milestone + ₢20 000 start a 10-day project", () => {
    let state = mustApply(engine, withSales({ bread: 400 }), t1, invest(2));
    expect(team(state).cash).toBe(30_000);
    expect(team(state).finance.totals.development).toBe(-20_000);
    expect(refusalOf(engine, state, t1, invest(2))?.code).toBe("ALREADY_IN_PROGRESS");
    state = advanceDays(engine, state, 9);
    expect(team(state).progression.unlockedTier).toBe(1);
    state = advanceDays(engine, state, 1);
    expect(team(state).progression).toEqual({ unlockedTier: 2, branch: null, project: null });
  });

  test("tiers are unlocked in order", () => {
    expect(refusalOf(engine, withSales({ clothing: 999 }), t1, invest(3, "tech"))?.message).toBe(
      "Débloquez d'abord le palier précédent.",
    );
  });
});

describe("unlocking tier 3", () => {
  function tier2Company(sold: number) {
    const state = withSales({ bread: 400, clothing: sold });
    team(state).progression.unlockedTier = 2;
    return state;
  }

  test("requires a branch choice", () => {
    expect(refusalOf(engine, tier2Company(250), t1, invest(3))?.message).toBe(
      "Choisissez la branche Tech ou Loisirs.",
    );
  });

  test("the branch is permanent and closes the other one (R1)", () => {
    let state = mustApply(engine, tier2Company(250), t1, invest(3, "leisure"));
    state = advanceDays(engine, state, 15);
    expect(team(state).progression).toMatchObject({ unlockedTier: 3, branch: "leisure" });
    expect(canProduce(team(state), "console")).toBe(true);
    expect(canProduce(team(state), "laptop")).toBe(false);
    expect(teamView(state, "t2")?.competitors.t1).toMatchObject({ tier: 3, branch: "leisure" });
    expect(refusalOf(engine, state, t1, invest(3, "tech"))?.message).toBe(
      "Ce palier est déjà débloqué.",
    );
  });
});

describe("production gating", () => {
  test("locked products cannot be scheduled, even with the right machine", () => {
    const state = startedGame(engine, ["ferronia"]);
    team(state).machines.m1 = newMachine("m1", "oven");
    expect(
      refusalOf(engine, state, t1, {
        type: "production.setJob",
        payload: { machineId: "m1", productId: "packaged-meal", cycles: 1 },
      })?.message,
    ).toBe("Plats préparés n'est pas débloqué pour votre entreprise (voir Progression).");
    team(state).progression.unlockedTier = 2;
    expect(
      engine.applyCommand(state, t1, {
        type: "production.setJob",
        payload: { machineId: "m1", productId: "packaged-meal", cycles: 1 },
      }).ok,
    ).toBe(true);
  });

  test("machines of locked tiers can still be bought in advance", () => {
    const state = startedGame(engine, ["ferronia"]);
    expect(
      engine.applyCommand(state, t1, {
        type: "purchase.buyMachine",
        payload: { supplierId: "ferro-machines", machineTypeId: "tech-line" },
      }).ok,
    ).toBe(true);
  });
});
