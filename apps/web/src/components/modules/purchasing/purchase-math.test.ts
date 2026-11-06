import { describe, expect, test } from "bun:test";
import { machineTypeById } from "@etic/content";
import {
  type GameState,
  gameEngine,
  newMachine as machineOf,
  marketView,
  type TeamState,
} from "@etic/engine";
import {
  blockedReason,
  compatibleProducts,
  eventPriceShift,
  exactUnitPrice,
  groupMachineOffers,
  groupOffers,
  hasError,
  lockLabel,
  MAX_ORDER_QUANTITY,
  machineCounts,
  machineOrderMessages,
  machineTypeName,
  matchesSearch,
  materialOrderMessages,
  maxOrderQuantity,
  normalizeSearch,
  orderTotal,
  parseQuantity,
  productLock,
  productsUsing,
  unitPriceLabel,
} from "./purchase-math.ts";

function newGame(): GameState {
  return gameEngine.createGame({
    id: "g-purchase",
    seed: "purchase",
    config: { stepsPerDay: 4, countdownDays: 30 },
    teams: [{ id: "t1", name: "Équipe 1" }],
  });
}

function offersFor(state: GameState, region: "azura" | "ferronia") {
  return Object.values(marketView(state, region).suppliers);
}

function team(progression: Partial<TeamState["progression"]>): TeamState {
  const state = newGame();
  const base = state.teams.t1;
  if (!base) throw new Error("missing team");
  base.progression = { ...base.progression, ...progression };
  return base;
}

describe("supplier list", () => {
  test("groups by material in catalog order, cheapest first", () => {
    const groups = groupOffers(offersFor(newGame(), "azura"), "all", "");
    expect(groups.map((group) => group.material)).toEqual([
      "flour",
      "water",
      "plastic",
      "oil",
      "fabric",
      "vegetables",
      "metal",
      "components",
      "batteries",
    ]);
    const flour = groupOffers(offersFor(newGame(), "azura"), "flour", "");
    expect(flour).toHaveLength(1);
    expect(flour[0]?.offers.map((offer) => offer.id)).toEqual([
      "farines-ferro",
      "moulins-azura",
      "grands-moulins-nordiques",
    ]);
  });

  test("search ignores accents and case and looks at name, region and material", () => {
    expect(normalizeSearch("  Électronique ")).toBe("electronique");
    const offers = offersFor(newGame(), "azura");
    const byName = groupOffers(offers, "all", "moulins");
    expect(byName.flatMap((group) => group.offers.map((offer) => offer.id))).toEqual([
      "moulins-azura",
      "grands-moulins-nordiques",
    ]);
    const accents = groupOffers(offers, "all", "ELECTRONIQUE");
    expect(accents.map((group) => group.material)).toEqual(["components"]);
    expect(accents[0]?.offers.map((offer) => offer.id)).toContain("electronique-port");
    const byMaterial = groupOffers(offers, "all", "farine");
    expect(byMaterial.map((group) => group.material)).toEqual(["flour"]);
    const nordic = offers.filter((offer) => matchesSearch(offer, "NORDHAVEN"));
    expect(nordic.length).toBeGreaterThan(0);
    expect(nordic.every((offer) => offer.region === "nordhaven")).toBe(true);
    expect(groupOffers(offers, "all", "zzz-code-secret")).toEqual([]);
  });

  test("filter and search combine", () => {
    const offers = offersFor(newGame(), "azura");
    expect(groupOffers(offers, "water", "farine")).toEqual([]);
  });
});

describe("prices", () => {
  test("uses the exact regional price the engine charges", () => {
    const water = offersFor(newGame(), "ferronia").find((offer) => offer.id === "aquaferr");
    if (!water) throw new Error("missing supplier");
    expect(water.unitPrice).toBe(0.68);
    expect(exactUnitPrice(water, "ferronia")).toBeCloseTo(0.675, 10);
    expect(orderTotal(exactUnitPrice(water, "ferronia"), 1_000)).toBe(675);
    expect(eventPriceShift(water, "ferronia")).toBe(0);
  });

  test("detects prices changed by events and falls back to the shown price", () => {
    const state = newGame();
    const market = state.market.suppliers["moulins-azura"];
    if (!market) throw new Error("missing supplier");
    market.priceFactor = 1.3;
    const flour = offersFor(state, "azura").find((offer) => offer.id === "moulins-azura");
    if (!flour) throw new Error("missing supplier");
    expect(flour.unitPrice).toBe(3.9);
    expect(exactUnitPrice(flour, "azura")).toBe(3.9);
    expect(eventPriceShift(flour, "azura")).toBeCloseTo(0.3, 5);
  });

  test("unit prices keep the precision the engine charges", () => {
    const clean = (text: string) => text.replace(/\s/g, " ");
    expect(clean(unitPriceLabel(3))).toBe("₢3");
    expect(clean(unitPriceLabel(3.6))).toBe("₢3,60");
    expect(clean(unitPriceLabel(0.675))).toBe("₢0,675");
    expect(clean(unitPriceLabel(1_234.5))).toBe("₢1 234,50");
  });

  test("maximum order is bounded by stock, cash and the engine cap", () => {
    expect(maxOrderQuantity(700, 3, 1_000)).toBe(333);
    expect(maxOrderQuantity(100, 3, 10_000)).toBe(100);
    expect(maxOrderQuantity(1_000_000, 0.675, 1e9)).toBe(MAX_ORDER_QUANTITY);
    expect(maxOrderQuantity(500, 3, 0)).toBe(0);
    expect(maxOrderQuantity(0, 3, 10_000)).toBe(0);
    const quantity = maxOrderQuantity(1_000, 0.675, 100);
    expect(orderTotal(0.675, quantity)).toBeLessThanOrEqual(100);
    expect(orderTotal(0.675, quantity + 1)).toBeGreaterThan(100);
  });

  test("quantities are whole positive numbers", () => {
    expect(parseQuantity("12")).toBe(12);
    expect(parseQuantity(" 7 ")).toBe(7);
    expect(parseQuantity("0")).toBeNull();
    expect(parseQuantity("1.5")).toBeNull();
    expect(parseQuantity("-3")).toBeNull();
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity("abc")).toBeNull();
  });
});

describe("explicit refusals", () => {
  const clean = (text: string) => text.replace(/\s/g, " ");
  const order = {
    text: "",
    quantity: null,
    supplierName: "PolyFerr",
    stock: 300,
    nextRestockDay: 8,
    total: 0,
    cash: 1_000,
    room: 500,
  };

  test("an empty quantity says nothing; a wrong one is refused", () => {
    expect(materialOrderMessages(order)).toEqual([]);
    const typo = materialOrderMessages({ ...order, text: "1,5" });
    expect(typo.map((message) => message.tone)).toEqual(["error"]);
    expect(hasError(typo)).toBe(true);
  });

  test("a valid order has no message", () => {
    const messages = materialOrderMessages({ ...order, text: "100", quantity: 100, total: 203 });
    expect(messages).toEqual([]);
    expect(hasError(messages)).toBe(false);
  });

  test("stock and cash refusals are explicit", () => {
    const messages = materialOrderMessages({
      ...order,
      text: "400",
      quantity: 400,
      total: 1_200,
    });
    expect(messages.map((message) => clean(message.text))).toEqual([
      "Stock insuffisant : PolyFerr n'a plus que 300 unités.",
      "Trésorerie disponible insuffisante : il manque ₢200.",
    ]);
    const empty = materialOrderMessages({ ...order, stock: 0, text: "5", quantity: 5, total: 15 });
    expect(empty[0]?.text).toBe("PolyFerr est en rupture de stock jusqu'au jour 8.");
    const huge = materialOrderMessages({
      ...order,
      stock: 1e6,
      cash: 1e9,
      text: "200000",
      quantity: 200_000,
      total: 450_000,
      room: 1e6,
    });
    expect(huge.map((message) => message.tone)).toEqual(["error"]);
  });

  test("a full warehouse only warns: the delivery waits without loss", () => {
    const messages = materialOrderMessages({ ...order, text: "120", quantity: 120, room: 100 });
    expect(messages).toHaveLength(1);
    expect(messages[0]?.tone).toBe("warning");
    expect(clean(messages[0]?.text ?? "")).toContain("100 unités libres");
    expect(hasError(messages)).toBe(false);
  });

  test("machines: stock and cash block, locked products only warn", () => {
    const machine = {
      supplierName: "Ferro Machines",
      typeName: "Atelier textile",
      stock: 1,
      nextRestockDay: 31,
      price: 10_800,
      cash: 50_000,
      locks: [
        {
          productId: "clothing" as const,
          lock: { kind: "tier" as const, tier: 2, branch: null },
        },
      ],
    };
    const ahead = machineOrderMessages(machine);
    expect(ahead.map((message) => message.tone)).toEqual(["warning"]);
    expect(ahead[0]?.text).toBe(
      "Achat anticipé : débloquez le palier 2 pour fabriquer Vêtements (voir Progression).",
    );
    const refused = machineOrderMessages({ ...machine, stock: 0, cash: 800, locks: [] });
    expect(refused.map((message) => clean(message.text))).toEqual([
      "Ferro Machines n'a plus de « Atelier textile » en stock : réapprovisionnement le jour 31.",
      "Trésorerie disponible insuffisante : il manque ₢10 000.",
    ]);
    const otherBranch = machineOrderMessages({
      ...machine,
      typeName: "Ligne électronique Loisirs",
      locks: [
        {
          productId: "console" as const,
          lock: { kind: "branch" as const, branch: "leisure" as const },
        },
      ],
    });
    expect(otherBranch[0]?.text).toBe(
      "Votre entreprise a choisi l'autre branche : Console de jeu ne lui sera jamais accessible.",
    );
  });
});

describe("decisions", () => {
  test("blocked decisions are explained, never silent (O1)", () => {
    expect(blockedReason("running")).toBeNull();
    expect(blockedReason("paused")).toContain("pause");
    expect(blockedReason("ended")).toContain("terminée");
    expect(blockedReason("lobby")).not.toBeNull();
  });
});

describe("catalog links", () => {
  test("materials know which products use them", () => {
    expect(productsUsing("water")).toEqual(["bread", "bottled-water", "soap"]);
    expect(productsUsing("batteries")).toEqual(["laptop", "console"]);
  });

  test("machine types list their compatible products with cycle settings", () => {
    const oven = machineTypeById.get("oven");
    if (!oven) throw new Error("missing machine type");
    expect(compatibleProducts(oven)).toEqual([
      { productId: "bread", cycleDays: 1, outputPerCycle: 40 },
      { productId: "packaged-meal", cycleDays: 2, outputPerCycle: 30 },
    ]);
    expect(machineTypeName("oven")).toBe("Four industriel");
    expect(machineTypeName("unknown")).toBe("unknown");
  });

  test("machines owned and on their way are counted per type", () => {
    const owner = team({});
    owner.machines = {
      m1: { ...machineOf("m1", "oven") },
      m2: { ...machineOf("m2", "oven") },
      m3: { ...machineOf("m3", "soap-vat") },
    };
    owner.inbound = {
      i1: {
        id: "i1",
        kind: "machine",
        supplierId: "ferro-machines",
        machineTypeId: "soap-vat",
        arrivesOnDay: 5,
        status: "in-transit",
      },
      i2: {
        id: "i2",
        kind: "material",
        supplierId: "hydro-port",
        item: "water",
        quantity: 10,
        arrivesOnDay: 5,
        status: "in-transit",
      },
    };
    expect(machineCounts(owner)).toEqual({
      oven: { owned: 2, incoming: 0 },
      "soap-vat": { owned: 1, incoming: 1 },
    });
  });

  test("machines are grouped by type, auction-only ones excluded", () => {
    const groups = groupMachineOffers(marketView(newGame(), "azura").machines);
    expect(groups.map((group) => group.type.id)).toEqual([
      "oven",
      "bottling-line",
      "soap-vat",
      "textile-workshop",
      "assembly-line",
      "tech-line",
      "leisure-line",
    ]);
    for (const group of groups) {
      expect(group.offers).toHaveLength(2);
      const [first, second] = group.offers;
      expect(first && second && first.price <= second.price).toBe(true);
    }
  });
});

describe("product locks", () => {
  test("tiers still to unlock", () => {
    const starter = team({});
    expect(productLock(starter, "bread")).toBeNull();
    const clothing = productLock(starter, "clothing");
    expect(clothing).toEqual({ kind: "tier", tier: 2, branch: null });
    expect(clothing && lockLabel(clothing)).toBe("Palier 2");
    const laptop = productLock(starter, "laptop");
    expect(laptop && lockLabel(laptop)).toBe("Palier 3 · Tech");
  });

  test("the branch not chosen stays closed for good", () => {
    const tech = team({ unlockedTier: 3, branch: "tech" });
    expect(productLock(tech, "laptop")).toBeNull();
    const console = productLock(tech, "console");
    expect(console).toEqual({ kind: "branch", branch: "leisure" });
    expect(console && lockLabel(console)).toBe("Branche Loisirs non choisie");
    const pending = team({
      unlockedTier: 2,
      project: { tier: 3, branch: "leisure", completesOnDay: 40 },
    });
    expect(productLock(pending, "laptop")).toEqual({ kind: "branch", branch: "tech" });
    expect(productLock(pending, "console")).toEqual({
      kind: "tier",
      tier: 3,
      branch: "leisure",
    });
  });
});
