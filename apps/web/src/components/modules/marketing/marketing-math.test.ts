import { describe, expect, test } from "bun:test";
import { marketingRules } from "@etic/content";
import { type Campaign, campaignCost, type TeamState } from "@etic/engine";
import {
  ALL,
  activeCampaigns,
  blockedReason,
  boostLabel,
  type CampaignPlan,
  campaignMessages,
  campaignOn,
  campaignProgress,
  capitalize,
  coveredUntil,
  daysLeft,
  daysLeftLabel,
  daysUntilEnd,
  endDayOf,
  isDuration,
  listLabel,
  offersLabel,
  offersOf,
  onSaleLabel,
  overlaps,
  parseProductChoice,
  parseRegionChoice,
  planCampaign,
  plural,
  rangeFactorLabel,
  reaches,
  sameTarget,
  targetLabel,
  targetPairs,
} from "./marketing-math.ts";

function campaign(overrides: Partial<Campaign> & { id: string }): Campaign {
  return {
    region: "azura",
    productId: "bread",
    startDay: 10,
    endDay: 16,
    cost: 672,
    ...overrides,
  };
}

const noPrices: TeamState["prices"] = {};

function plan(overrides: Partial<CampaignPlan> = {}): CampaignPlan {
  return {
    target: { region: "azura", productId: "bread" },
    days: 7,
    cost: 672,
    endDay: 16,
    duplicate: null,
    overlapping: [],
    coveredUntil: null,
    offers: [{ region: "azura", productId: "bread" }],
    shortfall: 0,
    ...overrides,
  };
}

describe("form choices", () => {
  test("'all' means every region or the whole range", () => {
    expect(parseRegionChoice(ALL)).toBeNull();
    expect(parseRegionChoice("nordhaven")).toBe("nordhaven");
    expect(parseRegionChoice("atlantis")).toBeUndefined();
    expect(parseProductChoice(ALL)).toBeNull();
    expect(parseProductChoice("soap")).toBe("soap");
    expect(parseProductChoice("flour")).toBeUndefined();
  });

  test("only the engine's durations are allowed", () => {
    for (const days of marketingRules.durations) expect(isDuration(days)).toBe(true);
    expect(isDuration(10)).toBe(false);
  });
});

describe("targets", () => {
  test("same target compares region and product, null included", () => {
    expect(
      sameTarget({ region: null, productId: "bread" }, { region: null, productId: "bread" }),
    ).toBe(true);
    expect(
      sameTarget({ region: null, productId: null }, { region: "azura", productId: null }),
    ).toBe(false);
  });

  test("a broad target reaches every pair under it", () => {
    expect(
      reaches({ region: null, productId: null }, { region: "ferronia", productId: "soap" }),
    ).toBe(true);
    expect(
      reaches({ region: "azura", productId: null }, { region: "azura", productId: "soap" }),
    ).toBe(true);
    expect(
      reaches({ region: "azura", productId: null }, { region: "ferronia", productId: "soap" }),
    ).toBe(false);
    expect(
      reaches({ region: null, productId: "bread" }, { region: "ferronia", productId: "soap" }),
    ).toBe(false);
  });

  test("targets overlap when they share a product in a region", () => {
    expect(
      overlaps({ region: "azura", productId: null }, { region: null, productId: "bread" }),
    ).toBe(true);
    expect(
      overlaps({ region: "azura", productId: "bread" }, { region: "azura", productId: "soap" }),
    ).toBe(false);
    expect(
      overlaps({ region: "azura", productId: null }, { region: "nordhaven", productId: null }),
    ).toBe(false);
  });

  test("pairs of a target", () => {
    expect(targetPairs({ region: "azura", productId: "bread" })).toEqual([
      { region: "azura", productId: "bread" },
    ]);
    expect(targetPairs({ region: null, productId: "bread" })).toHaveLength(4);
    expect(targetPairs({ region: "azura", productId: null })).toHaveLength(8);
    expect(targetPairs({ region: null, productId: null })).toHaveLength(32);
  });

  test("offers are the priced pairs, region by region", () => {
    const prices: TeamState["prices"] = {
      ferronia: { soap: 30 },
      azura: { soap: 22, bread: 25 },
      nordhaven: {},
    };
    expect(offersOf(prices)).toEqual([
      { region: "azura", productId: "bread" },
      { region: "azura", productId: "soap" },
      { region: "ferronia", productId: "soap" },
    ]);
    expect(offersOf(noPrices)).toEqual([]);
  });
});

describe("active campaigns and coverage", () => {
  test("keeps campaigns still in effect, the soonest to end first", () => {
    const list = activeCampaigns(
      {
        a: campaign({ id: "c-12", endDay: 30 }),
        b: campaign({ id: "c-3", endDay: 11 }),
        c: campaign({ id: "c-9", endDay: 8 }),
        d: campaign({ id: "c-10", endDay: 11, startDay: 5 }),
      },
      9,
    );
    expect(list.map((c) => c.id)).toEqual(["c-10", "c-3", "c-12"]);
  });

  test("finds the campaign on exactly a target", () => {
    const list = [campaign({ id: "c-1", productId: null }), campaign({ id: "c-2" })];
    expect(campaignOn(list, { region: "azura", productId: "bread" })?.id).toBe("c-2");
    expect(campaignOn(list, { region: null, productId: "bread" })).toBeUndefined();
  });

  test("a target is covered until the earliest end among its pairs", () => {
    const target = { region: "azura" as const, productId: null };
    expect(coveredUntil(target, [])).toBeNull();
    // Bread only: the other products of Azura are free.
    expect(coveredUntil(target, [campaign({ id: "c-1", endDay: 20 })])).toBeNull();
    // Whole range in every region covers everything.
    expect(
      coveredUntil(target, [campaign({ id: "c-1", region: null, productId: null, endDay: 20 })]),
    ).toBe(20);
    // Bread is covered until 25, the rest of the range until 18.
    expect(
      coveredUntil(target, [
        campaign({ id: "c-1", endDay: 25 }),
        campaign({ id: "c-2", productId: null, endDay: 18 }),
      ]),
    ).toBe(18);
  });
});

describe("time", () => {
  test("the launch day counts as the first day", () => {
    expect(endDayOf(10, 7)).toBe(16);
    expect(daysLeft(16, 10)).toBe(7);
    expect(daysLeft(16, 16)).toBe(1);
    expect(daysLeft(16, 17)).toBe(0);
  });

  test("days left in words", () => {
    expect(daysLeftLabel(16, 10)).toBe("7 jours restants");
    expect(daysLeftLabel(16, 15)).toBe("2 jours restants");
    expect(daysLeftLabel(16, 16)).toBe("Dernier jour");
    expect(daysLeftLabel(16, 17)).toBe("Terminée");
  });

  test("simulated days until the last day is over", () => {
    expect(daysUntilEnd(16, { day: 10, step: 0 }, 4)).toBe(7);
    expect(daysUntilEnd(16, { day: 16, step: 2 }, 4)).toBe(0.5);
    expect(daysUntilEnd(16, { day: 18, step: 0 }, 4)).toBe(0);
  });

  test("elapsed share of a campaign", () => {
    const running = { startDay: 10, endDay: 16 };
    expect(campaignProgress(running, { day: 10, step: 0 }, 4)).toBe(0);
    expect(campaignProgress(running, { day: 13, step: 2 }, 4)).toBeCloseTo(3.5 / 7);
    expect(campaignProgress(running, { day: 20, step: 0 }, 4)).toBe(1);
  });
});

describe("plan of a new campaign", () => {
  const prices: TeamState["prices"] = { azura: { bread: 25, soap: 22 }, ferronia: { soap: 30 } };

  test("cost, end day and offers reached", () => {
    const result = planCampaign({
      target: { region: "azura", productId: null },
      days: 14,
      today: 10,
      campaigns: [],
      prices,
      available: 50_000,
    });
    expect(result.cost).toBe(campaignCost("azura", null, 14));
    expect(result.endDay).toBe(23);
    expect(result.offers).toEqual([
      { region: "azura", productId: "bread" },
      { region: "azura", productId: "soap" },
    ]);
    expect(result.shortfall).toBe(0);
    expect(result.duplicate).toBeNull();
    expect(result.coveredUntil).toBeNull();
  });

  test("an identical target is a duplicate, not an overlap", () => {
    const same = campaign({ id: "c-1" });
    const broad = campaign({ id: "c-2", productId: null, endDay: 12 });
    const elsewhere = campaign({ id: "c-3", region: "nordhaven" });
    const result = planCampaign({
      target: { region: "azura", productId: "bread" },
      days: 7,
      today: 10,
      campaigns: [same, broad, elsewhere],
      prices,
      available: 50_000,
    });
    expect(result.duplicate?.id).toBe("c-1");
    expect(result.overlapping.map((c) => c.id)).toEqual(["c-2"]);
    expect(result.coveredUntil).toBe(12);
  });

  test("shortfall against the available cash", () => {
    const result = planCampaign({
      target: { region: null, productId: null },
      days: 30,
      today: 1,
      campaigns: [],
      prices,
      available: 1_000,
    });
    expect(result.shortfall).toBe(campaignCost(null, null, 30) - 1_000);
  });
});

describe("messages before a launch", () => {
  test("nothing to say about a clean target", () => {
    expect(campaignMessages(plan(), 0)).toEqual([]);
  });

  test("an identical target blocks, and hides the coverage notes", () => {
    const messages = campaignMessages(
      plan({ duplicate: campaign({ id: "c-1" }), coveredUntil: 16, offers: [] }),
      0,
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]?.tone).toBe("error");
    expect(messages[0]?.text).toContain("jusqu'au jour 16");
    expect(messages[0]?.text).toContain("dès le jour 17");
  });

  test("missing cash blocks, with the amount locked by bids", () => {
    const [message] = campaignMessages(plan({ shortfall: 300 }), 2_000);
    expect(message?.tone).toBe("error");
    expect(message?.text).toContain("₢300");
    // fr-FR groups thousands with a narrow no-break space.
    expect(message?.text).toMatch(/₢2\s000 bloqués par vos enchères/);
  });

  test("a target already covered past the end would bring nothing", () => {
    const messages = campaignMessages(
      plan({ coveredUntil: 20, overlapping: [campaign({ id: "c-2", productId: null })] }),
      0,
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]?.tone).toBe("warning");
    expect(messages[0]?.text).toContain("n'apporterait rien");
  });

  test("a target covered for a while only acts afterwards", () => {
    const [message] = campaignMessages(
      plan({ coveredUntil: 12, overlapping: [campaign({ id: "c-2", productId: null })] }),
      0,
    );
    expect(message?.tone).toBe("warning");
    expect(message?.text).toContain("qu'à partir du jour 13");
  });

  test("a partial overlap is explained, without blocking", () => {
    const [message] = campaignMessages(
      plan({
        target: { region: "azura", productId: null },
        overlapping: [campaign({ id: "c-1" })],
      }),
      0,
    );
    expect(message?.tone).toBe("info");
    expect(message?.text).toContain("« Pain, Azura » (jusqu'au jour 16)");
  });

  test("warns when nothing is on sale in the target", () => {
    const one = campaignMessages(plan({ offers: [] }), 0);
    expect(one).toEqual([
      {
        tone: "warning",
        text: "Vous ne vendez pas « Pain » à Azura. Sans prix fixé (page Ventes), la campagne n'attirera aucun client.",
      },
    ]);
    const all = campaignMessages(
      plan({ target: { region: null, productId: null }, offers: [] }),
      0,
    );
    expect(all[0]?.text).toStartWith("Vous ne vendez encore rien.");
  });
});

describe("labels", () => {
  test("rules in words", () => {
    expect(boostLabel()).toMatch(/^\+20\s%$/);
    expect(rangeFactorLabel()).toBe("2,5");
    expect(blockedReason("running")).toBeNull();
    expect(blockedReason("paused")).toContain("pause");
  });

  test("targets as the activity log writes them", () => {
    expect(targetLabel({ region: null, productId: null })).toBe(
      "Toute la gamme, toutes les régions",
    );
    expect(targetLabel({ region: "port-libre", productId: "soap" })).toBe("Savon, Port-Libre");
    expect(capitalize("")).toBe("");
  });

  test("what a target reaches among the products on sale", () => {
    expect(onSaleLabel({ region: "azura", productId: "bread" }, 1)).toBe("En vente");
    expect(onSaleLabel({ region: "azura", productId: "bread" }, 0)).toBe("Pas en vente");
    expect(onSaleLabel({ region: "azura", productId: null }, 2)).toBe("2 produits en vente");
    expect(onSaleLabel({ region: "azura", productId: null }, 0)).toBe("Rien en vente");
    expect(onSaleLabel({ region: null, productId: "bread" }, 1)).toBe("En vente dans 1 région");
    expect(onSaleLabel({ region: null, productId: "bread" }, 0)).toBe("En vente nulle part");
    expect(onSaleLabel({ region: null, productId: null }, 5)).toBe("5 offres en vente");
    expect(onSaleLabel({ region: null, productId: null }, 0)).toBe("Rien en vente");
  });

  test("lists and plurals", () => {
    expect(listLabel([])).toBe("");
    expect(listLabel(["a"])).toBe("a");
    expect(listLabel(["a", "b", "c"])).toBe("a, b et c");
    expect(plural(0, "offre")).toBe("0 offre");
    expect(plural(3, "offre")).toBe("3 offres");
  });

  test("offers grouped by region or product", () => {
    expect(offersLabel([])).toBe("");
    expect(
      offersLabel([
        { region: "azura", productId: "bread" },
        { region: "azura", productId: "soap" },
      ]),
    ).toBe("Pain et Savon à Azura");
    expect(
      offersLabel([
        { region: "azura", productId: "bread" },
        { region: "ferronia", productId: "bread" },
      ]),
    ).toBe("Pain à Azura et Ferronia");
    expect(
      offersLabel([
        { region: "azura", productId: "bread" },
        { region: "ferronia", productId: "soap" },
      ]),
    ).toBe("Pain à Azura et Savon à Ferronia");
    expect(
      offersLabel(
        [
          { region: "azura", productId: "bread" },
          { region: "azura", productId: "soap" },
          { region: "azura", productId: "clothing" },
          { region: "azura", productId: "kettle" },
        ],
        2,
      ),
    ).toBe("Pain, Savon et 2 autres à Azura");
  });
});
