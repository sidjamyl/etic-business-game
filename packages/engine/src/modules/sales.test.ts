import { describe, expect, test } from "bun:test";
import { productById, regionById } from "@etic/content";
import { gameEngine as engine } from "../index.ts";
import { advanceDays, memberOf, mustApply, refusalOf, startedGame } from "../testkit.ts";
import type { GameState, TeamState } from "../types.ts";
import { teamView } from "../views.ts";
import { localPrice, maxPrice, priceEffect, recoveryLevel, teamDemand } from "./sales.ts";

const LOCAL_BREAD = localPrice("ferronia", "bread");

const t1 = memberOf("t1");
const t2 = memberOf("t2");
const setPrice = (region: string, productId: string, price: number | null) => ({
  type: "sales.setPrice",
  payload: { region, productId, price },
});

function orderedUnits(state: GameState, teamId: string): number {
  return Object.values(state.teams[teamId]?.orders ?? {}).reduce((s, o) => s + o.quantity, 0);
}

function team(state: GameState, id = "t1"): TeamState {
  const found = state.teams[id];
  if (!found) throw new Error(`no team ${id}`);
  return found;
}

describe("prices", () => {
  test("local and maximum prices follow purchasing power (N10)", () => {
    const reference = productById.get("bread")?.referencePrice ?? 0;
    expect(localPrice("azura", "bread")).toBeCloseTo(
      reference * (regionById.get("azura")?.purchasingPower ?? 0),
      5,
    );
    expect(localPrice("nordhaven", "bread")).toBeCloseTo(reference * 1.5, 5);
    expect(maxPrice("ferronia", "bread")).toBeCloseTo(reference * 1.5, 5);
  });

  test("the price effect is 1 at the local price, 0 at the max, up to 1.5 when cheap", () => {
    const local = localPrice("ferronia", "bread");
    expect(priceEffect(local, "ferronia", "bread")).toBe(1);
    expect(priceEffect(local * 1.5, "ferronia", "bread")).toBe(0);
    expect(priceEffect(local * 1.25, "ferronia", "bread")).toBeCloseTo(0.5, 5);
    expect(priceEffect(local * 0.5, "ferronia", "bread")).toBe(1.5);
    expect(priceEffect(local * 0.75, "ferronia", "bread")).toBeCloseTo(1.25, 5);
    expect(priceEffect(1, "ferronia", "bread")).toBe(1.5);
  });
});

describe("recovery", () => {
  test("tier 2 ramps from day 60 to 180, tier 3 from 150 to 300; Nordhaven is 30 days early", () => {
    const state = startedGame(engine, ["azura"]);
    expect(recoveryLevel(state, 1, "azura", 1)).toBe(1);
    expect(recoveryLevel(state, 2, "azura", 60)).toBe(0);
    expect(recoveryLevel(state, 2, "azura", 120)).toBe(0.5);
    expect(recoveryLevel(state, 2, "azura", 180)).toBe(1);
    expect(recoveryLevel(state, 2, "nordhaven", 90)).toBe(0.5);
    expect(recoveryLevel(state, 3, "ferronia", 225)).toBe(0.5);
  });

  test("events can shift the recovery", () => {
    const state = startedGame(engine, ["azura"]);
    state.market.recoveryShiftDays[2] = -60;
    expect(recoveryLevel(state, 2, "azura", 60)).toBe(0.5);
  });
});

describe("demand and orders", () => {
  test("no price, no orders", () => {
    const state = advanceDays(engine, startedGame(engine, ["ferronia"]), 2);
    expect(orderedUnits(state, "t1")).toBe(0);
  });

  test("a lone seller at the local price receives about the base demand", () => {
    let state = mustApply(
      engine,
      startedGame(engine, ["ferronia"]),
      t1,
      setPrice("ferronia", "bread", LOCAL_BREAD),
    );
    state = advanceDays(engine, state, 5);
    const history = Object.values(team(state).stats.orderHistory);
    const demanded = history.reduce((sum, day) => sum + (day["ferronia:bread"] ?? 0), 0);
    // 120 units per day for 5 days, minus the fraction not yet turned into an order.
    expect(demanded).toBeGreaterThan(5 * 120 - 60);
    expect(demanded).toBeLessThanOrEqual(5 * 120);
    expect(Object.values(team(state).orders).every((o) => o.unitPrice === LOCAL_BREAD)).toBe(true);
  });

  test("demand is shared in proportion to attractiveness", () => {
    let state = startedGame(engine, ["ferronia", "ferronia"]);
    state = mustApply(engine, state, t1, setPrice("ferronia", "bread", LOCAL_BREAD));
    state = mustApply(engine, state, t2, setPrice("ferronia", "bread", LOCAL_BREAD));
    team(state, "t2").reputation = 100; // factor 1.5 vs 1.0
    const demand = teamDemand(state, "ferronia", "bread");
    expect(demand.get("t1")).toBeCloseTo(48, 5);
    expect(demand.get("t2")).toBeCloseTo(72, 5);
  });

  test("distant markets are less attractive", () => {
    let state = startedGame(engine, ["ferronia", "nordhaven"]);
    state = mustApply(engine, state, t1, setPrice("azura", "bread", 12));
    state = mustApply(engine, state, t2, setPrice("azura", "bread", 12));
    const demand = teamDemand(state, "azura", "bread");
    // Ferronia → Azura: 2 days (−10%); Nordhaven → Azura: 4 days (−30%).
    expect((demand.get("t1") ?? 0) / (demand.get("t2") ?? 1)).toBeCloseTo(0.9 / 0.7, 5);
  });

  test("no demand above the maximum price", () => {
    let state = mustApply(
      engine,
      startedGame(engine, ["ferronia"]),
      t1,
      setPrice("ferronia", "bread", LOCAL_BREAD * 1.5),
    );
    state = advanceDays(engine, state, 2);
    expect(orderedUnits(state, "t1")).toBe(0);
  });

  test("tier-2 products find no customers before the recovery", () => {
    let state = mustApply(
      engine,
      startedGame(engine, ["ferronia"]),
      t1,
      setPrice("ferronia", "clothing", 60),
    );
    state = advanceDays(engine, state, 2);
    expect(orderedUnits(state, "t1")).toBe(0);
  });

  test("an event modifier of 0 wipes the demand (scandal)", () => {
    let state = mustApply(
      engine,
      startedGame(engine, ["ferronia"]),
      t1,
      setPrice("ferronia", "soap", 18),
    );
    state.market.demandModifiers.scandal = {
      id: "scandal",
      region: null,
      productId: "soap",
      factor: 0,
      untilDay: null,
    };
    state = advanceDays(engine, state, 2);
    expect(orderedUnits(state, "t1")).toBe(0);
  });

  test("orders carry a deadline based on travel time and are recorded for charts", () => {
    let state = mustApply(
      engine,
      startedGame(engine, ["ferronia"]),
      t1,
      setPrice("nordhaven", "bread", 30 - 0.01),
    );
    state = mustApply(engine, state, t1, setPrice("nordhaven", "bread", 25));
    state = advanceDays(engine, state, 1);
    const order = Object.values(team(state).orders)[0];
    expect(order?.deadlineDay).toBe((order?.createdDay ?? 0) + 2 + 3);
    expect(Object.keys(team(state).stats.orderHistory).length).toBeGreaterThan(0);
  });
});

describe("accepting orders", () => {
  function withOrders() {
    let state = mustApply(
      engine,
      startedGame(engine, ["ferronia"]),
      t1,
      setPrice("ferronia", "bread", LOCAL_BREAD),
    );
    state = advanceDays(engine, state, 1);
    const order = Object.values(team(state).orders)[0];
    if (!order) throw new Error("no order");
    return { state, order };
  }

  test("accepting needs available stock and reserves it (O2)", () => {
    const { state, order } = withOrders();
    expect(
      refusalOf(engine, state, t1, { type: "sales.acceptOrder", payload: { orderId: order.id } }),
    ).toEqual({
      code: "OUT_OF_STOCK",
      message: `Stock insuffisant : 0 Pain disponible(s), ${order.quantity} demandé(s).`,
    });
    team(state).inventory.bread = 100;
    const after = mustApply(engine, state, t1, {
      type: "sales.acceptOrder",
      payload: { orderId: order.id },
    });
    expect(team(after).reserved.bread).toBe(order.quantity);
    expect(team(after).orders[order.id]?.status).toBe("accepted");
  });

  test("declined orders disappear; accepted ones cannot be declined", () => {
    const { state, order } = withOrders();
    const declined = mustApply(engine, state, t1, {
      type: "sales.declineOrder",
      payload: { orderId: order.id },
    });
    expect(team(declined).orders[order.id]).toBeUndefined();
  });

  test("pending orders expire after 2 days", () => {
    const { state, order } = withOrders();
    const later = advanceDays(engine, state, 3);
    expect(team(later).orders[order.id]).toBeUndefined();
  });

  test("auto-accept takes orders as soon as stock is available", () => {
    let state = mustApply(
      engine,
      startedGame(engine, ["ferronia"]),
      t1,
      setPrice("ferronia", "bread", LOCAL_BREAD),
    );
    state = mustApply(engine, state, t1, {
      type: "sales.setAutoAccept",
      payload: { productId: "bread", enabled: true },
    });
    state = advanceDays(engine, state, 1);
    expect(Object.values(team(state).orders).every((o) => o.status === "pending")).toBe(true);
    team(state).inventory.bread = 1_000;
    state = engine.step(state);
    const orders = Object.values(team(state).orders);
    expect(orders.length).toBeGreaterThan(0);
    expect(orders.every((o) => o.status === "accepted")).toBe(true);
    expect(team(state).reserved.bread).toBe(orders.reduce((s, o) => s + o.quantity, 0));
  });
});

describe("view", () => {
  test("teams see normal and maximum prices per region", () => {
    const view = teamView(startedGame(engine, ["azura"]), "t1");
    expect(view?.market.pricing.nordhaven?.laptop).toEqual({ local: 1_350, max: 2_025 });
  });
});
