import { describe, expect, test } from "bun:test";
import { materialSupplierById, travelDays, warehouseRules } from "@etic/content";
import { gameEngine as engine } from "../index.ts";
import { advanceDays, memberOf, mustApply, ORGANIZER, refusalOf, startedGame } from "../testkit.ts";
import { teamView } from "../views.ts";

const t1 = memberOf("t1");
const t2 = memberOf("t2");
const buy = (supplierId: string, quantity: number) => ({
  type: "purchase.buyMaterial",
  payload: { supplierId, quantity },
});

describe("buying materials", () => {
  test("pays now, reserves the shared stock and schedules the delivery (R4)", () => {
    const state = startedGame(engine, ["azura", "nordhaven"]);
    const supplier = materialSupplierById.get("moulins-azura");
    if (!supplier) throw new Error("missing supplier");
    const after = mustApply(engine, state, t1, buy("moulins-azura", 100));
    expect(after.teams.t1?.cash).toBe(50_000 - 100 * supplier.price);
    expect(after.market.suppliers["moulins-azura"]?.stock).toBe(supplier.restock.level - 100);
    const [shipment] = Object.values(after.teams.t1?.inbound ?? {});
    expect(shipment).toMatchObject({
      kind: "material",
      item: "flour",
      quantity: 100,
      arrivesOnDay: 1 + supplier.handlingDays + travelDays("azura", "azura"),
    });
    expect(after.teams.t1?.log.at(-1)?.actor).toBe("Joueur t1");
  });

  test("distance lengthens the delivery and Ferronia buyers pay 10% less (R3)", () => {
    const state = startedGame(engine, ["nordhaven", "ferronia"]);
    const fromNord = mustApply(engine, state, t1, buy("moulins-azura", 10));
    expect(Object.values(fromNord.teams.t1?.inbound ?? {})[0]?.arrivesOnDay).toBe(1 + 1 + 4);
    const fromFerro = mustApply(engine, state, t2, buy("moulins-azura", 10));
    const unit = materialSupplierById.get("moulins-azura")?.price ?? 0;
    expect(50_000 - (fromFerro.teams.t2?.cash ?? 0)).toBe(Math.round(10 * unit * 0.9));
  });

  test("the stock is shared: what one team buys, the others cannot", () => {
    const state = startedGame(engine, ["azura", "azura"]);
    const level = materialSupplierById.get("nordtech")?.restock.level ?? 0;
    const after = mustApply(engine, state, t1, buy("nordtech", level));
    expect(refusalOf(engine, after, t2, buy("nordtech", 1))).toEqual({
      code: "OUT_OF_STOCK",
      message: "Nordtech Composants est en rupture de stock.",
    });
    expect(teamView(after, "t2")?.market.suppliers.nordtech?.stock).toBe(0);
    expect(JSON.stringify(teamView(after, "t2"))).not.toContain("in-");
  });

  test("asking for more than the stock tells what is left", () => {
    const state = startedGame(engine, ["azura"]);
    const level = materialSupplierById.get("nordtech")?.restock.level ?? 0;
    expect(refusalOf(engine, state, t1, buy("nordtech", level + 1))).toEqual({
      code: "OUT_OF_STOCK",
      message: `Stock insuffisant chez Nordtech Composants : il reste ${level}.`,
    });
  });

  test("insufficient cash is refused and nothing changes", () => {
    const state = startedGame(engine, ["azura"]);
    const refusal = refusalOf(engine, state, t1, buy("nordtech", 60)); // 2 700, fine
    expect(refusal).toBeNull();
    const poor = structuredClone(state);
    if (poor.teams.t1) poor.teams.t1.cash = 10;
    expect(refusalOf(engine, poor, t1, buy("nordtech", 1))?.code).toBe("INSUFFICIENT_FUNDS");
  });

  test("invalid quantities are refused", () => {
    const state = startedGame(engine, ["azura"]);
    expect(refusalOf(engine, state, t1, buy("moulins-azura", 0))?.code).toBe("INVALID_PAYLOAD");
    expect(refusalOf(engine, state, t1, buy("moulins-azura", 1.5))?.code).toBe("INVALID_PAYLOAD");
    expect(refusalOf(engine, state, t1, buy("nope", 1))?.code).toBe("NOT_FOUND");
  });

  test("purchases are blocked during a pause (O1)", () => {
    const paused = mustApply(engine, startedGame(engine, ["azura"]), ORGANIZER, {
      type: "control.pause",
    });
    expect(refusalOf(engine, paused, t1, buy("moulins-azura", 1))?.code).toBe("GAME_PAUSED");
  });
});

describe("arrivals and warehouse", () => {
  test("goods enter the warehouse on their arrival day", () => {
    let state = mustApply(engine, startedGame(engine, ["azura"]), t1, buy("moulins-azura", 100));
    state = advanceDays(engine, state, 1); // arrives on day 3 (1 + 1 handling + 1 travel)
    expect(state.teams.t1?.inventory.flour).toBeUndefined();
    state = advanceDays(engine, state, 1);
    expect(state.teams.t1?.inventory.flour).toBe(100);
    expect(state.teams.t1?.inbound).toEqual({});
    expect(teamView(state, "t1")?.warehouseUsed).toBe(100);
  });

  test("a full warehouse makes arrivals wait without loss (R9)", () => {
    let state = startedGame(engine, ["ferronia"]);
    (state.teams.t1 as { warehouse: { capacity: number } }).warehouse.capacity = 500;
    state = mustApply(engine, state, t1, buy("farines-ferro", 400));
    state = mustApply(engine, state, t1, buy("aquaferr", 200));
    state = advanceDays(engine, state, 3);
    // Water (no handling time) arrives first; the 400 flour no longer fits in 500 units.
    const team = state.teams.t1;
    expect(team?.inventory.water).toBe(200);
    expect(team?.inventory.flour).toBeUndefined();
    expect(Object.values(team?.inbound ?? {})[0]).toMatchObject({
      item: "flour",
      status: "waiting-space",
    });
    // Free some space: the waiting shipment comes in at the next step.
    if (team) team.inventory.water = 50;
    state = engine.step(state);
    expect(state.teams.t1?.inventory.flour).toBe(400);
  });

  test("an expansion adds capacity after its construction delay", () => {
    let state = mustApply(engine, startedGame(engine, ["azura"]), t1, {
      type: "warehouse.expand",
    });
    expect(state.teams.t1?.cash).toBe(50_000 - warehouseRules.expansionCost);
    expect(refusalOf(engine, state, t1, { type: "warehouse.expand" })?.code).toBe(
      "ALREADY_IN_PROGRESS",
    );
    state = advanceDays(engine, state, warehouseRules.expansionDays - 1);
    expect(state.teams.t1?.warehouse.capacity).toBe(warehouseRules.initialCapacity);
    state = advanceDays(engine, state, 1);
    expect(state.teams.t1?.warehouse).toEqual({
      capacity: warehouseRules.initialCapacity + warehouseRules.expansionCapacity,
      expansion: null,
    });
  });
});

describe("restocking", () => {
  test("suppliers are restocked to their level every 7 days", () => {
    const level = materialSupplierById.get("moulins-azura")?.restock.level ?? 0;
    let state = mustApply(engine, startedGame(engine, ["azura"]), t1, buy("moulins-azura", 300));
    expect(state.market.suppliers["moulins-azura"]?.stock).toBe(level - 300);
    state = advanceDays(engine, state, 6);
    expect(state.market.suppliers["moulins-azura"]?.stock).toBe(level - 300);
    state = advanceDays(engine, state, 1);
    expect(state.market.suppliers["moulins-azura"]).toMatchObject({
      stock: level,
      nextRestockDay: 15,
    });
  });
});

describe("machines", () => {
  test("a bought machine arrives new and reduces the supplier's stock", () => {
    let state = startedGame(engine, ["ferronia"]);
    state = mustApply(engine, state, t1, {
      type: "purchase.buyMachine",
      payload: { supplierId: "ferro-machines", machineTypeId: "oven" },
    });
    expect(state.teams.t1?.cash).toBe(50_000 - 7_200); // 8 000 × 0.9 in Ferronia
    expect(state.market.equipment["ferro-machines"]?.stock.oven).toBe(2);
    state = advanceDays(engine, state, 4); // 3 handling + 1 travel
    const machines = Object.values(state.teams.t1?.machines ?? {});
    expect(machines).toHaveLength(1);
    expect(machines[0]).toMatchObject({ typeId: "oven", efficiency: 1, status: "idle" });
  });

  test("machines can run out", () => {
    let state = startedGame(engine, ["azura"]);
    const order = {
      type: "purchase.buyMachine",
      payload: { supplierId: "nordic-equipment", machineTypeId: "bottling-line" },
    };
    state = mustApply(engine, state, t1, order);
    state = mustApply(engine, state, t1, order);
    expect(refusalOf(engine, state, t1, order)?.code).toBe("OUT_OF_STOCK");
  });
});

describe("market view", () => {
  test("each team sees its own prices and delivery times", () => {
    const state = startedGame(engine, ["azura", "ferronia"]);
    const unit = materialSupplierById.get("moulins-azura")?.price ?? 0;
    expect(teamView(state, "t1")?.market.suppliers["moulins-azura"]).toMatchObject({
      unitPrice: unit,
      deliveryDays: 2,
    });
    expect(teamView(state, "t2")?.market.suppliers["moulins-azura"]).toMatchObject({
      unitPrice: Math.round(unit * 0.9 * 100) / 100,
      deliveryDays: 3,
    });
  });
});
