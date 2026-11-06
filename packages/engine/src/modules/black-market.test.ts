import { describe, expect, test } from "bun:test";
import { blackMarketRules, materialSuppliers } from "@etic/content";
import { gameEngine as engine } from "../index.ts";
import { advanceDays, memberOf, mustApply, refusalOf, startedGame } from "../testkit.ts";
import type { GameState, TeamState } from "../types.ts";
import { teamView } from "../views.ts";
import { blackMarketBuyPrice, blackMarketSellPrice, chargeFine } from "./black-market.ts";
import { localPrice } from "./sales.ts";
import { credits } from "./shared.ts";

const t1 = memberOf("t1");
const t2 = memberOf("t2");
const buy = (material: string, quantity: number) => ({
  type: "blackMarket.buy",
  payload: { material, quantity },
});
const sell = (productId: string, quantity: number) => ({
  type: "blackMarket.sell",
  payload: { productId, quantity },
});
const accuse = (targetTeamId: string) => ({
  type: "blackMarket.accuse",
  payload: { targetTeamId },
});
const investigate = (targetTeamId: string) => ({
  type: "blackMarket.investigate",
  payload: { targetTeamId },
});

function team(state: GameState, id = "t1"): TeamState {
  const found = state.teams[id];
  if (!found) throw new Error("no team");
  return found;
}

describe("trading off the books", () => {
  test("buys 35% under the average supplier price and delivers the next day", () => {
    const flour = materialSuppliers.filter((s) => s.material === "flour").map((s) => s.price);
    const average = flour.reduce((a, b) => a + b, 0) / flour.length;
    const price = blackMarketBuyPrice("flour");
    expect(price).toBeCloseTo(average * 0.65, 2);
    let state = mustApply(engine, startedGame(engine, ["azura", "azura"]), t1, buy("flour", 50));
    expect(team(state).cash).toBe(50_000 - Math.round(price * 50));
    expect(state.market.blackMarket.stock.flour).toBe(50);
    expect(team(state).blackMarket).toMatchObject({ purchasedUnits: 50, traces: [{ day: 1 }] });
    state = advanceDays(engine, state, 1);
    expect(team(state).inventory.flour).toBe(50);
  });

  test("sells 30% above the local price, paid now, within the daily cap", () => {
    let state = startedGame(engine, ["ferronia", "azura"]);
    team(state).inventory.bread = 100;
    const price = blackMarketSellPrice(team(state), "bread");
    expect(price).toBeCloseTo(localPrice("ferronia", "bread") * 1.3, 5);
    state = mustApply(engine, state, t1, sell("bread", 30));
    expect(team(state).cash).toBe(50_000 + Math.round(price * 30));
    expect(team(state).inventory.bread).toBe(70);
    expect(refusalOf(engine, state, t1, sell("bread", 11))?.message).toBe(
      "Les acheteurs n'en prendront plus que 10 aujourd'hui.",
    );
    state = advanceDays(engine, state, 1);
    expect(engine.applyCommand(state, t1, sell("bread", 40)).ok).toBe(true);
  });

  test("reserved stock cannot be sold off the books", () => {
    const state = startedGame(engine, ["ferronia", "azura"]);
    team(state).inventory.bread = 20;
    team(state).reserved.bread = 15;
    expect(refusalOf(engine, state, t1, sell("bread", 10))?.code).toBe("OUT_OF_STOCK");
  });

  test("Port-Libre gets 1.5× the caps", () => {
    const view = teamView(startedGame(engine, ["port-libre"]), "t1");
    expect(view?.blackMarket.sell.bread?.cap).toBe(60);
    expect(view?.blackMarket.sell.laptop?.cap).toBe(3);
  });

  test("Port-Libre customs eventually catch a busy smuggler", () => {
    let state = startedGame(engine, ["port-libre", "azura"], "customs-seed");
    for (let i = 0; i < 60 && team(state).blackMarket.convictions === 0; i++) {
      state = mustApply(engine, state, t1, buy("plastic", 1));
      if (i % 20 === 19) state = advanceDays(engine, state, 7);
    }
    expect(team(state).blackMarket.convictions).toBe(1);
    expect(state.news.at(-1)?.body).toContain("la douane de Port-Libre");
  });
});

describe("accusations", () => {
  test("a guilty company is fined 2× its gain (min ₢2 000), loses reputation and is barred", () => {
    let state = mustApply(engine, startedGame(engine, ["azura", "azura"]), t2, buy("flour", 50));
    state = mustApply(engine, state, t1, accuse("t2"));
    const guilty = team(state, "t2");
    expect(guilty.cash).toBe(50_000 - Math.round(blackMarketBuyPrice("flour") * 50) - 2_000);
    expect(guilty.reputation).toBe(35);
    expect(guilty.blackMarket).toMatchObject({ convictions: 1, traces: [], bannedUntilDay: 31 });
    expect(state.news.at(-1)?.title).toBe("Scandale : Société 2 pris la main dans le sac");
    expect(refusalOf(engine, state, t2, buy("flour", 1))?.message).toBe(
      "Vous êtes exclu du marché noir jusqu'au jour 31.",
    );
  });

  test("a baseless accusation costs the accuser ₢5 000 and 10 reputation", () => {
    const state = mustApply(engine, startedGame(engine, ["azura", "azura"]), t1, accuse("t2"));
    expect(team(state)).toMatchObject({ cash: 45_000, reputation: 40 });
    expect(team(state, "t2").cash).toBe(50_000);
    expect(state.news.at(-1)?.title).toBe("Accusation infondée de Société 1");
  });

  test("the same team cannot be accused again within 10 days; never yourself", () => {
    const state = mustApply(engine, startedGame(engine, ["azura", "azura"]), t1, accuse("t2"));
    expect(refusalOf(engine, state, t1, accuse("t2"))?.code).toBe("COOLDOWN");
    expect(refusalOf(engine, state, t1, accuse("t1"))?.code).toBe("INVALID_PAYLOAD");
  });

  test("traces fade after 30 days", () => {
    let state = mustApply(engine, startedGame(engine, ["azura", "azura"]), t2, buy("flour", 10));
    state = advanceDays(engine, state, 30);
    state = mustApply(engine, state, t1, accuse("t2"));
    expect(team(state).cash).toBe(45_000); // baseless now
  });
});

describe("investigations", () => {
  test("cost ₢3 000; never find anything on a clean company; result stays private", () => {
    const state = mustApply(engine, startedGame(engine, ["azura", "azura"]), t1, investigate("t2"));
    expect(team(state).cash).toBe(47_000);
    expect(team(state).blackMarket.investigations).toEqual([
      { targetTeamId: "t2", day: 1, proofFound: false },
    ]);
    expect(JSON.stringify(teamView(state, "t2"))).not.toContain("proofFound");
  });

  test("many recent traces make proof very likely", () => {
    let state = startedGame(engine, ["azura", "azura"], "investigation-seed");
    for (let i = 0; i < 6; i++) state = mustApply(engine, state, t2, buy("fabric", 1));
    let found = 0;
    for (let i = 0; i < 10; i++) {
      state = mustApply(engine, state, t1, investigate("t2"));
      if (team(state).blackMarket.investigations.at(-1)?.proofFound) found += 1;
    }
    expect(found).toBeGreaterThanOrEqual(6); // 85% chance each
  });
});

describe("fines beyond the available cash", () => {
  test("the rest is added to the bank debt (N17)", () => {
    const state = startedGame(engine, ["azura"]);
    team(state).cash = 1_000;
    const result = chargeFine(state, team(state), 3_000, "test");
    expect(result).toEqual({ paid: 1_000, toDebt: 2_000 });
    expect(team(state)).toMatchObject({ cash: 0 });
    expect(team(state).finance.debt).toBe(2_000);
  });

  test("the view tells the team it is barred", () => {
    let state = mustApply(engine, startedGame(engine, ["azura", "azura"]), t2, buy("flour", 1));
    state = mustApply(engine, state, t1, accuse("t2"));
    expect(teamView(state, "t2")?.blackMarket).toMatchObject({
      bannedUntilDay: 31,
      recentTraces: 0,
    });
    expect(credits(blackMarketRules.investigation.cost)).toContain("3");
  });
});
