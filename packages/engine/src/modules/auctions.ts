import { type ScenarioAuction, scenarioAuctions } from "@etic/content";
import { z } from "zod";
import { defineCommand } from "../commands.ts";
import { refuse } from "../errors.ts";
import { allocateId, announce, logTeam } from "../log.ts";
import type { GameSystem } from "../systems.ts";
import type { AuctionState, GameState, TeamState } from "../types.ts";
import { publishNews } from "./scenario.ts";
import { actingTeam, availableCash, credits, newMachine, recordCash } from "./shared.ts";

const auctionById = new Map(scenarioAuctions.map((auction) => [auction.id, auction]));

function companyName(team: TeamState): string {
  return team.companyName ?? team.name;
}

/** What one team may know about the auctions: its own bid only (sealed bids, R12). */
export function auctionsView(state: GameState, teamId: string) {
  return Object.values(state.auctions).map((auction) => {
    const content = auctionById.get(auction.id);
    const winner = auction.winnerTeamId ? state.teams[auction.winnerTeamId] : undefined;
    return {
      id: auction.id,
      title: content?.title ?? auction.id,
      description: content?.description ?? "",
      startingPrice: content?.startingPrice ?? 0,
      status: auction.status,
      closesDay: auction.closesDay,
      myBid: auction.bids[teamId]?.amount ?? null,
      winner: winner ? companyName(winner) : null,
      wonByMe: auction.winnerTeamId === teamId,
    };
  });
}

function grantReward(state: GameState, team: TeamState, auction: ScenarioAuction): void {
  const reward = auction.reward;
  switch (reward.kind) {
    case "outputBoost":
      team.perks.outputFactor *= reward.factor;
      return;
    case "shippingDiscount":
      team.perks.shippingFactor *= reward.factor;
      return;
    case "machine": {
      const id = `m-${allocateId(state)}`;
      team.machines[id] = newMachine(id, reward.machineTypeId);
      return;
    }
  }
}

function openAuction(state: GameState, auction: ScenarioAuction): void {
  state.auctions[auction.id] = {
    id: auction.id,
    status: "open",
    opensDay: state.time.day,
    closesDay: state.time.day + auction.durationDays - 1,
    bids: {},
    winnerTeamId: null,
  };
  publishNews(
    state,
    {
      source: "serious",
      region: null,
      title: `Enchère ouverte : ${auction.title}`,
      body: `${auction.description} Offres scellées à partir de ${credits(auction.startingPrice)}, jusqu'au jour ${state.time.day + auction.durationDays - 1}.`,
    },
    { kind: "scenario", ref: `${auction.id}:open` },
  );
  announce(state, `Enchère ouverte : ${auction.title}.`);
}

function closeAuction(state: GameState, auction: AuctionState): void {
  const content = auctionById.get(auction.id);
  auction.status = "closed";
  const ranked = Object.entries(auction.bids).sort(
    ([, a], [, b]) => b.amount - a.amount || a.order - b.order,
  );
  // Every reservation is released; the winner then pays its bid.
  for (const [teamId, bid] of ranked) {
    const team = state.teams[teamId];
    if (team) team.reservedCash -= bid.amount;
  }
  const [first] = ranked;
  const title = content?.title ?? auction.id;
  if (!first || !content) {
    publishNews(
      state,
      {
        source: "serious",
        region: null,
        title: `Enchère sans preneur : ${title}`,
        body: "Aucune offre n'a été déposée : le lot est retiré.",
      },
      { kind: "scenario", ref: `${auction.id}:close` },
    );
    return;
  }
  const [winnerId, bid] = first;
  const winner = state.teams[winnerId];
  if (!winner) return;
  auction.winnerTeamId = winnerId;
  recordCash(state, winner, -bid.amount, "auction", `Enchère remportée : ${title}`);
  grantReward(state, winner, content);
  logTeam(state, winnerId, {
    kind: "event",
    message: `Vous remportez l'enchère « ${title} » pour ${credits(bid.amount)}.`,
  });
  for (const [teamId] of ranked.slice(1)) {
    logTeam(state, teamId, {
      kind: "event",
      message: `Enchère « ${title} » perdue : votre offre vous est rendue.`,
    });
  }
  // The winner is public, the amount never is (R12).
  publishNews(
    state,
    {
      source: "serious",
      region: null,
      title: `${companyName(winner)} remporte l'enchère`,
      body: `Le lot « ${title} » revient à ${companyName(winner)}. Le montant de l'offre n'a pas été communiqué.`,
    },
    { kind: "scenario", ref: `${auction.id}:close` },
  );
  announce(state, `${companyName(winner)} remporte l'enchère « ${title} ».`);
}

/** Releases every reservation without a winner (end of game during an auction, R19). */
export function cancelOpenAuctions(state: GameState): void {
  for (const auction of Object.values(state.auctions)) {
    if (auction.status !== "open") continue;
    auction.status = "closed";
    for (const [teamId, bid] of Object.entries(auction.bids)) {
      const team = state.teams[teamId];
      if (team) team.reservedCash -= bid.amount;
    }
  }
}

export const auctionCommands = [
  defineCommand({
    type: "auction.bid",
    actor: "team",
    schema: z.object({
      auctionId: z.string().min(1),
      amount: z.int("Le montant doit être un nombre entier.").positive(),
    }),
    apply: (draft, { auctionId, amount }, actor) => {
      const team = actingTeam(draft, actor);
      const auction = draft.auctions[auctionId];
      const content = auctionById.get(auctionId);
      if (!auction || !content) refuse("NOT_FOUND", "Enchère introuvable.");
      if (auction.status !== "open") refuse("INVALID_STATE", "Cette enchère est close.");
      if (amount < content.startingPrice) {
        refuse("BID_TOO_LOW", `L'offre minimale est de ${credits(content.startingPrice)}.`);
      }
      const previous = auction.bids[team.id]?.amount ?? 0;
      if (amount <= previous) {
        refuse(
          "BID_TOO_LOW",
          `Votre offre ne peut qu'augmenter : elle est de ${credits(previous)}.`,
        );
      }
      const extra = amount - previous;
      if (extra > availableCash(team)) {
        refuse(
          "INSUFFICIENT_FUNDS",
          `Trésorerie disponible insuffisante pour bloquer ${credits(extra)}.`,
        );
      }
      team.reservedCash += extra;
      auction.bids[team.id] = { amount, order: allocateId(draft) };
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `Offre de ${credits(amount)} sur « ${content.title} » (montant bloqué jusqu'à la clôture).`,
      });
    },
  }),
];

export const auctionSystem: GameSystem = {
  name: "auctions",
  onDay: (draft) => {
    for (const auction of Object.values(draft.auctions)) {
      if (auction.status === "open" && draft.time.day > auction.closesDay)
        closeAuction(draft, auction);
    }
  },
  onStep: (draft) => {
    for (const auction of scenarioAuctions) {
      if (auction.openDay <= draft.time.day && !draft.auctions[auction.id])
        openAuction(draft, auction);
    }
  },
  onEnd: (draft) => cancelOpenAuctions(draft),
};
