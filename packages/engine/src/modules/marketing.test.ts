import { describe, expect, test } from "bun:test";
import { gameEngine as engine } from "../index.ts";
import { advanceDays, memberOf, mustApply, refusalOf, startedGame } from "../testkit.ts";
import type { GameState, TeamState } from "../types.ts";
import { campaignBoost, campaignCost } from "./marketing.ts";
import { localPrice, teamDemand } from "./sales.ts";

const t1 = memberOf("t1");
const t2 = memberOf("t2");
const launch = (region: string | null, productId: string | null, days: number) => ({
  type: "marketing.launch",
  payload: { region, productId, days },
});

function team(state: GameState, id = "t1"): TeamState {
  const found = state.teams[id];
  if (!found) throw new Error("no team");
  return found;
}

describe("cost (N14)", () => {
  test("₢60 × population × breadth × days", () => {
    expect(campaignCost("azura", "bread", 7)).toBe(672);
    expect(campaignCost("nordhaven", null, 14)).toBe(1_260);
    expect(campaignCost(null, null, 30)).toBe(18_450);
  });
});

describe("campaigns", () => {
  test("a campaign is paid at launch and recorded", () => {
    const state = mustApply(
      engine,
      startedGame(engine, ["azura"]),
      t1,
      launch("azura", "bread", 7),
    );
    expect(team(state).cash).toBe(50_000 - 672);
    expect(team(state).finance.totals.marketing).toBe(-672);
    expect(Object.values(team(state).campaigns)[0]).toMatchObject({ startDay: 1, endDay: 7 });
  });

  test("only 7, 14 or 30 days", () => {
    expect(
      refusalOf(engine, startedGame(engine, ["azura"]), t1, launch("azura", "bread", 10))?.message,
    ).toBe("Durée possible : 7, 14 ou 30 jours.");
  });

  test("the same target cannot be launched twice; overlapping targets can", () => {
    let state = mustApply(engine, startedGame(engine, ["azura"]), t1, launch("azura", "bread", 7));
    expect(refusalOf(engine, state, t1, launch("azura", "bread", 14))?.message).toBe(
      "Une campagne vise déjà exactement cette cible.",
    );
    state = mustApply(engine, state, t1, launch("azura", null, 7));
    expect(campaignBoost(team(state), "azura", "bread")).toBe(1.2);
  });

  test("+20% attractiveness takes market share from competitors", () => {
    let state = startedGame(engine, ["ferronia", "ferronia"]);
    for (const actor of [t1, t2]) {
      state = mustApply(engine, state, actor, {
        type: "sales.setPrice",
        payload: { region: "ferronia", productId: "bread", price: localPrice("ferronia", "bread") },
      });
    }
    const before = teamDemand(state, "ferronia", "bread");
    expect(before.get("t1")).toBeCloseTo(60, 5);
    state = mustApply(engine, state, t1, launch("ferronia", "bread", 7));
    const after = teamDemand(state, "ferronia", "bread");
    expect(after.get("t1")).toBeCloseTo((120 * 1.2) / 2.2, 5);
    expect((after.get("t1") ?? 0) + (after.get("t2") ?? 0)).toBeCloseTo(120, 5);
  });

  test("whole-range campaigns cover every product of the target region only", () => {
    const state = mustApply(engine, startedGame(engine, ["azura"]), t1, launch("azura", null, 7));
    expect(campaignBoost(team(state), "azura", "soap")).toBe(1.2);
    expect(campaignBoost(team(state), "nordhaven", "soap")).toBe(1);
  });

  test("campaigns end automatically after their duration", () => {
    let state = mustApply(engine, startedGame(engine, ["azura"]), t1, launch("azura", "bread", 7));
    state = advanceDays(engine, state, 6);
    expect(Object.keys(team(state).campaigns)).toHaveLength(1);
    state = advanceDays(engine, state, 1);
    expect(team(state).campaigns).toEqual({});
    expect(team(state).log.at(-1)?.message).toBe("Fin de la campagne (Pain, Azura).");
  });
});
