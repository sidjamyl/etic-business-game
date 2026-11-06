import { describe, expect, test } from "bun:test";
import { scenarioAuctions } from "@etic/content";
import type { RankingEntry } from "@etic/engine";
import {
  activeEventLabel,
  auctionOutcome,
  cardInfo,
  companyLabel,
  companyNameOf,
  endTimeToday,
  errorMessage,
  formatClockTime,
  formatDurationMs,
  formatIndicator,
  formatScore,
  goodLabel,
  hasBlackMarketActivity,
  inDaysLabel,
  inventorySummary,
  isRehearsal,
  isRevealed,
  machineSummary,
  OFFLINE_MESSAGE,
  placeLabel,
  plural,
  rankedBids,
  ratingTone,
  revealProgress,
  saveIsLate,
  serverHealth,
  sortAuctions,
  sortCompanies,
  speedLabel,
  startingPrice,
  stepHealth,
  stepIntervalMs,
  tierLabel,
  transportLabel,
  upcomingAuctions,
} from "./control-room-helpers";

function entry(rank: number, companyName: string): RankingEntry {
  return {
    rank,
    teamId: `t${rank}`,
    companyName,
    netCash: 10_000 * (5 - rank),
    economic: 100 - rank * 10,
    environmental: 50,
    social: 50,
    impact: 50,
    final: 80 - rank * 10,
  };
}

const ranking = [entry(1, "Alpha"), entry(2, "Bravo"), entry(3, "Charlie"), entry(4, "Delta")];

describe("wording", () => {
  test("plural keeps 0 and 1 singular", () => {
    expect(plural(0, "trace")).toBe("0 trace");
    expect(plural(1, "trace")).toBe("1 trace");
    expect(plural(3, "trace")).toBe("3 traces");
    expect(plural(2, "vendue", "vendues")).toBe("2 vendues");
  });

  test("placeLabel uses French ordinals", () => {
    expect(placeLabel(1)).toBe("1re place");
    expect(placeLabel(2)).toBe("2e place");
    expect(placeLabel(12)).toBe("12e place");
  });

  test("formatScore shows one decimal with a comma", () => {
    expect(formatScore(72.4)).toBe("72,4");
    expect(formatScore(100)).toBe("100,0");
    expect(formatScore(0)).toBe("0,0");
  });

  test("formatIndicator drops a useless decimal", () => {
    expect(formatIndicator(65.3)).toBe("65,3");
    expect(formatIndicator(50)).toBe("50");
  });
});

describe("companies", () => {
  test("companyLabel prefers the chosen company name", () => {
    expect(companyLabel({ name: "Équipe 1", companyName: "Pain d'Or" })).toBe("Pain d'Or");
    expect(companyLabel({ name: "Équipe 1", companyName: null })).toBe("Équipe 1");
  });

  test("sortCompanies follows the creation order, t10 after t9", () => {
    const sorted = sortCompanies([{ id: "t10" }, { id: "t2" }, { id: "t1" }, { id: "t9" }]);
    expect(sorted.map((company) => company.id)).toEqual(["t1", "t2", "t9", "t10"]);
  });

  test("companyNameOf resolves a team id", () => {
    const companies = {
      t1: { name: "Équipe 1", companyName: "Pain d'Or" },
      t2: { name: "Équipe 2", companyName: null },
    };
    expect(companyNameOf(companies, "t1")).toBe("Pain d'Or");
    expect(companyNameOf(companies, "t2")).toBe("Équipe 2");
    expect(companyNameOf(companies, "t9")).toBe("Entreprise inconnue");
    expect(companyNameOf(companies, null)).toBe("—");
  });

  test("tierLabel adds the branch at tier 3", () => {
    expect(tierLabel(1, null)).toBe("1");
    expect(tierLabel(3, "tech")).toBe("3 · Tech");
    expect(tierLabel(3, "leisure")).toBe("3 · Loisirs");
  });

  test("cardInfo names the secret card", () => {
    expect(cardInfo({ id: "spying", used: false })).toEqual({ name: "Espionnage", used: false });
    expect(cardInfo({ id: "fake-news", used: true })).toEqual({ name: "Fake news", used: true });
    expect(cardInfo(null)).toBeNull();
  });

  test("machineSummary counts running machines and averages efficiency", () => {
    expect(
      machineSummary([
        { status: "running", efficiency: 1 },
        { status: "waiting-materials", efficiency: 0.8 },
        { status: "running", efficiency: 0.9 },
      ]),
    ).toEqual({ running: 2, total: 3, averageEfficiency: 0.9 });
    expect(machineSummary([])).toEqual({ running: 0, total: 0, averageEfficiency: null });
  });

  test("inventorySummary lists stocks largest first and skips empty items", () => {
    const summary = inventorySummary({ flour: 120, bread: 40, water: 0, soap: 40 });
    expect(summary.total).toBe(200);
    expect(summary.lines.map((line) => line.id)).toEqual(["flour", "bread", "soap"]);
    expect(summary.lines[0]?.label).toBe("Farine");
    expect(inventorySummary({})).toEqual({ total: 0, lines: [] });
  });

  test("hasBlackMarketActivity spots any trace, deal or conviction", () => {
    const none = { recentTraces: 0, purchasedUnits: 0, soldUnits: 0, convictions: 0 };
    expect(hasBlackMarketActivity(none)).toBe(false);
    expect(hasBlackMarketActivity({ ...none, soldUnits: 5 })).toBe(true);
    expect(hasBlackMarketActivity({ ...none, convictions: 1 })).toBe(true);
  });

  test("ratingTone uses the players' thresholds", () => {
    expect(ratingTone(80)).toBe("success");
    expect(ratingTone(65)).toBe("success");
    expect(ratingTone(50)).toBe("warning");
    expect(ratingTone(39)).toBe("danger");
  });
});

describe("clock and end of game", () => {
  test("isRehearsal and speedLabel describe the clock speed", () => {
    expect(isRehearsal(60_000)).toBe(false);
    expect(isRehearsal(5_000)).toBe(true);
    expect(speedLabel(60_000)).toBe("1 jour = 1 min");
    expect(speedLabel(5_000)).toBe("1 jour = 5 s");
    expect(speedLabel(2_500)).toBe("1 jour = 2,5 s");
  });

  test("stepIntervalMs splits a day into its sub-steps", () => {
    expect(stepIntervalMs(60_000, 4)).toBe(15_000);
    expect(stepIntervalMs(60_000, 0)).toBe(60_000);
  });

  test("inDaysLabel gives the simulated and real delay", () => {
    expect(inDaysLabel(42, 42, 60_000)).toBe("aujourd'hui");
    expect(inDaysLabel(40, 42, 60_000)).toBe("aujourd'hui");
    expect(inDaysLabel(54, 42, 60_000)).toBe("dans 12 j · ≈ 12 min");
  });

  test("activeEventLabel shows the period and the days left", () => {
    expect(activeEventLabel({ startDay: 25, endDay: 39 }, 35)).toBe("Jours 25 à 39 · encore 5 j");
    expect(activeEventLabel({ startDay: 25, endDay: 39 }, 39)).toBe("Jours 25 à 39 · encore 1 j");
    expect(activeEventLabel({ startDay: 60, endDay: null }, 80)).toBe(
      "Depuis le jour 60 · effet durable",
    );
  });

  test("endTimeToday accepts a time still ahead today", () => {
    const now = new Date(2026, 10, 6, 14, 0);
    const result = endTimeToday("18:00", now);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.endsAt.getHours()).toBe(18);
      expect(result.endsAt.getMinutes()).toBe(0);
      expect(result.endsAt.getDate()).toBe(6);
    }
    expect(endTimeToday("17:30:00", now).ok).toBe(true);
  });

  test("endTimeToday refuses a past or malformed time", () => {
    const now = new Date(2026, 10, 6, 14, 0);
    expect(endTimeToday("12:00", now)).toEqual({
      ok: false,
      message: "Cette heure est déjà passée : choisissez une heure à venir.",
    });
    expect(endTimeToday("14:00", now).ok).toBe(false);
    expect(endTimeToday("", now)).toEqual({
      ok: false,
      message: "Indiquez une heure, par exemple 18:00.",
    });
    expect(endTimeToday("25:00", now).ok).toBe(false);
  });
});

describe("auctions", () => {
  test("rankedBids sorts by amount, then earliest bid", () => {
    const bids = rankedBids({
      t1: { amount: 6_000, order: 12 },
      t2: { amount: 8_000, order: 15 },
      t3: { amount: 6_000, order: 9 },
    });
    expect(bids.map((bid) => bid.teamId)).toEqual(["t2", "t3", "t1"]);
    expect(rankedBids({})).toEqual([]);
  });

  test("auctionOutcome tells open, won, unsold and cancelled apart", () => {
    const bids = { t1: { amount: 6_000, order: 1 } };
    expect(auctionOutcome({ status: "open", winnerTeamId: null, bids })).toBe("open");
    expect(auctionOutcome({ status: "closed", winnerTeamId: "t1", bids })).toBe("won");
    expect(auctionOutcome({ status: "closed", winnerTeamId: null, bids: {} })).toBe("unsold");
    expect(auctionOutcome({ status: "closed", winnerTeamId: null, bids })).toBe("cancelled");
  });

  test("sortAuctions lists open auctions first", () => {
    const sorted = sortAuctions([
      { id: "a", status: "closed" as const, opensDay: 130, closesDay: 132 },
      { id: "b", status: "open" as const, opensDay: 330, closesDay: 332 },
      { id: "c", status: "closed" as const, opensDay: 230, closesDay: 232 },
    ]);
    expect(sorted.map((auction) => auction.id)).toEqual(["b", "c", "a"]);
  });

  test("startingPrice and upcomingAuctions read the scenario", () => {
    const [first, ...others] = scenarioAuctions;
    if (!first) throw new Error("The scenario has auctions");
    expect(startingPrice(first.id)).toBe(first.startingPrice);
    expect(startingPrice("unknown")).toBeNull();
    const upcoming = upcomingAuctions([first.id]);
    expect(upcoming.map((auction) => auction.id)).toEqual(
      [...others].sort((a, b) => a.openDay - b.openDay).map((auction) => auction.id),
    );
    expect(upcomingAuctions(scenarioAuctions.map((auction) => auction.id))).toEqual([]);
  });
});

describe("trades", () => {
  test("goodLabel describes items and machines", () => {
    expect(goodLabel({ kind: "item", item: "flour", quantity: 120 })).toBe("120 × Farine");
    expect(goodLabel({ kind: "machine", machineId: "m-1", typeId: "oven" })).toBe(
      "Four industriel",
    );
    expect(goodLabel({ kind: "machine", machineId: "m-2", typeId: "unknown" })).toBe("Machine");
  });

  test("transportLabel names the option", () => {
    expect(transportLabel("express")).toBe("Express (avion)");
  });
});

describe("final reveal", () => {
  test("the reveal starts from the last place", () => {
    const progress = revealProgress({ ranking, revealedCount: 0, breakdownShown: false });
    expect(progress).toMatchObject({ total: 4, revealed: 0, allRevealed: false });
    expect(progress.next?.companyName).toBe("Delta");
    expect(revealProgress({ ranking, revealedCount: 3, breakdownShown: false }).next?.rank).toBe(1);
  });

  test("nothing is left to reveal once the winner is known", () => {
    const progress = revealProgress({ ranking, revealedCount: 4, breakdownShown: true });
    expect(progress).toMatchObject({ next: null, allRevealed: true, breakdownShown: true });
  });

  test("isRevealed marks the ranks the room has seen", () => {
    expect(isRevealed(4, 4, 1)).toBe(true);
    expect(isRevealed(3, 4, 1)).toBe(false);
    expect(isRevealed(1, 4, 4)).toBe(true);
    expect(isRevealed(1, 4, 0)).toBe(false);
  });
});

describe("server health", () => {
  const stepMs = 15_000;

  test("stepHealth weighs the duration against the step interval", () => {
    expect(stepHealth(2, stepMs)).toBe("good");
    expect(stepHealth(150, stepMs)).toBe("slow");
    expect(stepHealth(1_200, stepMs)).toBe("critical");
    // Rehearsal at 1 s per day: 250 ms between steps.
    expect(stepHealth(60, 250)).toBe("slow");
    expect(stepHealth(130, 250)).toBe("critical");
  });

  test("saveIsLate flags saves trailing several steps behind", () => {
    const at = (seconds: number) => new Date(Date.UTC(2026, 10, 6, 14, 0, seconds)).toISOString();
    expect(saveIsLate({ lastStepAt: null, lastSavedAt: null }, stepMs)).toBe(false);
    expect(saveIsLate({ lastStepAt: at(30), lastSavedAt: at(15) }, stepMs)).toBe(false);
    expect(saveIsLate({ lastStepAt: at(59), lastSavedAt: at(0) }, stepMs)).toBe(true);
    expect(saveIsLate({ lastStepAt: at(30), lastSavedAt: null }, stepMs)).toBe(true);
    // A command saved after the last step (paused game) is never late.
    expect(saveIsLate({ lastStepAt: at(0), lastSavedAt: at(50) }, stepMs)).toBe(false);
  });

  test("serverHealth keeps the worst signal", () => {
    const metrics = {
      lastStepDurationMs: 3,
      lastStepAt: "2026-11-06T14:00:30.000Z",
      lastSavedAt: "2026-11-06T14:00:15.000Z",
      subscribers: 6,
    };
    expect(serverHealth(metrics, stepMs)).toBe("good");
    expect(serverHealth({ ...metrics, lastSavedAt: null }, stepMs)).toBe("slow");
    expect(serverHealth({ ...metrics, lastStepDurationMs: 5_000 }, stepMs)).toBe("critical");
    expect(serverHealth({ ...metrics, lastStepAt: null, lastSavedAt: null }, stepMs)).toBe("good");
  });

  test("formatClockTime shows hours, minutes and seconds", () => {
    expect(formatClockTime("2026-11-06T14:32:05.000Z")).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(formatClockTime(null)).toBeNull();
    expect(formatClockTime("not a date")).toBeNull();
  });

  test("formatDurationMs switches to seconds past one second", () => {
    expect(formatDurationMs(0.42)).toBe("0,42 ms");
    expect(formatDurationMs(125)).toBe("125 ms");
    expect(formatDurationMs(1_500)).toBe("1,5 s");
  });
});

describe("errorMessage", () => {
  test("a call that never reached the server asks to check the connection", () => {
    expect(errorMessage(new Error("Failed to fetch"))).toBe(OFFLINE_MESSAGE);
  });

  test("the server's own message is kept when it is meant for people", () => {
    const error = Object.assign(new Error("Partie introuvable."), { data: { code: "NOT_FOUND" } });
    expect(errorMessage(error)).toBe("Partie introuvable.");
  });

  test("technical failures get a generic message", () => {
    const error = Object.assign(new Error("Invalid input"), { data: { code: "BAD_REQUEST" } });
    expect(errorMessage(error)).toBe("Action impossible, réessayez.");
  });
});
