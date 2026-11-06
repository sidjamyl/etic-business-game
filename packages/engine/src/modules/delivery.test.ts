import { describe, expect, test } from "bun:test";
import type { ProductId, RegionId } from "@etic/content";
import { gameEngine as engine } from "../index.ts";
import { allocateId } from "../log.ts";
import { advanceDays, memberOf, mustApply, refusalOf, startedGame } from "../testkit.ts";
import type { GameState, TeamState } from "../types.ts";
import { teamView } from "../views.ts";
import { shippingCost, shippingDays } from "./delivery.ts";

const t1 = memberOf("t1");

function team(state: GameState): TeamState {
  const found = state.teams.t1;
  if (!found) throw new Error("no team");
  return found;
}

/** A started company with logisticians at work and an accepted order already reserved. */
function withAcceptedOrder(
  options: {
    home?: RegionId;
    destination?: RegionId;
    logisticians?: number;
    quantity?: number;
    productId?: ProductId;
  } = {},
) {
  let state = startedGame(engine, [options.home ?? "ferronia"]);
  if ((options.logisticians ?? 1) > 0) {
    state = mustApply(engine, state, t1, {
      type: "hr.hire",
      payload: { job: "logistician", count: options.logisticians ?? 1 },
    });
  }
  state = advanceDays(engine, state, 2);
  const company = team(state);
  const quantity = options.quantity ?? 30;
  const productId = options.productId ?? "bread";
  const id = `o-${allocateId(state)}`;
  company.inventory[productId] = 100;
  company.reserved[productId] = quantity;
  const destination = options.destination ?? "ferronia";
  company.orders[id] = {
    id,
    productId,
    region: destination,
    quantity,
    unitPrice: 20,
    createdDay: state.time.day,
    expiresOnDay: state.time.day + 2,
    deadlineDay: state.time.day + 4,
    status: "accepted",
  };
  return { state, orderId: id };
}

const ship = (orderId: string, option = "standard") => ({
  type: "delivery.ship",
  payload: { orderId, option },
});

describe("costs and durations (N11)", () => {
  test("cost = ₢20 + rate × units × travel days, Port-Libre pays 30% less", () => {
    expect(shippingCost("standard", 30, "ferronia", "nordhaven")).toBe(20 + 24);
    expect(shippingCost("express", 30, "ferronia", "nordhaven")).toBe(20 + 72);
    expect(shippingCost("green", 30, "ferronia", "nordhaven")).toBe(20 + 36);
    expect(shippingCost("standard", 30, "port-libre", "nordhaven")).toBe(Math.round(56 * 0.7));
  });

  test("express halves, green adds half, at least one day", () => {
    expect(shippingDays("standard", "azura", "nordhaven")).toBe(4);
    expect(shippingDays("express", "azura", "nordhaven")).toBe(2);
    expect(shippingDays("green", "azura", "nordhaven")).toBe(6);
    expect(shippingDays("express", "azura", "azura")).toBe(1);
  });
});

describe("shipping", () => {
  test("pays the shipping now; goods leave when prepared and are paid on arrival", () => {
    const { state, orderId } = withAcceptedOrder();
    const cash = team(state).cash;
    let after = mustApply(engine, state, t1, ship(orderId));
    expect(team(after).cash).toBe(cash - 32); // 20 + 0.4 × 30 × 1
    expect(team(after).orders[orderId]?.status).toBe("shipping");
    after = engine.step(after);
    expect(team(after).inventory.bread).toBe(70);
    expect(team(after).reserved.bread).toBeUndefined();
    expect(Object.values(team(after).shipments)[0]?.status).toBe("in-transit");
    after = advanceDays(engine, after, 1);
    expect(team(after).orders[orderId]).toBeUndefined();
    expect(team(after).cash).toBe(cash - 32 + 600);
    expect(team(after).stats.sold.bread).toBe(30);
    expect(team(after).reputation).toBe(51);
    expect(team(after).stats.shippedUnits.standard).toBe(30);
  });

  test("only accepted orders can ship, and only once", () => {
    const { state, orderId } = withAcceptedOrder();
    const shipped = mustApply(engine, state, t1, ship(orderId));
    expect(refusalOf(engine, shipped, t1, ship(orderId))?.code).toBe("ALREADY_IN_PROGRESS");
    const order = team(state).orders[orderId];
    if (order) order.status = "pending";
    expect(refusalOf(engine, state, t1, ship(orderId))?.message).toBe(
      "Acceptez d'abord la commande.",
    );
  });

  test("without logisticians shipments wait in the queue", () => {
    const { state, orderId } = withAcceptedOrder({ logisticians: 0 });
    const after = advanceDays(engine, mustApply(engine, state, t1, ship(orderId)), 1);
    expect(Object.values(team(after).shipments)[0]?.status).toBe("queued");
    expect(teamView(after, "t1")?.logisticsCapacity).toBe(0);
  });

  test("one logistician prepares at most 5 shipments per day", () => {
    let { state } = withAcceptedOrder({ quantity: 1 });
    const company = team(state);
    company.inventory.bread = 100;
    company.reserved.bread = 7;
    const base = Object.values(company.orders)[0];
    if (!base) throw new Error("no order");
    for (let i = 0; i < 6; i++) {
      const id = `o-extra-${i}`;
      company.orders[id] = { ...base, id };
    }
    for (const id of Object.keys(company.orders)) state = mustApply(engine, state, t1, ship(id));
    state = engine.step(state);
    const statuses = Object.values(team(state).shipments).map((s) => s.status);
    expect(statuses.filter((s) => s === "in-transit")).toHaveLength(5);
    expect(statuses.filter((s) => s === "queued")).toHaveLength(2);
  });

  test("a late delivery is paid 20% less and costs reputation", () => {
    const { state, orderId } = withAcceptedOrder({ destination: "nordhaven" });
    const order = team(state).orders[orderId];
    if (order) order.deadlineDay = state.time.day; // impossible to make it in time
    const cash = team(state).cash;
    let after = mustApply(engine, state, t1, ship(orderId, "green"));
    after = advanceDays(engine, after, 4);
    expect(team(after).cash).toBe(cash - 56 + 480);
    expect(team(after).reputation).toBe(47);
    expect(team(after).stats.lateDeliveries).toBe(1);
  });

  test("an accepted order not shipped 5 days after its deadline is cancelled", () => {
    const { state, orderId } = withAcceptedOrder();
    const deadline = team(state).orders[orderId]?.deadlineDay ?? 0;
    let after = advanceDays(engine, state, deadline + 5 - state.time.day);
    expect(team(after).orders[orderId]).toBeDefined();
    after = advanceDays(engine, after, 1);
    expect(team(after).orders[orderId]).toBeUndefined();
    expect(team(after).reserved.bread).toBeUndefined();
    expect(team(after).reputation).toBe(42);
    expect(team(after).stats.failedOrders).toBe(1);
  });

  test("a strike stops the preparation of shipments", () => {
    const { state, orderId } = withAcceptedOrder();
    team(state).hr.unpaidWages = 1;
    const after = engine.step(mustApply(engine, state, t1, ship(orderId)));
    expect(Object.values(team(after).shipments)[0]?.status).toBe("queued");
  });
});
