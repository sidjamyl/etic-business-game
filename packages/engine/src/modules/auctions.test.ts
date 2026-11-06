import { describe, expect, test } from "bun:test";
import { gameEngine as engine } from "../index.ts";
import { advanceDays, memberOf, mustApply, ORGANIZER, refusalOf, startedGame } from "../testkit.ts";
import type { GameState, TeamState } from "../types.ts";
import { publicView, teamView } from "../views.ts";
import { credits } from "./shared.ts";

const t1 = memberOf("t1");
const t2 = memberOf("t2");
const bid = (auctionId: string, amount: number) => ({
  type: "auction.bid",
  payload: { auctionId, amount },
});

function team(state: GameState, id = "t1"): TeamState {
  const found = state.teams[id];
  if (!found) throw new Error("no team");
  return found;
}

/** Game at the first step of `day`. */
function atDay(day: number, regions: Parameters<typeof startedGame>[1] = ["azura", "azura"]) {
  const state = startedGame(engine, regions);
  state.time = { day: day - 1, step: state.config.stepsPerDay - 1 };
  return engine.step(state);
}

describe("opening", () => {
  test("the patent auction opens on day 130 with a news item", () => {
    const state = atDay(130);
    expect(state.auctions["auction-patent"]).toMatchObject({ status: "open", closesDay: 132 });
    expect(state.news.at(-1)?.title).toBe("Enchère ouverte : Brevet d'optimisation");
    expect(teamView(state, "t1")?.auctions[0]).toMatchObject({
      title: "Brevet d'optimisation",
      status: "open",
      myBid: null,
      startingPrice: 5_000,
    });
  });
});

describe("bidding", () => {
  test("bids below the starting price are refused", () => {
    expect(refusalOf(engine, atDay(130), t1, bid("auction-patent", 4_000))?.message).toBe(
      `L'offre minimale est de ${credits(5_000)}.`,
    );
  });

  test("a bid locks the cash; it can only go up and only the difference is locked", () => {
    let state = mustApply(engine, atDay(130), t1, bid("auction-patent", 10_000));
    expect(team(state).reservedCash).toBe(10_000);
    expect(team(state).cash).toBe(50_000);
    expect(refusalOf(engine, state, t1, bid("auction-patent", 9_000))?.code).toBe("BID_TOO_LOW");
    state = mustApply(engine, state, t1, bid("auction-patent", 12_000));
    expect(team(state).reservedCash).toBe(12_000);
  });

  test("locked cash cannot be spent elsewhere", () => {
    const state = mustApply(engine, atDay(130), t1, bid("auction-patent", 45_000));
    const refusal = refusalOf(engine, state, t1, {
      type: "marketing.launch",
      payload: { region: null, productId: null, days: 30 },
    });
    expect(refusal?.code).toBe("INSUFFICIENT_FUNDS");
    expect(refusal?.message).toContain("bloqués par vos enchères");
  });

  test("bids are sealed: nobody else sees the amount", () => {
    const state = mustApply(engine, atDay(130), t1, bid("auction-patent", 7_777));
    expect(JSON.stringify(teamView(state, "t2"))).not.toContain("7777");
    expect(JSON.stringify(publicView(state))).not.toContain("7777");
    expect(teamView(state, "t1")?.auctions[0]?.myBid).toBe(7_777);
  });
});

describe("closing", () => {
  test("highest bid wins and pays, the loser gets its cash back, the amount stays secret", () => {
    let state = atDay(130);
    state = mustApply(engine, state, t1, bid("auction-patent", 8_000));
    state = mustApply(engine, state, t2, bid("auction-patent", 9_000));
    state = advanceDays(engine, state, 3); // closes at the start of day 133
    expect(state.auctions["auction-patent"]).toMatchObject({
      status: "closed",
      winnerTeamId: "t2",
    });
    expect(team(state, "t2")).toMatchObject({ cash: 41_000, reservedCash: 0 });
    expect(team(state, "t2").perks.outputFactor).toBe(1.1);
    expect(team(state)).toMatchObject({ cash: 50_000, reservedCash: 0 });
    const result = state.news.at(-1);
    expect(result?.title).toBe("Société 2 remporte l'enchère");
    expect(JSON.stringify(result)).not.toContain("9");
    expect(teamView(state, "t1")?.auctions[0]).toMatchObject({
      winner: "Société 2",
      wonByMe: false,
    });
  });

  test("on a tie the earliest bid wins", () => {
    let state = atDay(130);
    state = mustApply(engine, state, t2, bid("auction-patent", 6_000));
    state = mustApply(engine, state, t1, bid("auction-patent", 6_000));
    state = advanceDays(engine, state, 3);
    expect(state.auctions["auction-patent"]?.winnerTeamId).toBe("t2");
  });

  test("without bids the lot is withdrawn", () => {
    const state = advanceDays(engine, atDay(130), 3);
    expect(state.auctions["auction-patent"]?.winnerTeamId).toBeNull();
    expect(state.news.at(-1)?.title).toBe("Enchère sans preneur : Brevet d'optimisation");
  });

  test("the export license cuts the winner's shipping costs by 30%", () => {
    let state = mustApply(engine, atDay(230), t1, bid("auction-export", 8_000));
    state = advanceDays(engine, state, 3);
    expect(team(state).perks.shippingFactor).toBe(0.7);
  });

  test("the next-generation line is delivered to the winner and cannot be bought", () => {
    let state = mustApply(engine, atDay(330), t1, bid("auction-next-gen", 15_000));
    expect(
      refusalOf(engine, state, t2, {
        type: "purchase.buyMachine",
        payload: { supplierId: "ferro-machines", machineTypeId: "next-gen-line" },
      })?.code,
    ).toBe("OUT_OF_STOCK");
    state = advanceDays(engine, state, 3);
    expect(Object.values(team(state).machines).map((m) => m.typeId)).toContain("next-gen-line");
    expect(teamView(state, "t2")?.market.machines["ferro-machines:next-gen-line"]).toBeUndefined();
  });

  test("ending the game during an auction releases every bid", () => {
    let state = mustApply(engine, atDay(130), t1, bid("auction-patent", 10_000));
    state = mustApply(engine, state, ORGANIZER, { type: "control.end" });
    expect(team(state)).toMatchObject({ reservedCash: 0, cash: 50_000 });
  });

  test("locked cash cannot pay the wages: the payroll waits for available cash", () => {
    let state = startedGame(engine, ["azura", "azura"]);
    state = mustApply(engine, state, t1, {
      type: "hr.hire",
      payload: { job: "operator", count: 10 },
    });
    team(state).reservedCash = 45_000;
    state = advanceDays(engine, state, 30);
    expect(team(state).hr.unpaidWages).toBe(12_000);
  });
});
