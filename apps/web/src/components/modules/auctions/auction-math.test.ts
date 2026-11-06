import { describe, expect, test } from "bun:test";
import { scenarioAuctions } from "@etic/content";
import { type Actor, type GameState, gameEngine, teamView } from "@etic/engine";
import {
  type AuctionView,
  auctionOutcome,
  auctionTotals,
  bidBlockedReason,
  canAffordMinimum,
  checkBid,
  endsBeforeClose,
  minimumBid,
  plural,
  rewardFollowUp,
  splitAuctions,
  stepsUntilClose,
  windowElapsed,
} from "./auction-math.ts";

const clean = (text: string | null) => text?.replace(/\s/g, " ") ?? null;

const ORGANIZER: Actor = { kind: "organizer", userId: "org", name: "Org" };
const TEAMS = ["t1", "t2", "t3"] as const;

function member(teamId: string): Actor {
  return { kind: "team", teamId, userId: `u-${teamId}`, name: `Joueur ${teamId}` };
}

function apply(state: GameState, actor: Actor, type: string, payload?: unknown): GameState {
  const result = gameEngine.applyCommand(state, actor, { type, payload });
  if (!result.ok) throw new Error(`${type} refused: ${result.refusal.message}`);
  return result.state;
}

/** A running game with three companies, at the first step of `day`. */
function gameAt(day: number): GameState {
  let state = gameEngine.createGame({
    id: "g-auctions",
    seed: "auctions",
    config: { stepsPerDay: 4, countdownDays: 30 },
    teams: TEAMS.map((id, index) => ({
      id,
      name: `Équipe ${index + 1}`,
      members: [{ userId: `u-${id}`, name: `Joueur ${id}` }],
    })),
  });
  for (const id of TEAMS) {
    state = apply(state, member(id), "lobby.setCompanyName", { companyName: `Société ${id}` });
    state = apply(state, member(id), "lobby.chooseRegion", { region: "azura" });
  }
  state = apply(state, ORGANIZER, "control.start");
  state.time = { day: day - 1, step: state.config.stepsPerDay - 1 };
  return gameEngine.step(state);
}

function steps(state: GameState, count: number): GameState {
  let current = state;
  for (let i = 0; i < count; i++) current = gameEngine.step(current);
  return current;
}

function patentOf(state: GameState, teamId: string): AuctionView {
  const auction = teamView(state, teamId)?.auctions.find((item) => item.id === "auction-patent");
  if (!auction) throw new Error("no patent auction");
  return auction;
}

const bid = (amount: number) => ({ auctionId: "auction-patent", amount });

function lot(overrides: Partial<AuctionView>): AuctionView {
  return {
    id: "auction-patent",
    title: "Brevet d'optimisation",
    description: "",
    startingPrice: 5_000,
    status: "open",
    closesDay: 132,
    myBid: null,
    winner: null,
    wonByMe: false,
    ...overrides,
  };
}

describe("bid amount", () => {
  test("the first bid starts at the starting price, a raise goes strictly above", () => {
    expect(minimumBid({ startingPrice: 5_000, myBid: null })).toBe(5_000);
    expect(minimumBid({ startingPrice: 5_000, myBid: 6_000 })).toBe(6_001);
  });

  test("the smallest bid must be affordable: the starting price, then one more crédit", () => {
    expect(canAffordMinimum({ startingPrice: 5_000, myBid: null }, 5_000)).toBe(true);
    expect(canAffordMinimum({ startingPrice: 5_000, myBid: null }, 4_999)).toBe(false);
    expect(canAffordMinimum({ startingPrice: 5_000, myBid: 6_000 }, 1)).toBe(true);
    expect(canAffordMinimum({ startingPrice: 5_000, myBid: 6_000 }, 0)).toBe(false);
    expect(canAffordMinimum({ startingPrice: 5_000, myBid: 6_000 }, -300)).toBe(false);
  });

  test("nothing typed is neither valid nor an error", () => {
    expect(checkBid("  ", { startingPrice: 5_000, myBid: null }, 50_000)).toEqual({
      amount: null,
      extra: 0,
      error: null,
    });
  });

  test("spaces and the crédit sign are ignored", () => {
    expect(checkBid("₢7 000", { startingPrice: 5_000, myBid: null }, 50_000)).toEqual({
      amount: 7_000,
      extra: 7_000,
      error: null,
    });
    expect(checkBid("7 000", { startingPrice: 5_000, myBid: null }, 50_000).amount).toBe(7_000);
  });

  test("whole crédits only", () => {
    for (const raw of ["7000,5", "7.000", "-7000", "abc"]) {
      expect(checkBid(raw, { startingPrice: 5_000, myBid: null }, 50_000)).toMatchObject({
        amount: null,
        error: "Saisissez un nombre entier de crédits.",
      });
    }
    expect(checkBid("9".repeat(30), { startingPrice: 5_000, myBid: null }, 50_000).error).toBe(
      "Montant trop élevé.",
    );
  });

  test("below the starting price, with the engine's wording", () => {
    const check = checkBid("4000", { startingPrice: 5_000, myBid: null }, 50_000);
    expect(check.amount).toBe(4_000);
    expect(clean(check.error)).toBe("L'offre minimale est de ₢5 000.");
  });

  test("a bid can only go up", () => {
    const check = checkBid("6000", { startingPrice: 5_000, myBid: 6_000 }, 50_000);
    expect(check.extra).toBe(0);
    expect(clean(check.error)).toBe("Votre offre ne peut qu'augmenter : elle est de ₢6 000.");
  });

  test("only the difference is locked and must be available", () => {
    expect(checkBid("9000", { startingPrice: 5_000, myBid: 6_000 }, 3_000)).toEqual({
      amount: 9_000,
      extra: 3_000,
      error: null,
    });
    const short = checkBid("9500", { startingPrice: 5_000, myBid: 6_000 }, 3_000);
    expect(short.extra).toBe(3_500);
    expect(clean(short.error)).toBe("Trésorerie disponible insuffisante : il manque ₢500.");
  });

  test("matches the engine: what the check accepts, auction.bid accepts", () => {
    const state = gameAt(130);
    const available = (state.teams.t1?.cash ?? 0) - (state.teams.t1?.reservedCash ?? 0);
    const check = checkBid("12 000", patentOf(state, "t1"), available);
    expect(check.error).toBeNull();
    const after = apply(state, member("t1"), "auction.bid", bid(check.amount ?? 0));
    expect(after.teams.t1?.reservedCash).toBe(12_000);
    const raise = checkBid("15000", patentOf(after, "t1"), available - 12_000);
    expect(raise).toMatchObject({ amount: 15_000, extra: 3_000, error: null });
  });
});

describe("closing time", () => {
  test("bids are accepted until the end of the closing day", () => {
    expect(stepsUntilClose(132, { day: 130, step: 0 }, 4)).toBe(12);
    expect(stepsUntilClose(132, { day: 132, step: 3 }, 4)).toBe(1);
    expect(stepsUntilClose(132, { day: 133, step: 0 }, 4)).toBe(0);
  });

  test("the engine closes the auction right after the last counted step", () => {
    let state = gameAt(130);
    const { stepsPerDay } = state.config;
    const auction = patentOf(state, "t1");
    const left = stepsUntilClose(auction.closesDay, state.time, stepsPerDay);
    state = steps(state, left - 1);
    expect(patentOf(state, "t1").status).toBe("open");
    expect(stepsUntilClose(auction.closesDay, state.time, stepsPerDay)).toBe(1);
    state = steps(state, 1);
    expect(patentOf(state, "t1").status).toBe("closed");
  });

  test("elapsed share of the bidding window", () => {
    expect(windowElapsed("auction-patent", 132, { day: 130, step: 0 }, 4)).toBe(0);
    expect(windowElapsed("auction-patent", 132, { day: 131, step: 2 }, 4)).toBe(0.5);
    expect(windowElapsed("auction-patent", 132, { day: 140, step: 0 }, 4)).toBe(1);
    expect(windowElapsed("unknown", 132, { day: 130, step: 0 }, 4)).toBeNull();
  });

  test("an end scheduled on or before the closing day cancels the auction", () => {
    expect(endsBeforeClose(132, null)).toBe(false);
    expect(endsBeforeClose(132, 133)).toBe(false);
    expect(endsBeforeClose(132, 132)).toBe(true);
    expect(endsBeforeClose(132, 131)).toBe(true);

    let state = gameAt(130);
    state = apply(state, ORGANIZER, "control.setEndDay", { endDay: 132 });
    state = apply(state, member("t1"), "auction.bid", bid(6_000));
    state = steps(state, stepsUntilClose(132, state.time, state.config.stepsPerDay));
    expect(state.status).toBe("ended");
    const auction = patentOf(state, "t1");
    expect(auction).toMatchObject({ status: "closed", winner: null });
    expect(auctionOutcome(auction, { status: state.status, time: state.time })).toBe("cancelled");
    expect(state.teams.t1?.reservedCash).toBe(0);
  });
});

describe("outcome", () => {
  test("winner, loser and a company that did not bid", () => {
    let state = gameAt(130);
    state = apply(state, member("t1"), "auction.bid", bid(6_000));
    state = apply(state, member("t2"), "auction.bid", bid(7_313));
    state = steps(state, 12);
    const clock = { status: state.status, time: state.time };
    const [won, lost, none] = [patentOf(state, "t2"), patentOf(state, "t1"), patentOf(state, "t3")];
    expect(auctionOutcome(won, clock)).toBe("won");
    expect(auctionOutcome(lost, clock)).toBe("lost");
    expect(auctionOutcome(none, clock)).toBe("no-bid");
    // The winner's name is public; the loser only knows its own amount, now returned.
    expect(lost).toMatchObject({ winner: "Société t2", myBid: 6_000, wonByMe: false });
    expect(JSON.stringify(teamView(state, "t1"))).not.toContain("7313");
    expect(state.teams.t1?.reservedCash).toBe(0);
  });

  test("nobody bid: the lot is withdrawn", () => {
    const state = steps(gameAt(130), 12);
    const auction = patentOf(state, "t1");
    expect(auctionOutcome(auction, { status: state.status, time: state.time })).toBe("unsold");
  });

  test("the organizer ends the game during the auction: every bid is returned", () => {
    let state = gameAt(130);
    state = apply(state, member("t1"), "auction.bid", bid(6_000));
    state = apply(state, ORGANIZER, "control.end");
    const clock = { status: state.status, time: state.time };
    expect(auctionOutcome(patentOf(state, "t1"), clock)).toBe("cancelled");
    expect(auctionOutcome(patentOf(state, "t2"), clock)).toBe("cancelled");
  });
});

describe("lists and labels", () => {
  test("open auctions closing first, closed ones most recent first", () => {
    const auctions = [
      lot({ id: "a", status: "closed", closesDay: 132 }),
      lot({ id: "b", status: "open", closesDay: 334 }),
      lot({ id: "c", status: "closed", closesDay: 232 }),
      lot({ id: "d", status: "open", closesDay: 332 }),
    ];
    const { open, closed } = splitAuctions(auctions);
    expect(open.map((auction) => auction.id)).toEqual(["d", "b"]);
    expect(closed.map((auction) => auction.id)).toEqual(["c", "a"]);
  });

  test("totals", () => {
    const totals = auctionTotals([
      lot({ id: "a", status: "closed", myBid: 6_000, winner: "Moi", wonByMe: true }),
      lot({ id: "b", status: "closed" }),
      lot({ id: "c", status: "open", myBid: 9_000 }),
      lot({ id: "d", status: "open" }),
    ]);
    expect(totals.openBids).toBe(1);
    expect(totals.closed).toBe(2);
    expect(totals.won.map((auction) => auction.id)).toEqual(["a"]);
  });

  test("every lot of the scenario says where it takes effect", () => {
    for (const auction of scenarioAuctions) expect(rewardFollowUp(auction.id)).not.toBeNull();
    expect(rewardFollowUp("auction-next-gen")?.text).toContain("3 opérateurs");
    expect(rewardFollowUp("auction-export")?.to).toBe("/play/livraisons");
    expect(rewardFollowUp("unknown")).toBeNull();
  });

  test("blocked reasons and plurals", () => {
    expect(bidBlockedReason("running")).toBeNull();
    expect(bidBlockedReason("paused")).toContain("pause");
    expect(bidBlockedReason("ended")).toContain("terminée");
    expect(plural(1, "offre")).toBe("1 offre");
    expect(plural(2, "offre")).toBe("2 offres");
  });
});
