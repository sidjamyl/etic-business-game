import { machineTypeById, scenarioAuctions } from "@etic/content";
import type { ClockView, GameStatus, SimTime, TeamView } from "@etic/engine";
import { credits } from "@/lib/format";

/** One auction as the team sees it: its own sealed bid only, never the others' (R12). */
export type AuctionView = TeamView["auctions"][number];

const auctionById = new Map(scenarioAuctions.map((auction) => [auction.id, auction]));

/** French plural: "1 offre en cours", "2 offres en cours". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count > 1 ? many : one}`;
}

/** Open auctions closing first, then closed ones, the most recent first. */
export function splitAuctions(auctions: readonly AuctionView[]): {
  open: AuctionView[];
  closed: AuctionView[];
} {
  const byTitle = (a: AuctionView, b: AuctionView) => a.title.localeCompare(b.title, "fr");
  return {
    open: auctions
      .filter((auction) => auction.status === "open")
      .sort((a, b) => a.closesDay - b.closesDay || byTitle(a, b)),
    closed: auctions
      .filter((auction) => auction.status === "closed")
      .sort((a, b) => b.closesDay - a.closesDay || byTitle(a, b)),
  };
}

export interface AuctionTotals {
  /** Open auctions where the team has a bid, i.e. cash locked until their close. */
  openBids: number;
  closed: number;
  won: AuctionView[];
}

export function auctionTotals(auctions: readonly AuctionView[]): AuctionTotals {
  return {
    openBids: auctions.filter((auction) => auction.status === "open" && auction.myBid !== null)
      .length,
    closed: auctions.filter((auction) => auction.status === "closed").length,
    won: auctions.filter((auction) => auction.wonByMe),
  };
}

type BidTarget = Pick<AuctionView, "startingPrice" | "myBid">;

/** Smallest acceptable bid: the starting price, then strictly above the team's own bid. */
export function minimumBid({ startingPrice, myBid }: BidTarget): number {
  return myBid === null ? startingPrice : Math.max(startingPrice, myBid + 1);
}

/** Whether the available cash covers the smallest bid still possible (its locked part). */
export function canAffordMinimum(target: BidTarget, available: number): boolean {
  return available >= minimumBid(target) - (target.myBid ?? 0);
}

export interface BidCheck {
  /** The amount typed, once it reads as a whole number (null while empty or unreadable). */
  amount: number | null;
  /** Cash newly locked by this bid: only the difference with the current bid (N16). */
  extra: number;
  /** Why the bid would be refused; null when it can be sent or nothing is typed yet. */
  error: string | null;
}

/**
 * Reads and checks a bid like the engine does (`auction.bid`): whole crédits, at least the
 * starting price, above the current bid, and the difference covered by the available cash.
 * Spaces and the ₢ sign are ignored, so "₢7 000" reads as 7000.
 */
export function checkBid(raw: string, target: BidTarget, available: number): BidCheck {
  const text = raw.replace(/[\s₢]/g, "");
  if (text === "") return { amount: null, extra: 0, error: null };
  if (!/^\d+$/.test(text)) {
    return { amount: null, extra: 0, error: "Saisissez un nombre entier de crédits." };
  }
  const amount = Number(text);
  if (!Number.isSafeInteger(amount))
    return { amount: null, extra: 0, error: "Montant trop élevé." };
  const extra = Math.max(0, amount - (target.myBid ?? 0));
  if (amount < target.startingPrice) {
    return { amount, extra, error: `L'offre minimale est de ${credits(target.startingPrice)}.` };
  }
  if (target.myBid !== null && amount <= target.myBid) {
    return {
      amount,
      extra,
      error: `Votre offre ne peut qu'augmenter : elle est de ${credits(target.myBid)}.`,
    };
  }
  if (extra > available) {
    return {
      amount,
      extra,
      error: `Trésorerie disponible insuffisante : il manque ${credits(extra - available)}.`,
    };
  }
  return { amount, extra, error: null };
}

/**
 * Sub-steps left before the close. Bids are accepted until the end of `closesDay`; the
 * auction closes when the next day starts (engine `auctionSystem.onDay`).
 */
export function stepsUntilClose(closesDay: number, time: SimTime, stepsPerDay: number): number {
  return Math.max(0, (closesDay - time.day + 1) * stepsPerDay - time.step);
}

/** Share of the bidding window already elapsed, from 0 to 1 (null for an unknown auction). */
export function windowElapsed(
  auctionId: string,
  closesDay: number,
  time: SimTime,
  stepsPerDay: number,
): number | null {
  const duration = auctionById.get(auctionId)?.durationDays;
  if (!duration) return null;
  const left = stepsUntilClose(closesDay, time, stepsPerDay);
  return Math.min(1, Math.max(0, 1 - left / (duration * stepsPerDay)));
}

/**
 * True when the scheduled end comes first: the game then ends before the auction closes,
 * without a winner, and every bid is returned (R19).
 */
export function endsBeforeClose(closesDay: number, endDay: number | null): boolean {
  return endDay !== null && endDay <= closesDay;
}

/**
 * What a closed auction meant for the team. "cancelled": the game ended before the close
 * (bids returned); "unsold": nobody bid, the lot was withdrawn.
 */
export type AuctionOutcome = "won" | "lost" | "cancelled" | "unsold" | "no-bid";

export function auctionOutcome(
  auction: AuctionView,
  clock: Pick<ClockView, "status" | "time">,
): AuctionOutcome {
  if (auction.wonByMe) return "won";
  if (auction.winner !== null) return auction.myBid === null ? "no-bid" : "lost";
  // A normal close with a bid always has a winner; an auction still running at the end of
  // the game was closed on the last day (closesDay ≥ that day) without one.
  const endedFirst = clock.status === "ended" && auction.closesDay >= clock.time.day;
  return auction.myBid !== null || endedFirst ? "cancelled" : "unsold";
}

/** Why bids are blocked (pause, end of game, O1), or null while the game runs. */
export function bidBlockedReason(status: GameStatus): string | null {
  if (status === "paused") return "Jeu en pause : vous pourrez enchérir à la reprise.";
  if (status === "ended") return "Partie terminée : plus aucune offre possible.";
  if (status === "lobby") return "La partie n'a pas encore commencé.";
  return null;
}

export interface RewardFollowUp {
  text: string;
  to: "/play/production" | "/play/livraisons";
  label: string;
}

/** Where a won lot takes effect, so the winner can make use of it (story 80). */
export function rewardFollowUp(auctionId: string): RewardFollowUp | null {
  const reward = auctionById.get(auctionId)?.reward;
  if (!reward) return null;
  switch (reward.kind) {
    case "outputBoost":
      return {
        text: "Bonus actif sur toutes vos machines.",
        to: "/play/production",
        label: "Voir la production",
      };
    case "shippingDiscount":
      return {
        text: "Réduction appliquée à tous vos transports.",
        to: "/play/livraisons",
        label: "Voir les livraisons",
      };
    case "machine": {
      const crew = machineTypeById.get(reward.machineTypeId)?.operatorsRequired;
      return {
        text: crew
          ? `Machine livrée dans votre parc : affectez-lui ${plural(crew, "opérateur")}.`
          : "Machine livrée dans votre parc.",
        to: "/play/production",
        label: "Voir la production",
      };
    }
  }
}
