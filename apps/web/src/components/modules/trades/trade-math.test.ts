import { describe, expect, test } from "bun:test";
import { type Employee, type GameState, newMachine } from "@etic/engine";
import { credits, percent } from "@/lib/format";
import {
  advanceDays,
  apply,
  lastOfferId,
  member,
  offerCommand,
  startedGame,
  teamOf,
  viewOf,
} from "./testkit.ts";
import {
  acceptConsequences,
  amountError,
  daysUntilStartOf,
  emptyGoodDraft,
  eventDelayDays,
  goodLabel,
  goodMessages,
  machineChoices,
  machineNote,
  type Partner,
  partnersOf,
  previewGift,
  previewOffer,
  priceError,
  quantityError,
  readWhole,
  receivedOfferPlan,
  relativeDay,
  resolvedLabel,
  resolveGood,
  sentOfferPlan,
  shipmentLines,
  shippingUnits,
  stockHint,
  stockLines,
  tradeOverview,
} from "./trade-math.ts";

/** Alpha in Ferronia, Beta in Azura (2 days away), Gamma in Port-Libre (cheaper shipping). */
function game(): GameState {
  const state = startedGame(["Alpha", "Beta", "Gamma"], ["ferronia", "azura", "port-libre"]);
  teamOf(state, "t1").inventory.flour = 300;
  teamOf(state, "t3").inventory.water = 300;
  return state;
}

function partner(state: GameState, viewer: string, id: string): Partner {
  const found = partnersOf(viewOf(state, viewer).competitors).find((entry) => entry.id === id);
  if (!found) throw new Error(`no partner ${id}`);
  return found;
}

function received(state: GameState, teamId: string) {
  const view = viewOf(state, teamId);
  const offer = view.trades.offers.find((entry) => entry.buyerId === teamId);
  if (!offer) throw new Error("no offer received");
  return { view, offer, plan: receivedOfferPlan(view, offer) };
}

function sent(state: GameState, teamId: string) {
  const view = viewOf(state, teamId);
  const offer = view.trades.offers.find((entry) => entry.sellerId === teamId);
  if (!offer) throw new Error("no offer sent");
  return sentOfferPlan(view, offer);
}

function operator(id: string, machineId: string | null): Employee {
  return {
    id,
    job: "operator",
    wage: 1_000,
    efficiency: 1,
    hiredOnDay: 1,
    arrivesOnDay: 1,
    lastRaiseDay: 1,
    machineId,
  };
}

describe("previews follow the engine", () => {
  test("the buyer pays the price and its shipping at acceptance, and the goods arrive on time", () => {
    let state = apply(game(), member("t1"), offerCommand({ option: "express" }));
    const { offer, plan } = received(state, "t2");
    // 20 + 1.2 × 100 units × 2 days of travel; express halves the 2 days.
    expect(plan.quote).toEqual({ option: "express", cost: 260, days: 1 });
    expect(plan.dueNow).toBe(1_260);
    const before = teamOf(state, "t2").cash;
    state = apply(state, member("t2"), { type: "trade.accept", payload: { offerId: offer.id } });
    expect(before - teamOf(state, "t2").cash).toBe(plan.dueNow);
    expect(Object.values(state.trades.shipments)[0]?.arrivesOnDay).toBe(plan.arrivalDay ?? -1);
  });

  test("the seller's shipping cost includes its region's discount (Port-Libre)", () => {
    let state = apply(
      game(),
      member("t3"),
      offerCommand({
        buyerTeamId: "t1",
        good: { kind: "item", item: "water", quantity: 100 },
        shippingPaidBy: "seller",
      }),
    );
    const plan = sent(state, "t3");
    expect(plan.quote?.cost).toBe(70); // (20 + 0.4 × 100 × 2) × 0.7
    const before = teamOf(state, "t3").cash;
    state = apply(state, member("t1"), {
      type: "trade.accept",
      payload: { offerId: lastOfferId(state) },
    });
    expect(before - teamOf(state, "t3").cash).toBe(plan.quote?.cost ?? -1);
  });

  test("a machine counts as 10 units of shipping", () => {
    expect(shippingUnits({ kind: "machine" })).toBe(10);
    expect(shippingUnits({ kind: "item", quantity: 42 })).toBe(42);
    let state = game();
    teamOf(state, "t1").machines.m1 = newMachine("m1", "oven");
    state = apply(
      state,
      member("t1"),
      offerCommand({ good: { kind: "machine", machineId: "m1" } }),
    );
    const { offer, plan } = received(state, "t2");
    expect(goodLabel(offer.good)).toBe("Four industriel");
    expect(plan.quote?.cost).toBe(28); // 20 + 0.4 × 10 × 2
    const before = teamOf(state, "t2").cash;
    state = apply(state, member("t2"), { type: "trade.accept", payload: { offerId: offer.id } });
    expect(before - teamOf(state, "t2").cash).toBe(1_028);
  });

  test("transport events in progress delay the arrival, as on the server", () => {
    let state = apply(game(), member("t1"), offerCommand());
    state.market.transportDelays.storm = { region: "azura", extraDays: 2, untilDay: null };
    state.market.transportDelays.far = { region: "nordhaven", extraDays: 5, untilDay: null };
    const { offer, plan } = received(state, "t2");
    expect(plan.quote?.days).toBe(4);
    state = apply(state, member("t2"), { type: "trade.accept", payload: { offerId: offer.id } });
    expect(Object.values(state.trades.shipments)[0]?.arrivesOnDay).toBe(plan.arrivalDay ?? -1);
    expect(eventDelayDays(viewOf(state, "t2").market.transportDelays, "ferronia", "azura")).toBe(2);
  });
});

describe("what the company can send", () => {
  test("stock lines list what is in the warehouse, net of customer reservations", () => {
    const lines = stockLines({
      inventory: { bread: 50, flour: 10, water: 0 },
      reserved: { bread: 20 },
    });
    expect(lines).toEqual([
      { item: "flour", inStock: 10, reserved: 0, available: 10 },
      { item: "bread", inStock: 50, reserved: 20, available: 30 },
    ]);
    expect(lines.map(stockHint)).toEqual([
      "10 disponibles",
      "30 disponibles sur 50 (20 réservés par vos commandes)",
    ]);
  });

  test("machines are numbered by type and flagged when they cannot leave", () => {
    const team = teamOf(game(), "t1");
    const busy = newMachine("m-3", "oven");
    busy.cycle = { productId: "bread", output: 40, stepsDone: 1, stepsTotal: 4 };
    const queued = newMachine("m-7", "soap-vat");
    queued.job = { productId: "soap", cyclesRemaining: 2 };
    team.machines = { "m-12": newMachine("m-12", "oven"), "m-3": busy, "m-7": queued };
    team.employees = {
      e1: operator("e1", "m-7"),
      e2: operator("e2", "m-7"),
      e3: operator("e3", null),
    };
    const choices = machineChoices(team);
    expect(
      choices.map(({ name, blocked, queued: q, operators }) => ({ name, blocked, q, operators })),
    ).toEqual([
      { name: "Four industriel n° 1", blocked: "cycle", q: false, operators: 0 },
      { name: "Cuve de saponification", blocked: null, q: true, operators: 2 },
      { name: "Four industriel n° 2", blocked: null, q: false, operators: 0 },
    ]);
    const full = `rendement ${percent(1)}`;
    expect(choices.map(machineNote)).toEqual(["en plein cycle", full, full]);
  });
});

describe("typed numbers", () => {
  test("whole numbers only; an empty field is no error", () => {
    expect(readWhole("")).toEqual({ empty: true, value: null });
    expect(readWhole(" 12 ")).toEqual({ empty: false, value: 12 });
    expect(readWhole("1.5")).toEqual({ empty: false, value: null });
    expect(quantityError("")).toBeNull();
    expect(quantityError("3")).toBeNull();
    expect(quantityError("0")).not.toBeNull();
    expect(priceError("0")).toBeNull();
    expect(priceError("-5")).not.toBeNull();
    expect(priceError("abc")).not.toBeNull();
  });

  test("a money transfer cannot exceed the available cash", () => {
    expect(amountError("500", 500, 0)).toBeNull();
    expect(amountError("0", 500, 0)).not.toBeNull();
    expect(amountError("600", 500, 0)).toBe(
      `Trésorerie disponible insuffisante : ${credits(500)}.`,
    );
    expect(amountError("600", 500, 1_000)).toBe(
      `Trésorerie disponible insuffisante : ${credits(500)} (${credits(1_000)} bloqués par vos enchères).`,
    );
  });
});

describe("goods in a form", () => {
  const stock = stockLines({ inventory: { flour: 40 }, reserved: {} });

  test("a shortage only warns on an offer (checked at acceptance) but blocks a gift", () => {
    const good = resolveGood({ ...emptyGoodDraft, item: "flour", quantity: "60" }, stock, []);
    expect(good.payload).toEqual({ kind: "item", item: "flour", quantity: 60 });
    expect(resolvedLabel(good)).toBe("60 × Farine");
    expect(goodMessages(good, "offer").map((message) => message.tone)).toEqual(["warning"]);
    expect(goodMessages(good, "gift").map((message) => message.tone)).toEqual(["error"]);
  });

  test("an invalid quantity or a missing item sends nothing", () => {
    expect(
      resolveGood({ ...emptyGoodDraft, item: "flour", quantity: "x" }, stock, []).payload,
    ).toBe(null);
    expect(
      resolveGood({ ...emptyGoodDraft, item: "water", quantity: "5" }, stock, []).payload,
    ).toBe(null);
  });

  test("a machine in a cycle cannot be chosen; queued production and operators are explained", () => {
    const team = teamOf(game(), "t1");
    const busy = newMachine("m1", "oven");
    busy.cycle = { productId: "bread", output: 40, stepsDone: 1, stepsTotal: 4 };
    const queued = newMachine("m2", "oven");
    queued.job = { productId: "bread", cyclesRemaining: 3 };
    team.machines = { m1: busy, m2: queued };
    team.employees = { e1: operator("e1", "m2") };
    const machines = machineChoices(team);
    const draft = { ...emptyGoodDraft, kind: "machine" as const };
    const blocked = resolveGood({ ...draft, machineId: "m1" }, [], machines);
    expect(blocked.payload).toBeNull();
    expect(goodMessages(blocked, "offer").map((message) => message.tone)).toEqual(["error"]);
    const ready = resolveGood({ ...draft, machineId: "m2" }, [], machines);
    expect(ready.payload).toEqual({ kind: "machine", machineId: "m2" });
    expect(ready.units).toBe(10);
    expect(goodMessages(ready, "offer").map((message) => message.tone)).toEqual([
      "warning",
      "info",
    ]);
    expect(goodMessages(ready, "gift").map((message) => message.text)).toEqual([
      "Sa production programmée sera annulée.",
      "Son opérateur sera libéré à son départ.",
    ]);
  });
});

describe("new offer", () => {
  const state = game();
  const team = teamOf(state, "t1");
  const buyer = partner(state, "t1", "t2");
  const good = resolveGood(
    { ...emptyGoodDraft, item: "flour", quantity: "100" },
    stockLines(team),
    [],
  );
  const base = {
    team,
    buyer,
    good,
    price: 1_000,
    option: "standard" as const,
    payer: "seller" as const,
    today: 1,
    endDay: null,
    delays: [],
  };

  test("the seller sees the exact shipping it pays and what it keeps", () => {
    const preview = previewOffer(base);
    expect(preview.quote).toEqual({ option: "standard", cost: 100, days: 2 });
    expect(preview).toMatchObject({
      estimate: false,
      buyerPays: 1_000,
      sellerNet: 900,
      arrivalDay: 3,
      expiresOnDay: 6,
      ready: true,
    });
  });

  test("shipping paid by the buyer is an estimate added to the price", () => {
    expect(previewOffer({ ...base, payer: "buyer" })).toMatchObject({
      estimate: true,
      buyerPays: 1_100,
      sellerNet: 1_000,
    });
  });

  test("a price of 0 is allowed; no buyer or no valid price is not", () => {
    expect(previewOffer({ ...base, price: 0 }).ready).toBe(true);
    expect(previewOffer({ ...base, price: null }).ready).toBe(false);
    expect(previewOffer({ ...base, buyer: null }).ready).toBe(false);
  });

  test("it warns when the seller could not pay its shipping, or the goods arrive too late", () => {
    const poor = { ...team, cash: 50 };
    expect(previewOffer({ ...base, team: poor }).messages.map((m) => m.tone)).toEqual(["warning"]);
    const late = previewOffer({ ...base, option: "green", endDay: 2 });
    expect(late.arrivalDay).toBe(4);
    expect(late.messages.map((message) => message.tone)).toEqual(["warning"]);
    expect(late.ready).toBe(true);
  });
});

describe("free goods transfer", () => {
  const state = game();
  const team = teamOf(state, "t1");
  const recipient = partner(state, "t1", "t3");
  const good = resolveGood(
    { ...emptyGoodDraft, item: "flour", quantity: "100" },
    stockLines(team),
    [],
  );
  const base = { team, recipient, good, option: "standard" as const, today: 1, endDay: null };

  test("the sender pays shipping now: it must afford it", () => {
    const preview = previewGift({ ...base, delays: [] });
    expect(preview.quote?.cost).toBe(100);
    expect(preview.ready).toBe(true);
    const poor = previewGift({ ...base, team: { ...team, cash: 80 }, delays: [] });
    expect(poor.messages.map((message) => message.tone)).toEqual(["error"]);
    expect(poor.ready).toBe(false);
  });
});

describe("offers received", () => {
  test("the buyer cannot accept without the price and its shipping in available cash", () => {
    const state = apply(game(), member("t1"), offerCommand());
    teamOf(state, "t2").cash = 1_050;
    const { plan } = received(state, "t2");
    expect(plan.dueNow).toBe(1_100);
    expect(plan.canAccept).toBe(false);
    expect(plan.messages[0]?.tone).toBe("error");
  });

  test("a full warehouse makes the goods wait: a warning, not a refusal", () => {
    const state = apply(game(), member("t1"), offerCommand());
    teamOf(state, "t2").warehouse.capacity = 50;
    const { plan } = received(state, "t2");
    expect(plan.canAccept).toBe(true);
    expect(plan.messages.map((message) => message.tone)).toEqual(["warning"]);
  });

  test("a machine shows what the buyer cannot produce yet and that its wear is unknown", () => {
    let state = game();
    teamOf(state, "t1").machines.m1 = newMachine("m1", "tech-line");
    state = apply(
      state,
      member("t1"),
      offerCommand({ good: { kind: "machine", machineId: "m1" } }),
    );
    const { plan } = received(state, "t2");
    expect(plan.messages.map((message) => message.tone)).toEqual(["warning", "info"]);
    expect(plan.messages[0]?.text).toContain("Ordinateur portable");
  });

  test("the confirmation lists the escrow, the shipping and the arrival", () => {
    const state = apply(game(), member("t1"), offerCommand());
    const { plan } = received(state, "t2");
    const lines = acceptConsequences(plan);
    expect(lines[0]).toContain("séquestre");
    expect(lines[1]).toBe(`Transport standard payé maintenant : ${credits(100)}.`);
    expect(lines[2]).toBe("Arrivée prévue jour 3, hors retards d'événements.");
    const sellerPays = apply(game(), member("t1"), offerCommand({ shippingPaidBy: "seller" }));
    expect(acceptConsequences(received(sellerPays, "t2").plan)[1]).toBe(
      "Transport standard payé par Alpha.",
    );
  });
});

describe("offers sent", () => {
  test("the seller is warned when its stock no longer covers the offer", () => {
    const state = apply(game(), member("t1"), offerCommand());
    teamOf(state, "t1").inventory.flour = 30;
    const plan = sent(state, "t1");
    expect(plan.buyer).toBe("Beta");
    expect(plan.messages).toHaveLength(1);
    expect(plan.messages[0]?.text).toContain("il en manque 70");
  });

  test("the seller is warned when the machine is gone or busy", () => {
    let state = game();
    teamOf(state, "t1").machines.m1 = newMachine("m1", "oven");
    state = apply(
      state,
      member("t1"),
      offerCommand({ good: { kind: "machine", machineId: "m1" } }),
    );
    const machine = teamOf(state, "t1").machines.m1;
    if (!machine) throw new Error("no machine");
    machine.cycle = { productId: "bread", output: 40, stepsDone: 0, stepsTotal: 4 };
    expect(sent(state, "t1").messages[0]?.text).toContain("plein cycle");
    teamOf(state, "t1").machines = {};
    expect(sent(state, "t1").messages[0]?.text).toContain("ne possédez plus");
  });
});

describe("overview and shipments", () => {
  function trading() {
    let state = game();
    state = apply(state, member("t1"), offerCommand({ price: 1_000 }));
    state = apply(state, member("t2"), {
      type: "trade.accept",
      payload: { offerId: lastOfferId(state) },
    });
    state = apply(
      state,
      member("t3"),
      offerCommand({
        buyerTeamId: "t1",
        good: { kind: "item", item: "water", quantity: 20 },
        price: 400,
        option: "green",
      }),
    );
    state = apply(state, member("t1"), {
      type: "trade.accept",
      payload: { offerId: lastOfferId(state) },
    });
    state = apply(state, member("t1"), offerCommand({ price: 700 }));
    return state;
  }

  test("counts offers both ways and the escrow to collect or already paid", () => {
    const view = viewOf(trading(), "t1");
    const overview = tradeOverview(view.trades, view.team.id);
    expect(overview).toMatchObject({ incoming: 1, outgoing: 1, toCollect: 1_000, inEscrow: 400 });
    expect(overview.sent.map((offer) => offer.price)).toEqual([700]);
    expect(overview.received).toEqual([]);
  });

  test("shipments show their direction and partner, earliest first", () => {
    const view = viewOf(trading(), "t1");
    const lines = shipmentLines(view);
    expect(
      lines.map(({ direction, partner: name, afterEnd }) => ({ direction, name, afterEnd })),
    ).toEqual([
      { direction: "out", name: "Beta", afterEnd: false },
      { direction: "in", name: "Gamma", afterEnd: false },
    ]);
    const ending = shipmentLines({ ...view, clock: { ...view.clock, endDay: 2 } });
    expect(ending.map((line) => line.afterEnd)).toEqual([true, true]);
  });

  test("delivered trades leave the list", () => {
    const view = viewOf(advanceDays(trading(), 6), "t1");
    expect(shipmentLines(view)).toEqual([]);
  });
});

describe("partners and time", () => {
  test("partners are sorted by company name, accents included", () => {
    const state = startedGame(["Zèbre", "Alpha", "Ébène"], ["azura", "azura", "azura"]);
    expect(partnersOf(viewOf(state, "t1").competitors).map((entry) => entry.name)).toEqual([
      "Alpha",
      "Ébène",
    ]);
  });

  test("time left counts the sub-steps already played", () => {
    expect(daysUntilStartOf(5, { day: 3, step: 2 }, 4)).toBe(1.5);
    expect(daysUntilStartOf(3, { day: 3, step: 1 }, 4)).toBe(0);
    expect(relativeDay(3, 3)).toBe("aujourd'hui");
    expect(relativeDay(4, 3)).toBe("demain");
    expect(relativeDay(7, 3)).toBe("dans 4 j");
    expect(relativeDay(1, 3)).toBe("il y a 2 j");
  });
});
