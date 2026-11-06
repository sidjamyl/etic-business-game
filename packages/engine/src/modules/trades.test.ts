import { describe, expect, test } from "bun:test";
import { gameEngine as engine } from "../index.ts";
import { advanceDays, memberOf, mustApply, ORGANIZER, refusalOf, startedGame } from "../testkit.ts";
import type { GameState, TeamState } from "../types.ts";
import { teamView } from "../views.ts";
import { newMachine } from "./shared.ts";

const t1 = memberOf("t1");
const t2 = memberOf("t2");
const t3 = memberOf("t3");

function team(state: GameState, id = "t1"): TeamState {
  const found = state.teams[id];
  if (!found) throw new Error("no team");
  return found;
}

function game() {
  const state = startedGame(engine, ["ferronia", "ferronia", "azura"]);
  team(state).inventory.flour = 200;
  return state;
}

const offer = (extra: Record<string, unknown> = {}) => ({
  type: "trade.offer",
  payload: {
    buyerTeamId: "t2",
    good: { kind: "item", item: "flour", quantity: 100 },
    price: 1_000,
    option: "standard",
    shippingPaidBy: "buyer",
    ...extra,
  },
});

function offerId(state: GameState): string {
  const id = Object.keys(state.trades.offers)[0];
  if (!id) throw new Error("no offer");
  return id;
}

describe("offers", () => {
  test("an accepted offer puts the price in escrow, ships the goods and pays the seller on arrival", () => {
    let state = mustApply(engine, game(), t1, offer());
    const id = offerId(state);
    state = mustApply(engine, state, t2, { type: "trade.accept", payload: { offerId: id } });
    expect(team(state)).toMatchObject({ cash: 50_000, inventory: { flour: 100 } });
    expect(team(state, "t2").cash).toBe(50_000 - 1_000 - 60); // escrow + 20 + 0.4 × 100 × 1
    expect(Object.values(state.trades.shipments)[0]).toMatchObject({
      escrow: 1_000,
      arrivesOnDay: 2,
    });
    state = advanceDays(engine, state, 1);
    expect(team(state).cash).toBe(51_000);
    expect(team(state, "t2").inventory.flour).toBe(100);
    expect(state.trades.shipments).toEqual({});
  });

  test("offers are private to the two companies", () => {
    const state = mustApply(engine, game(), t1, offer());
    expect(teamView(state, "t2")?.trades.offers).toHaveLength(1);
    expect(teamView(state, "t3")?.trades.offers).toHaveLength(0);
  });

  test("only the buyer accepts or declines, only the seller withdraws", () => {
    const state = mustApply(engine, game(), t1, offer());
    const id = offerId(state);
    expect(
      refusalOf(engine, state, t3, { type: "trade.accept", payload: { offerId: id } })?.code,
    ).toBe("NOT_FOUND");
    expect(
      refusalOf(engine, state, t2, { type: "trade.withdraw", payload: { offerId: id } })?.code,
    ).toBe("NOT_FOUND");
    const declined = mustApply(engine, state, t2, {
      type: "trade.decline",
      payload: { offerId: id },
    });
    expect(declined.trades.offers).toEqual({});
  });

  test("offers expire after 5 days", () => {
    const state = advanceDays(engine, mustApply(engine, game(), t1, offer()), 6);
    expect(state.trades.offers).toEqual({});
  });

  test("acceptance fails if the seller no longer has the goods", () => {
    const state = mustApply(engine, game(), t1, offer());
    team(state).inventory.flour = 50;
    expect(
      refusalOf(engine, state, t2, { type: "trade.accept", payload: { offerId: offerId(state) } })
        ?.message,
    ).toBe("Stock disponible insuffisant : 50 Farine.");
  });

  test("the buyer needs the price (and shipping if it pays) in available cash", () => {
    const state = mustApply(engine, game(), t1, offer({ price: 49_990 }));
    expect(
      refusalOf(engine, state, t2, { type: "trade.accept", payload: { offerId: offerId(state) } })
        ?.code,
    ).toBe("INSUFFICIENT_FUNDS");
  });

  test("a machine travels with its efficiency and frees its operators", () => {
    let state = game();
    const machine = newMachine("m1", "oven");
    machine.efficiency = 0.8;
    team(state).machines.m1 = machine;
    state = mustApply(
      engine,
      state,
      t1,
      offer({ good: { kind: "machine", machineId: "m1" }, price: 3_000 }),
    );
    state = mustApply(engine, state, t2, {
      type: "trade.accept",
      payload: { offerId: offerId(state) },
    });
    expect(team(state).machines.m1).toBeUndefined();
    state = advanceDays(engine, state, 1);
    expect(team(state, "t2").machines.m1).toMatchObject({ typeId: "oven", efficiency: 0.8 });
  });
});

describe("transfers", () => {
  test("money moves instantly from available cash", () => {
    const state = mustApply(engine, game(), t1, {
      type: "transfer.money",
      payload: { toTeamId: "t3", amount: 5_000 },
    });
    expect(team(state).cash).toBe(45_000);
    expect(team(state, "t3").cash).toBe(55_000);
    expect(team(state, "t3").finance.totals.transfers).toBe(5_000);
  });

  test("goods can be given away, the sender pays shipping", () => {
    let state = mustApply(engine, game(), t1, {
      type: "transfer.goods",
      payload: {
        toTeamId: "t3",
        good: { kind: "item", item: "flour", quantity: 50 },
        option: "express",
      },
    });
    expect(team(state).cash).toBe(50_000 - 140); // 20 + 1.2 × 50 × 2
    state = advanceDays(engine, state, 1);
    expect(team(state, "t3").inventory.flour).toBe(50);
  });
});

describe("end of game", () => {
  test("contracts still travelling are cancelled and the buyer is refunded", () => {
    let state = mustApply(engine, game(), t1, offer({ option: "green", buyerTeamId: "t3" }));
    state = mustApply(engine, state, t3, {
      type: "trade.accept",
      payload: { offerId: offerId(state) },
    });
    const cashBefore = team(state, "t3").cash;
    state = mustApply(engine, state, ORGANIZER, { type: "control.end" });
    expect(team(state, "t3").cash).toBe(cashBefore + 1_000);
    expect(team(state).cash).toBe(50_000);
    expect(state.trades.shipments).toEqual({});
  });
});
