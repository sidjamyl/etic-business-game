import { describe, expect, test } from "bun:test";
import {
  financeRules,
  materialSupplierById,
  materialSuppliers,
  productIds,
  regionIds,
} from "@etic/content";
import { gameEngine as engine } from "../index.ts";
import { nextFloat, nextInt, seedRng } from "../rng.ts";
import { advanceDays, memberOf, mustApply, refusalOf, startedGame } from "../testkit.ts";
import type { Command, GameState, TeamState } from "../types.ts";
import { credits } from "./shared.ts";

const t1 = memberOf("t1");
const borrow = (amount: number) => ({ type: "finance.borrow", payload: { amount } });
const repay = (amount: number) => ({ type: "finance.repay", payload: { amount } });

function team(state: GameState, id = "t1"): TeamState {
  const found = state.teams[id];
  if (!found) throw new Error("no team");
  return found;
}

describe("ledger", () => {
  test("every movement is recorded with its category", () => {
    let state = startedGame(engine, ["azura"]);
    state = mustApply(engine, state, t1, {
      type: "purchase.buyMaterial",
      payload: { supplierId: "moulins-azura", quantity: 10 },
    });
    const finance = team(state).finance;
    const cost = -10 * (materialSupplierById.get("moulins-azura")?.price ?? 0);
    expect(finance.totals).toEqual({ other: 50_000, purchases: cost });
    expect(finance.ledger.at(-1)).toMatchObject({ category: "purchases", amount: cost, day: 1 });
  });
});

describe("loans", () => {
  test("borrowing adds cash and debt, up to the ₢30 000 ceiling", () => {
    let state = mustApply(engine, startedGame(engine, ["azura"]), t1, borrow(20_000));
    expect(team(state).cash).toBe(70_000);
    expect(team(state).finance).toMatchObject({ debt: 20_000, principal: 20_000 });
    expect(refusalOf(engine, state, t1, borrow(15_000))).toEqual({
      code: "LOAN_LIMIT",
      message: `Plafond d'emprunt : vous pouvez encore emprunter ${credits(10_000)}.`,
    });
    state = mustApply(engine, state, t1, borrow(10_000));
    expect(refusalOf(engine, state, t1, borrow(1_000))?.message).toBe("Plafond d'emprunt atteint.");
  });

  test("loans start at ₢1 000", () => {
    expect(refusalOf(engine, startedGame(engine, ["azura"]), t1, borrow(500))?.code).toBe(
      "INVALID_PAYLOAD",
    );
  });

  test("3% interest is charged every 30 days", () => {
    let state = mustApply(engine, startedGame(engine, ["azura"]), t1, borrow(10_000));
    state = advanceDays(engine, state, 30);
    expect(team(state).cash).toBe(60_000 - 300);
    expect(team(state).finance.totals.interest).toBe(-300);
  });

  test("unpaid interest is added to the debt, even beyond the ceiling", () => {
    let state = mustApply(engine, startedGame(engine, ["azura"]), t1, borrow(financeRules.loanCap));
    team(state).cash = 0;
    state = advanceDays(engine, state, 30);
    expect(team(state).finance.debt).toBe(30_900);
    expect(team(state).cash).toBe(0);
  });

  test("repaying reduces the debt; overpaying or repaying without cash is refused", () => {
    let state = mustApply(engine, startedGame(engine, ["azura"]), t1, borrow(5_000));
    expect(refusalOf(engine, state, t1, repay(6_000))?.message).toBe(
      `Vous ne devez que ${credits(5_000)}.`,
    );
    state = mustApply(engine, state, t1, repay(2_000));
    expect(team(state).finance).toMatchObject({ debt: 3_000, principal: 3_000 });
    team(state).cash = 100;
    expect(refusalOf(engine, state, t1, repay(3_000))?.code).toBe("INSUFFICIENT_FUNDS");
  });

  test("repaying capitalized interest first frees borrowing capacity last", () => {
    let state = mustApply(engine, startedGame(engine, ["azura"]), t1, borrow(10_000));
    team(state).finance.debt = 10_300; // 300 of capitalized interest
    state = mustApply(engine, state, t1, repay(300));
    expect(team(state).finance).toMatchObject({ debt: 10_000, principal: 10_000 });
    state = mustApply(engine, state, t1, repay(4_000));
    expect(team(state).finance.principal).toBe(6_000);
  });

  test("without debt there is nothing to repay", () => {
    expect(refusalOf(engine, startedGame(engine, ["azura"]), t1, repay(10))?.message).toBe(
      "Vous n'avez aucune dette.",
    );
  });
});

describe("invariants over a randomized game", () => {
  test("cash never goes negative and always equals the sum of the ledger", () => {
    const rng = seedRng("chaos");
    let state = startedGame(engine, ["azura", "ferronia", "nordhaven", "port-libre"]);
    const pick = <T>(items: readonly T[]): T => items[nextInt(rng, 0, items.length - 1)] as T;
    const randomCommand = (teamState: TeamState): Command => {
      const roll = nextFloat(rng);
      if (roll < 0.25) {
        return {
          type: "purchase.buyMaterial",
          payload: { supplierId: pick(materialSuppliers).id, quantity: nextInt(rng, 1, 200) },
        };
      }
      if (roll < 0.35)
        return {
          type: "hr.hire",
          payload: { job: pick(["operator", "logistician"]), count: nextInt(rng, 1, 3) },
        };
      if (roll < 0.5) {
        return {
          type: "sales.setPrice",
          payload: {
            region: pick(regionIds),
            productId: pick(productIds),
            price: nextInt(rng, 5, 60),
          },
        };
      }
      if (roll < 0.55) return borrow(nextInt(rng, 1, 10) * 1_000);
      if (roll < 0.58) {
        return {
          type: "blackMarket.buy",
          payload: { material: pick(["flour", "metal"]), quantity: nextInt(rng, 1, 30) },
        };
      }
      if (roll < 0.6) {
        return {
          type: "blackMarket.accuse",
          payload: { targetTeamId: pick(["t1", "t2", "t3", "t4"]) },
        };
      }
      if (roll < 0.66) return repay(nextInt(rng, 100, 5_000));
      if (roll < 0.68) {
        return {
          type: "transfer.money",
          payload: { toTeamId: pick(["t1", "t2", "t3", "t4"]), amount: nextInt(rng, 1, 3_000) },
        };
      }
      if (roll < 0.7) {
        const offer = Object.values(teamState.id ? stateRef.trades.offers : {}).find(
          (o) => o.buyerId === teamState.id,
        );
        return offer
          ? { type: "trade.accept", payload: { offerId: offer.id } }
          : {
              type: "trade.offer",
              payload: {
                buyerTeamId: pick(["t1", "t2", "t3", "t4"]),
                good: { kind: "item", item: "flour", quantity: nextInt(rng, 1, 50) },
                price: nextInt(rng, 0, 2_000),
                option: "standard",
                shippingPaidBy: pick(["seller", "buyer"]),
              },
            };
      }
      if (roll < 0.8) {
        const order = Object.values(teamState.orders)[0];
        return order
          ? { type: "delivery.ship", payload: { orderId: order.id, option: "standard" } }
          : { type: "warehouse.expand" };
      }
      const pending = Object.values(teamState.orders).find((o) => o.status === "pending");
      return pending
        ? { type: "sales.acceptOrder", payload: { orderId: pending.id } }
        : { type: "sales.setAutoAccept", payload: { productId: pick(productIds), enabled: true } };
    };
    const stateRef = { trades: state.trades };
    for (let i = 0; i < 4 * 120; i++) {
      stateRef.trades = state.trades;
      for (const teamId of Object.keys(state.teams)) {
        if (nextFloat(rng) < 0.5) {
          const result = engine.applyCommand(
            state,
            memberOf(teamId),
            randomCommand(team(state, teamId)),
          );
          if (result.ok) state = result.state;
        }
      }
      state = engine.step(state);
      for (const company of Object.values(state.teams)) {
        expect(company.cash).toBeGreaterThanOrEqual(0);
        expect(company.reservedCash).toBeGreaterThanOrEqual(0);
        expect(company.reservedCash).toBeLessThanOrEqual(company.cash);
        const total = Object.values(company.finance.totals).reduce((s, v) => s + (v ?? 0), 0);
        expect(Math.round(total)).toBe(Math.round(company.cash));
        for (const [product, reserved] of Object.entries(company.reserved)) {
          expect(reserved ?? 0).toBeLessThanOrEqual(company.inventory[product as never] ?? 0);
        }
      }
    }
  });
});
