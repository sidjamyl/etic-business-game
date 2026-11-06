import { describe, expect, test } from "bun:test";
import { regionIds } from "@etic/content";
import type { CustomerOrder } from "@etic/engine";
import {
  countAcceptable,
  daysUntilEndOf,
  deadlineLabel,
  deadlineState,
  expiryLabel,
  formatPriceInput,
  groupOrders,
  isProductId,
  isRegionId,
  niceCeil,
  type OrderHistory,
  orderBook,
  orderValue,
  parseComboKey,
  parsePriceInput,
  plural,
  pricePosition,
  productLock,
  reputationLevel,
  sellsAnywhere,
} from "./sales.ts";

function order(overrides: Partial<CustomerOrder> & { id: string }): CustomerOrder {
  return {
    productId: "bread",
    region: "azura",
    quantity: 40,
    unitPrice: 25,
    createdDay: 10,
    expiresOnDay: 12,
    deadlineDay: 14,
    status: "pending",
    ...overrides,
  };
}

describe("price input", () => {
  test("accepts French and English decimals, spaces and the currency sign", () => {
    expect(parsePriceInput("23,5")).toEqual({ kind: "price", value: 23.5 });
    expect(parsePriceInput("23.50")).toEqual({ kind: "price", value: 23.5 });
    expect(parsePriceInput("₢ 1 200,75")).toEqual({ kind: "price", value: 1200.75 });
    expect(parsePriceInput("12,345")).toEqual({ kind: "price", value: 12.35 });
  });

  test("an empty field means not selling", () => {
    expect(parsePriceInput("")).toEqual({ kind: "empty" });
    expect(parsePriceInput("  ")).toEqual({ kind: "empty" });
  });

  test("refuses what the engine would refuse", () => {
    for (const text of ["0", "0,001", "-5", "abc", "1.000,50", "2000000"]) {
      expect(parsePriceInput(text).kind).toBe("invalid");
    }
  });

  test("formats a price for editing", () => {
    expect(formatPriceInput(31)).toBe("31");
    expect(formatPriceInput(23.25)).toBe("23,25");
    expect(formatPriceInput(23.5)).toBe("23,50");
  });
});

describe("price position", () => {
  const hint = { local: 31, max: 46.5 };

  test("no demand at or above the maximum price", () => {
    expect(pricePosition(46.5, hint)).toEqual({ kind: "no-demand" });
    expect(pricePosition(60, hint)).toEqual({ kind: "no-demand" });
  });

  test("relative to the local price", () => {
    expect(pricePosition(31, hint)).toEqual({ kind: "local" });
    expect(pricePosition(31.1, hint)).toEqual({ kind: "local" });
    const above = pricePosition(34.1, hint);
    expect(above.kind).toBe("above");
    if (above.kind === "above") expect(above.ratio).toBeCloseTo(0.1);
    const below = pricePosition(27.9, hint);
    expect(below.kind).toBe("below");
    if (below.kind === "below") expect(below.ratio).toBeCloseTo(0.1);
  });

  test("selling anywhere needs at least one price", () => {
    expect(sellsAnywhere({})).toBe(false);
    expect(sellsAnywhere({ azura: {} })).toBe(false);
    expect(sellsAnywhere({ azura: { bread: 25 } })).toBe(true);
  });
});

describe("product lock", () => {
  test("follows the unlocked tier and the tier-3 branch", () => {
    expect(productLock("bread", { unlockedTier: 1, branch: null })).toBeNull();
    expect(productLock("clothing", { unlockedTier: 1, branch: null })).toBe(
      "Palier 2 non débloqué",
    );
    expect(productLock("laptop", { unlockedTier: 2, branch: null })).toBe("Palier 3 non débloqué");
    expect(productLock("laptop", { unlockedTier: 3, branch: "tech" })).toBeNull();
    expect(productLock("console", { unlockedTier: 3, branch: "tech" })).toBe(
      "Branche Loisirs fermée",
    );
  });
});

describe("reputation", () => {
  test("is described in words", () => {
    expect(reputationLevel(90).label).toBe("Excellente");
    expect(reputationLevel(60).label).toBe("Bonne");
    expect(reputationLevel(50)).toEqual({ label: "Moyenne", tone: "default" });
    expect(reputationLevel(25).tone).toBe("warning");
    expect(reputationLevel(5).tone).toBe("danger");
  });
});

describe("orders", () => {
  test("value is paid on delivery, rounded like the engine", () => {
    expect(orderValue({ quantity: 3, unitPrice: 23.25 })).toBe(70);
  });

  test("expiry counts down to the end of the last day", () => {
    expect(daysUntilEndOf(12, { day: 10, step: 0 }, 4)).toBe(3);
    expect(daysUntilEndOf(12, { day: 12, step: 2 }, 4)).toBe(0.5);
    expect(daysUntilEndOf(12, { day: 13, step: 0 }, 4)).toBe(0);
    expect(expiryLabel(12, 10)).toBe("Expire dans 2 j");
    expect(expiryLabel(12, 11)).toBe("Expire demain");
    expect(expiryLabel(12, 12)).toBe("Dernier jour");
  });

  test("deadline: on time, then late until the order is cancelled", () => {
    expect(deadlineState(14, 12)).toEqual({ kind: "on-time", daysLeft: 2 });
    expect(deadlineLabel(deadlineState(14, 14))).toBe("Aujourd'hui");
    expect(deadlineLabel(deadlineState(14, 13))).toBe("Demain");
    const late = deadlineState(14, 16);
    expect(late).toEqual({ kind: "late", daysLate: 2, cancelAfterDay: 19 });
    expect(deadlineLabel(late)).toBe("En retard de 2 j");
  });

  test("the order book sorts the inbox by urgency and sums what is to collect", () => {
    const book = orderBook(
      {
        a: order({ id: "o-10", expiresOnDay: 13 }),
        b: order({ id: "o-9", expiresOnDay: 12 }),
        c: order({ id: "o-2", status: "accepted", deadlineDay: 15, quantity: 10 }),
        d: order({ id: "o-3", status: "shipping", deadlineDay: 11, quantity: 2 }),
      },
      12,
    );
    expect(book.pending.map((o) => o.id)).toEqual(["o-9", "o-10"]);
    expect(book.toDeliver.map((o) => o.id)).toEqual(["o-3", "o-2"]);
    expect(book.toShip).toBe(1);
    expect(book.late).toBe(1);
    expect(book.toCollect).toBe(300);
  });

  test("acceptable orders share the stock, most urgent first", () => {
    const pending = [
      order({ id: "o-1", quantity: 40, expiresOnDay: 12 }),
      order({ id: "o-2", quantity: 30, expiresOnDay: 13 }),
      order({ id: "o-3", quantity: 10, expiresOnDay: 13 }),
      order({ id: "o-4", productId: "soap", quantity: 10 }),
    ];
    const stock = { bread: 50, soap: 5 } as Record<string, number>;
    expect(countAcceptable(pending, (id) => stock[id] ?? 0)).toBe(2);
  });
});

describe("order history", () => {
  const history: OrderHistory = {
    "5": { "azura:bread": 40, "nordhaven:bread": 10, "azura:soap": 20 },
    "6": { "ferronia:soap": 5, "bad-key": 3 },
    "9": { "azura:bread": 99 },
  };
  const all = { fromDay: 4, toDay: 6, productId: null, regions: regionIds };

  test("history keys are region:product", () => {
    expect(parseComboKey("port-libre:bottled-water")).toEqual({
      region: "port-libre",
      productId: "bottled-water",
    });
    expect(parseComboKey("bad-key")).toBeNull();
    expect(isRegionId("nordhaven")).toBe(true);
    expect(isProductId("nordhaven")).toBe(false);
  });

  test("by region: every region, every day of the period", () => {
    const grouped = groupOrders(history, all, "region");
    expect(grouped.days).toEqual([4, 5, 6]);
    expect(grouped.series.map((line) => line.key)).toEqual([...regionIds]);
    const azura = grouped.series[0];
    expect(azura).toMatchObject({ label: "Azura", units: [0, 60, 0], total: 60 });
    expect(grouped.series[2]).toMatchObject({ key: "ferronia", units: [0, 0, 5] });
    expect(grouped.peak).toBe(60);
  });

  test("by region, for one product", () => {
    const grouped = groupOrders(history, { ...all, productId: "bread" }, "region");
    expect(grouped.series[0]?.units).toEqual([0, 40, 0]);
    expect(grouped.series[2]?.total).toBe(0);
  });

  test("by product: only products ordered in the period, in catalog order", () => {
    const grouped = groupOrders(history, all, "product");
    expect(grouped.series.map((line) => line.key)).toEqual(["bread", "soap"]);
    expect(grouped.series[0]).toMatchObject({ label: "Pain", units: [0, 50, 0] });
    expect(grouped.series[1]).toMatchObject({ units: [0, 20, 5], total: 25 });
  });

  test("by product, for one region", () => {
    const grouped = groupOrders(history, { ...all, regions: ["nordhaven"] }, "product");
    expect(grouped.series.map((line) => line.key)).toEqual(["bread"]);
    expect(grouped.peak).toBe(10);
    expect(groupOrders(history, { ...all, regions: ["port-libre"] }, "product").series).toEqual([]);
  });

  test("axis maximum and wording", () => {
    expect(niceCeil(0)).toBe(0);
    expect(niceCeil(1)).toBe(1);
    expect(niceCeil(7)).toBe(8);
    expect(niceCeil(37)).toBe(40);
    expect(niceCeil(120)).toBe(150);
    expect(niceCeil(900)).toBe(1000);
    expect(plural(1, "commande", "commandes")).toBe("1 commande");
    expect(plural(0, "commande", "commandes")).toBe("0 commande");
    expect(plural(3, "commande", "commandes")).toBe("3 commandes");
  });
});
