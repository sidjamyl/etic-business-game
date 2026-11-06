import { describe, expect, test } from "bun:test";
import { blackMarketRules, newsSources, type RegionId } from "@etic/content";
import {
  type Actor,
  type Command,
  type GameState,
  gameEngine,
  impactScores,
  marketView,
  type TeamState,
  teamView,
} from "@etic/engine";
import { credits } from "@/lib/format";
import {
  accusationConsequences,
  accusationRecords,
  affordableUnits,
  blackMarketDeliveries,
  blackMarketMaterialIds,
  blockedReason,
  buyGain,
  buyLimit,
  buyMessages,
  cheapestLegalPrice,
  companyLabel,
  convictionFine,
  daysLabel,
  dealAmount,
  evidenceLine,
  formatDecimal,
  hasError,
  impactAfterPurchase,
  investigationsOn,
  nextAccusationDay,
  parseQuantity,
  plural,
  priceGap,
  relativeDay,
  roomOnArrival,
  sanctionEvents,
  sellableProducts,
  sellGain,
  sellLimit,
  sellMessages,
  traceSummary,
  unitsLabel,
  weeklyStock,
} from "./black-market-math.ts";

const rules = blackMarketRules;
const ORGANIZER: Actor = { kind: "organizer", userId: "org", name: "Org" };
const clean = (text: string) => text.replace(/\s/g, " ");

function member(teamId: string): Actor {
  return { kind: "team", teamId, userId: `u-${teamId}`, name: `Joueur ${teamId}` };
}

function apply(state: GameState, actor: Actor, command: Command): GameState {
  const result = gameEngine.applyCommand(state, actor, command);
  if (!result.ok) throw new Error(`${command.type} refused: ${result.refusal.message}`);
  return result.state;
}

/** A running game, one member per team, companies "Société 1", "Société 2"… */
function startedGame(regions: RegionId[]): GameState {
  let state = gameEngine.createGame({
    id: "g-black-market",
    seed: "black-market",
    config: { stepsPerDay: 4, countdownDays: 30 },
    teams: regions.map((_, index) => ({
      id: `t${index + 1}`,
      name: `Équipe ${index + 1}`,
      joinCode: `CODE-${index + 1}`,
      members: [{ userId: `u-t${index + 1}`, name: `Joueur t${index + 1}` }],
    })),
  });
  for (const [index, region] of regions.entries()) {
    const actor = member(`t${index + 1}`);
    state = apply(state, actor, {
      type: "lobby.setCompanyName",
      payload: { companyName: `Société ${index + 1}` },
    });
    state = apply(state, actor, { type: "lobby.chooseRegion", payload: { region } });
  }
  return apply(state, ORGANIZER, { type: "control.start" });
}

function teamOf(state: GameState, id: string): TeamState {
  const team = state.teams[id];
  if (!team) throw new Error(`missing team ${id}`);
  return team;
}

const buy = (material: string, quantity: number): Command => ({
  type: "blackMarket.buy",
  payload: { material, quantity },
});
const sell = (productId: string, quantity: number): Command => ({
  type: "blackMarket.sell",
  payload: { productId, quantity },
});
const accuse = (targetTeamId: string): Command => ({
  type: "blackMarket.accuse",
  payload: { targetTeamId },
});

describe("labels", () => {
  test("French singular for 0 and 1, plural from 2", () => {
    expect(clean(unitsLabel(0))).toBe("0 unité");
    expect(clean(unitsLabel(1))).toBe("1 unité");
    expect(clean(unitsLabel(1200))).toBe("1 200 unités");
    expect(daysLabel(1)).toBe("1 jour");
    expect(daysLabel(30)).toBe("30 jours");
    expect(plural(3, "disponible")).toBe("3 disponibles");
    expect(plural(1, "réservé")).toBe("1 réservé");
  });

  test("relative days", () => {
    expect(relativeDay(12, 12)).toBe("aujourd'hui");
    expect(relativeDay(13, 12)).toBe("demain");
    expect(relativeDay(11, 12)).toBe("hier");
    expect(relativeDay(15, 12)).toBe("dans 3 jours");
    expect(relativeDay(9, 12)).toBe("il y a 3 jours");
  });

  test("blocked reasons and scores", () => {
    expect(blockedReason("running")).toBeNull();
    expect(blockedReason("paused")).toContain("pause");
    expect(blockedReason("ended")).toContain("terminée");
    expect(formatDecimal(62.4)).toBe("62,4");
    expect(formatDecimal(50)).toBe("50");
    expect(formatDecimal(1.5)).toBe("1,5");
    expect(companyLabel({ companyName: null, name: "Équipe 3" })).toBe("Équipe 3");
    expect(companyLabel({ companyName: "Société 3", name: "Équipe 3" })).toBe("Société 3");
  });
});

describe("quantities and limits", () => {
  test("parses a positive whole number of units", () => {
    expect(parseQuantity("")).toEqual({ kind: "empty" });
    expect(parseQuantity("   ")).toEqual({ kind: "empty" });
    expect(parseQuantity(" 12 ")).toEqual({ kind: "valid", quantity: 12 });
    expect(parseQuantity("0").kind).toBe("invalid");
    expect(parseQuantity("1.5").kind).toBe("invalid");
    expect(parseQuantity("-3").kind).toBe("invalid");
    expect(parseQuantity("abc").kind).toBe("invalid");
    expect(parseQuantity("99999999999999999999").kind).toBe("invalid");
  });

  test("rounds amounts to the crédit like the engine", () => {
    expect(dealAmount(1.9, 50)).toBe(95);
    expect(dealAmount(16.58, 3)).toBe(50);
  });

  test("the largest affordable quantity matches what the engine accepts", () => {
    expect(affordableUnits(1.9, 100)).toBe(52);
    expect(affordableUnits(2, 100)).toBe(50);
    expect(affordableUnits(16.58, 0)).toBe(0);
    expect(affordableUnits(1.9, -5)).toBe(0);

    const state = startedGame(["azura", "azura"]);
    teamOf(state, "t1").cash = 100;
    const price = teamView(state, "t1")?.blackMarket.buy.flour?.price ?? 0;
    const max = affordableUnits(price, 100);
    expect(gameEngine.applyCommand(state, member("t1"), buy("flour", max)).ok).toBe(true);
    const refused = gameEngine.applyCommand(state, member("t1"), buy("flour", max + 1));
    expect(refused.ok ? null : refused.refusal.code).toBe("INSUFFICIENT_FUNDS");
  });

  test("buying is limited by the shared stock, then by the cash", () => {
    expect(buyLimit(100, 1.9, 100)).toEqual({ max: 52, limitedBy: "cash" });
    expect(buyLimit(30, 1.9, 1_000)).toEqual({ max: 30, limitedBy: "stock" });
    expect(buyLimit(0, 1.9, 1_000)).toEqual({ max: 0, limitedBy: "stock" });
  });

  test("selling is limited by the daily cap, then by the available stock", () => {
    expect(sellLimit(40, 12, 100)).toEqual({ left: 28, available: 100, max: 28, limitedBy: "cap" });
    expect(sellLimit(40, 12, 5)).toEqual({ left: 28, available: 5, max: 5, limitedBy: "stock" });
    expect(sellLimit(40, 45, 10).left).toBe(0);
    expect(sellLimit(40, 0, -3).available).toBe(0);
  });
});

describe("messages before sending", () => {
  const base = { stock: 40, nextRestockDay: 8, cost: 95, cash: 1_000, room: 500 };

  test("nothing to say about an empty field; one error for a bad number", () => {
    expect(buyMessages({ ...base, input: { kind: "empty" } })).toEqual([]);
    expect(buyMessages({ ...base, input: parseQuantity("1,5") })).toHaveLength(1);
  });

  test("stock and cash refusals, warehouse warning", () => {
    const tooMany = buyMessages({ ...base, input: parseQuantity("50") });
    expect(tooMany.map((m) => clean(m.text))).toEqual([
      "Il ne reste que 40 unités : réassort le jour 8.",
    ]);
    expect(hasError(tooMany)).toBe(true);

    const soldOut = buyMessages({ ...base, stock: 0, input: parseQuantity("1") });
    expect(soldOut[0]?.text).toBe("Plus rien en stock : réassort le jour 8.");

    const broke = buyMessages({ ...base, cost: 2_000, input: parseQuantity("10") });
    expect(clean(broke[0]?.text ?? "")).toContain("il faut ₢2 000, vous disposez de ₢1 000");

    const crowded = buyMessages({ ...base, room: 5, input: parseQuantity("10") });
    expect(crowded).toEqual([
      {
        tone: "warning",
        text: expect.stringContaining("la livraison attendra de pouvoir tout ranger") as never,
      },
    ]);
    expect(hasError(crowded)).toBe(false);
  });

  test("daily cap and available stock refusals", () => {
    const capped = sellMessages({ input: parseQuantity("30"), limit: sellLimit(40, 12, 100) });
    expect(clean(capped[0]?.text ?? "")).toBe(
      "Les acheteurs n'en prendront plus que 28 unités aujourd'hui.",
    );
    const reached = sellMessages({ input: parseQuantity("1"), limit: sellLimit(40, 40, 100) });
    expect(reached[0]?.text).toContain("Plafond du jour atteint");
    const short = sellMessages({ input: parseQuantity("10"), limit: sellLimit(40, 0, 6) });
    expect(clean(short[0]?.text ?? "")).toContain("6 unités, hors stock réservé");
  });
});

describe("offers", () => {
  test("lists the black-market materials in catalog order with their weekly stock", () => {
    const view = teamView(startedGame(["azura"]), "t1");
    expect(blackMarketMaterialIds(view?.blackMarket.buy ?? {})).toEqual([
      "flour",
      "plastic",
      "fabric",
      "metal",
      "components",
      "batteries",
    ]);
    expect(weeklyStock("flour")).toBe(rules.stock.flour);
    expect(weeklyStock("water")).toBeNull();
  });

  test("lists the products the team can make or holds", () => {
    const team = teamOf(startedGame(["azura"]), "t1");
    expect(sellableProducts(team)).toEqual(["bread", "bottled-water", "soap"]);
    team.inventory.kettle = 5;
    expect(sellableProducts(team)).toContain("kettle");
    team.progression = { ...team.progression, unlockedTier: 3, branch: "tech" };
    expect(sellableProducts(team)).toContain("laptop");
    expect(sellableProducts(team)).not.toContain("console");
  });

  test("compares with the cheapest regular supplier", () => {
    const state = startedGame(["azura"]);
    const suppliers = marketView(state, "azura").suppliers;
    const flour = Object.values(suppliers)
      .filter((offer) => offer.material === "flour")
      .map((offer) => offer.unitPrice);
    expect(cheapestLegalPrice(suppliers, "flour")).toBe(Math.min(...flour));
    expect(priceGap(1.3, 2)).toBeCloseTo(-0.35, 10);
    expect(priceGap(5, 0)).toBe(0);
  });
});

describe("traces and fines", () => {
  test("keeps the last 30 days and computes the fine (2 × gain, ₢2 000 minimum)", () => {
    const traces = [
      { day: -10, gain: 9_000 },
      { day: 3, gain: 400 },
      { day: 10, gain: 1_500 },
    ];
    expect(traceSummary(traces, 20)).toEqual({
      count: 2,
      gain: 1_900,
      fine: 3_800,
      nextFadeDay: 33,
      clearDay: 40,
    });
    expect(traceSummary([{ day: 5, gain: 100 }], 6).fine).toBe(rules.accusation.minFine);
    expect(traceSummary([], 6)).toEqual({
      count: 0,
      gain: 0,
      fine: 0,
      nextFadeDay: null,
      clearDay: null,
    });
    expect(convictionFine(0)).toBe(rules.accusation.minFine);
  });

  test("deal gains and the fine match the engine's traces and sanction", () => {
    let state = startedGame(["azura", "azura"]);
    const price = teamView(state, "t2")?.blackMarket.buy.flour?.price ?? 0;
    state = apply(state, member("t2"), buy("flour", 50));
    expect(teamOf(state, "t2").blackMarket.traces[0]?.gain).toBe(buyGain("flour", price, 50));

    teamOf(state, "t1").inventory.bread = 100;
    const sellPrice = teamView(state, "t1")?.blackMarket.sell.bread?.price ?? 0;
    state = apply(state, member("t1"), sell("bread", 30));
    expect(teamOf(state, "t1").blackMarket.traces[0]?.gain).toBe(
      sellGain("azura", "bread", sellPrice, 30),
    );

    const exposure = traceSummary(teamOf(state, "t2").blackMarket.traces, 1);
    const cashBefore = teamOf(state, "t2").cash;
    state = apply(state, member("t1"), accuse("t2"));
    expect(cashBefore - teamOf(state, "t2").cash).toBe(exposure.fine);
  });
});

describe("warehouse and deliveries", () => {
  test("room on arrival counts goods due first and a finished expansion", () => {
    const team = teamOf(startedGame(["azura"]), "t1");
    team.warehouse = { capacity: 1_500, expansion: null };
    team.inbound = {
      a: {
        id: "a",
        kind: "material",
        supplierId: "moulins-azura",
        item: "flour",
        quantity: 300,
        arrivesOnDay: 5,
        status: "in-transit",
      },
      b: {
        id: "b",
        kind: "material",
        supplierId: "black-market",
        item: "metal",
        quantity: 100,
        arrivesOnDay: 4,
        status: "waiting-space",
      },
      c: {
        id: "c",
        kind: "machine",
        supplierId: "x",
        machineTypeId: "m",
        arrivesOnDay: 3,
        status: "in-transit",
      },
    };
    expect(roomOnArrival(team, 200, 5)).toBe(900);
    expect(roomOnArrival(team, 200, 4)).toBe(1_200);
    team.warehouse.expansion = { completesOnDay: 5, amount: 1_000 };
    expect(roomOnArrival(team, 200, 5)).toBe(1_900);
    expect(blackMarketDeliveries(team).map((delivery) => delivery.id)).toEqual(["b"]);
  });
});

describe("impact preview", () => {
  test("predicts the indicators the engine computes after the purchase", () => {
    let state = startedGame(["azura", "azura"]);
    const before = teamOf(state, "t1");
    const preview = impactAfterPurchase(before, 50);
    state = apply(state, member("t1"), buy("flour", 50));
    const after = impactScores(teamOf(state, "t1"));
    expect(preview).toEqual({ environmental: after.environmental, social: after.social });
    expect(after.environmental).toBeLessThan(impactScores(before).environmental);
    // The preview never touches the live view.
    expect(before.impact.purchases.units).toBe(0);
  });
});

describe("investigations and accusations", () => {
  const results = [
    { targetTeamId: "t2", day: 3, proofFound: false },
    { targetTeamId: "t3", day: 4, proofFound: true },
    { targetTeamId: "t2", day: 9, proofFound: true },
  ];

  test("private results per company, latest first", () => {
    expect(investigationsOn(results, "t2").map((result) => result.day)).toEqual([9, 3]);
    expect(investigationsOn(results, "t2").map((result) => result.ordinal)).toEqual([3, 1]);
    expect(investigationsOn(results, "t4")).toEqual([]);
    expect(results[0]?.day).toBe(3);
  });

  test("one accusation per company every 10 days", () => {
    expect(nextAccusationDay(undefined)).toBeNull();
    expect(nextAccusationDay(12)).toBe(12 + rules.accusation.cooldownDays);
  });

  test("the evidence line never presents a clean result as innocence", () => {
    expect(evidenceLine("Société 2", undefined, 10)).toContain("sans preuve");
    expect(evidenceLine("Société 2", results[0], 10)).toContain("ne prouve pas son innocence");
    expect(evidenceLine("Société 2", results[2], 20)).toBe(
      "Votre enquête du jour 9 a trouvé des preuves de marché noir.",
    );
    expect(evidenceLine("Société 2", results[2], 39)).toContain("effacées depuis");
  });

  test("announces both outcomes, the debt and the cooldown", () => {
    const lines = accusationConsequences({
      name: "Société 2",
      today: 12,
      reputation: 50,
      cash: 1_000,
      latest: undefined,
    }).map(clean);
    expect(lines[0]).toContain("sans preuve");
    expect(lines[1]).toContain(`${rules.accusation.fineMultiplier} × son gain illicite`);
    expect(lines[1]).toContain(clean(credits(rules.accusation.minFine)));
    expect(lines[1]).toContain(
      `exclusion du marché noir pendant ${rules.accusation.banDays} jours`,
    );
    expect(lines[1]).toContain(newsSources.tabloid);
    expect(lines[2]).toContain(clean(credits(rules.accusation.falseAccusationFine)));
    expect(lines[2]).toContain("dont ₢4 000 ajoutés à votre dette");
    expect(lines[2]).toContain("passe de 50 à 40");
    expect(lines[4]).toBe("Vous ne pourrez plus accuser Société 2 avant le jour 22.");
    const rich = accusationConsequences({
      name: "Société 2",
      today: 12,
      reputation: 5,
      cash: 50_000,
      latest: undefined,
    });
    expect(rich[2]).not.toContain("dette");
    expect(rich[2]).toContain("passe de 5 à 0");
  });
});

describe("sanctions and verdicts read from the engine's log", () => {
  test("a guilty target is convicted: confirmed for the accuser, sanction for the target", () => {
    let state = apply(startedGame(["azura", "azura"]), member("t2"), buy("flour", 50));
    state = apply(state, member("t1"), accuse("t2"));
    expect(accusationRecords(teamOf(state, "t1").log, "Société 2")).toEqual([
      { id: expect.any(Number) as never, day: 1, verdict: "confirmed" },
    ]);
    const sanctions = sanctionEvents(teamOf(state, "t2").log);
    expect(sanctions.map((event) => event.kind)).toEqual(["conviction"]);
    expect(sanctions[0]?.message).toContain("une accusation de Société 1");
    expect(sanctionEvents(teamOf(state, "t1").log)).toEqual([]);
  });

  test("a baseless accusation costs the accuser", () => {
    const state = apply(startedGame(["azura", "azura"]), member("t1"), accuse("t2"));
    expect(accusationRecords(teamOf(state, "t1").log, "Société 2")[0]?.verdict).toBe("unfounded");
    expect(sanctionEvents(teamOf(state, "t1").log).map((event) => event.kind)).toEqual([
      "unfounded",
    ]);
    expect(accusationRecords(teamOf(state, "t1").log, "Société 3")).toEqual([]);
  });

  test("an amnesty dismisses the accusation", () => {
    let state = startedGame(["azura", "azura"]);
    teamOf(state, "t2").card = { id: "amnesty", used: false };
    state = apply(state, member("t2"), { type: "card.play", payload: { kind: "amnesty" } });
    state = apply(state, member("t1"), accuse("t2"));
    expect(accusationRecords(teamOf(state, "t1").log, "Société 2")[0]?.verdict).toBe("dismissed");
    expect(sanctionEvents(teamOf(state, "t2").log).map((event) => event.kind)).toEqual([
      "shielded",
    ]);
  });
});
