import { describe, expect, test } from "bun:test";
import { type ActivityEntry, type GameState, newMachine } from "@etic/engine";
import { tradeHistory } from "./history.ts";
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
import { companyNameOf } from "./trade-math.ts";

// Names with the characters that could trip a pattern: " : ", brackets, dots, "₢", a prefix.
const SELLER = "Atlas : Nord (SA)";
const BUYER = "Atlas";
const FRIEND = "Ça.Marche ₢ 2";

/** Every trade command once, through the real engine, then the deliveries. */
function tradingDay(): GameState {
  let state = startedGame([SELLER, BUYER, FRIEND], ["ferronia", "ferronia", "azura"]);
  teamOf(state, "t1").inventory.flour = 500;
  teamOf(state, "t1").machines.m1 = newMachine("m1", "oven");
  const t1 = member("t1");
  const t2 = member("t2");
  state = apply(state, t1, offerCommand());
  state = apply(state, t2, { type: "trade.decline", payload: { offerId: lastOfferId(state) } });
  state = apply(state, t1, offerCommand({ price: 900 }));
  state = apply(state, t1, { type: "trade.withdraw", payload: { offerId: lastOfferId(state) } });
  state = apply(state, t1, offerCommand({ good: { kind: "machine", machineId: "m1" } }));
  state = apply(state, t2, { type: "trade.accept", payload: { offerId: lastOfferId(state) } });
  state = apply(state, t1, {
    type: "transfer.money",
    payload: { toTeamId: "t3", amount: 2_500 },
  });
  state = apply(state, t1, {
    type: "transfer.goods",
    payload: {
      toTeamId: "t3",
      good: { kind: "item", item: "flour", quantity: 50 },
      option: "express",
    },
  });
  return advanceDays(state, 3);
}

function historyOf(state: GameState, teamId: string) {
  const view = viewOf(state, teamId);
  const names = Object.values(view.competitors).map(companyNameOf);
  return tradeHistory(view.team.log, names).map(({ kind, partner }) => ({ kind, partner }));
}

describe("trade history", () => {
  const state = tradingDay();

  test("the seller sees its offers, answers, sale, transfers and deliveries, latest first", () => {
    expect(historyOf(state, "t1")).toEqual([
      { kind: "gift-delivered", partner: FRIEND },
      { kind: "payment-received", partner: BUYER },
      { kind: "gift-sent", partner: FRIEND },
      { kind: "money-sent", partner: FRIEND },
      { kind: "sale", partner: BUYER },
      { kind: "offer-sent", partner: BUYER },
      { kind: "offer-sent", partner: BUYER },
      { kind: "offer-declined", partner: BUYER },
      { kind: "offer-sent", partner: BUYER },
    ]);
  });

  test("the buyer sees the offers received, the withdrawal, its purchase and the delivery", () => {
    expect(historyOf(state, "t2")).toEqual([
      { kind: "goods-received", partner: SELLER },
      { kind: "purchase", partner: SELLER },
      { kind: "offer-received", partner: SELLER },
      { kind: "offer-withdrawn", partner: SELLER },
      { kind: "offer-received", partner: SELLER },
      { kind: "offer-received", partner: SELLER },
    ]);
  });

  test("the recipient of free transfers sees the money and the goods", () => {
    expect(historyOf(state, "t3")).toEqual([
      { kind: "goods-received", partner: SELLER },
      { kind: "money-received", partner: SELLER },
    ]);
  });

  test("lines keep the log entry: message, day and the member who decided", () => {
    const decisions = tradeHistory(teamOf(state, "t1").log, [BUYER, FRIEND]).filter(
      ({ entry }) => entry.kind === "decision",
    );
    expect(decisions[0]?.entry).toMatchObject({
      day: 1,
      actor: "Joueur t1",
      message: `Envoi gratuit à ${FRIEND} : 50 × Farine.`,
    });
  });

  test("other lines of the log are left out, such as the warehouse arrival", () => {
    const log = teamOf(state, "t3").log;
    const arrival = log.find((entry) => entry.message.startsWith("Livraison reçue"));
    expect(arrival).toBeDefined();
    const kept = tradeHistory(log, [SELLER, BUYER]).map(({ entry }) => entry.id);
    expect(kept).not.toContain(arrival?.id);
  });
});

describe("matching", () => {
  const entry = (kind: ActivityEntry["kind"], message: string): ActivityEntry => ({
    id: 1,
    day: 3,
    step: 0,
    kind,
    message,
  });

  test("a line must name one of the other companies", () => {
    expect(tradeHistory([entry("event", "Inconnue vous a viré ₢10.")], ["Atlas"])).toEqual([]);
  });

  test("a line must come with the kind the engine gives it", () => {
    const message = "Offre envoyée à Atlas : 10 × Farine pour ₢100.";
    expect(tradeHistory([entry("event", message)], ["Atlas"])).toEqual([]);
    expect(tradeHistory([entry("decision", message)], ["Atlas"])).toHaveLength(1);
  });

  test("the longest company name wins when one name starts another", () => {
    const [found] = tradeHistory(
      [entry("system", "Reçu de Atlas : Nord : 10 × Farine.")],
      ["Atlas", "Atlas : Nord"],
    );
    expect(found?.partner).toBe("Atlas : Nord");
  });
});
