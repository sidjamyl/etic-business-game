import {
  type Branch,
  type CardId,
  cardById,
  deliveryRules,
  type ItemId,
  itemName,
  machineTypeById,
  progressionRules,
  type ScenarioAuction,
  scenarioAuctions,
  type TransportOption,
  timingRules,
} from "@etic/content";
import type { RankingEntry, ResultsState, TradeGood } from "@etic/engine";
import type { AdminStreamView } from "@/lib/admin";
import { formatNumber, timeLeft } from "@/lib/format";

/** Pieces of the organizer's live view (admin.stream, N22). */
export type AdminCompany = AdminStreamView["companies"][string];
export type AdminCompanies = AdminStreamView["companies"];
export type AdminAuction = AdminStreamView["auctions"][number];
export type AdminTrades = AdminStreamView["trades"];
export type AdminTradeOffer = AdminTrades["offers"][number];
export type AdminTradeShipment = AdminTrades["shipments"][number];
export type AdminCardNews = AdminStreamView["cardNews"][number];
export type AdminEvents = AdminStreamView["events"];
export type ServerMetrics = AdminStreamView["metrics"];

// ---------------------------------------------------------------------------------------------
// Wording

/** French plural, 0 and 1 being singular: "0 trace", "1 trace", "3 traces". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${formatNumber(count)} ${count > 1 ? many : one}`;
}

/** "1re place", "2e place" (French ordinals of a ranking). */
export function placeLabel(rank: number): string {
  return rank === 1 ? "1re place" : `${rank}e place`;
}

const scoreFormat = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Scores out of 100, rounded to a tenth by the engine: "72,4". */
export function formatScore(value: number): string {
  return scoreFormat.format(value);
}

const indicatorFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** Indicators out of 100 (reputation, impact), without a useless decimal: "65,3", "50". */
export function formatIndicator(value: number): string {
  return indicatorFormat.format(value);
}

// ---------------------------------------------------------------------------------------------
// Companies

/** The name the room knows a company by: its chosen name, else the team name. */
export function companyLabel(team: { name: string; companyName: string | null }): string {
  return team.companyName ?? team.name;
}

/** Companies in their creation order (t1, t2 … t12), whatever the object key order. */
export function sortCompanies<T extends { id: string }>(companies: readonly T[]): T[] {
  return [...companies].sort((a, b) => a.id.localeCompare(b.id, "fr", { numeric: true }));
}

/** Name of the company behind a team id (auction bids, trades, fake news). */
export function companyNameOf(
  companies: Readonly<Record<string, { name: string; companyName: string | null }>>,
  teamId: string | null,
): string {
  if (!teamId) return "—";
  const company = companies[teamId];
  return company ? companyLabel(company) : "Entreprise inconnue";
}

/** "1", "2", "3 · Tech": tier reached and, at tier 3, the branch chosen for good (R1, R2). */
export function tierLabel(tier: number, branch: Branch | null): string {
  return branch ? `${tier} · ${progressionRules.branches[branch]}` : String(tier);
}

/** The secret card dealt at the start (R14), by name, and whether it was played. */
export function cardInfo(
  card: { id: CardId; used: boolean } | null,
): { name: string; used: boolean } | null {
  if (!card) return null;
  return { name: cardById.get(card.id)?.name ?? card.id, used: card.used };
}

/** Machines at work out of the fleet, and their average efficiency (null without machines). */
export function machineSummary(machines: readonly { status: string; efficiency: number }[]): {
  running: number;
  total: number;
  averageEfficiency: number | null;
} {
  const running = machines.filter((machine) => machine.status === "running").length;
  const averageEfficiency =
    machines.length === 0
      ? null
      : machines.reduce((sum, machine) => sum + machine.efficiency, 0) / machines.length;
  return { running, total: machines.length, averageEfficiency };
}

export interface InventoryLine {
  id: ItemId;
  label: string;
  quantity: number;
}

/** Warehouse content, largest stocks first, and the total number of units. */
export function inventorySummary(inventory: Partial<Record<ItemId, number>>): {
  total: number;
  lines: InventoryLine[];
} {
  const lines: InventoryLine[] = [];
  for (const [id, quantity] of Object.entries(inventory) as [ItemId, number | undefined][]) {
    if (quantity && quantity > 0) lines.push({ id, label: itemName(id), quantity });
  }
  lines.sort((a, b) => b.quantity - a.quantity || a.label.localeCompare(b.label, "fr"));
  return { total: lines.reduce((sum, line) => sum + line.quantity, 0), lines };
}

/** True once a company has touched the black market (R13): traces, deals or convictions. */
export function hasBlackMarketActivity(activity: AdminCompany["blackMarket"]): boolean {
  return (
    activity.recentTraces > 0 ||
    activity.purchasedUnits > 0 ||
    activity.soldUnits > 0 ||
    activity.convictions > 0
  );
}

export type Tone = "success" | "warning" | "danger";

/** Tone of a 0–100 indicator, with the same thresholds as the players' screens. */
export function ratingTone(value: number): Tone {
  if (value >= 65) return "success";
  if (value >= 40) return "warning";
  return "danger";
}

// ---------------------------------------------------------------------------------------------
// Clock and end of game (P8, P10, R19)

/** A rehearsal runs faster than one simulated day per real minute (P10). */
export function isRehearsal(msPerDay: number): boolean {
  return msPerDay < timingRules.msPerDay;
}

/** "1 jour = 1 min", "1 jour = 5 s", "1 jour = 2,5 s". */
export function speedLabel(msPerDay: number): string {
  if (msPerDay % 60_000 === 0) return `1 jour = ${msPerDay / 60_000} min`;
  const seconds = Math.round(msPerDay / 100) / 10;
  return `1 jour = ${String(seconds).replace(".", ",")} s`;
}

/** Real milliseconds between two sub-steps of the simulation (N5). */
export function stepIntervalMs(msPerDay: number, stepsPerDay: number): number {
  return stepsPerDay > 0 ? msPerDay / stepsPerDay : msPerDay;
}

/** When a scheduled day comes: "aujourd'hui", "dans 12 j · ≈ 12 min". */
export function inDaysLabel(day: number, today: number, msPerDay: number): string {
  const days = day - today;
  if (days <= 0) return "aujourd'hui";
  return `dans ${days} j · ${timeLeft(days, msPerDay)}`;
}

/** Period of an event in progress: "Jours 25 à 39 · encore 5 j", "Depuis le jour 60 · durable". */
export function activeEventLabel(
  event: { startDay: number; endDay: number | null },
  today: number,
): string {
  if (event.endDay === null) return `Depuis le jour ${event.startDay} · effet durable`;
  const left = Math.max(1, event.endDay - today + 1);
  return `Jours ${event.startDay} à ${event.endDay} · encore ${left} j`;
}

export type EndTimeResult = { ok: true; endsAt: Date } | { ok: false; message: string };

/** The end of the game today at "HH:MM" (as typed in a time field); it must still be ahead. */
export function endTimeToday(time: string, now: Date): EndTimeResult {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(time.trim());
  if (!match) return { ok: false, message: "Indiquez une heure, par exemple 18:00." };
  const endsAt = new Date(now);
  endsAt.setHours(Number(match[1]), Number(match[2]), 0, 0);
  if (endsAt.getTime() <= now.getTime()) {
    return { ok: false, message: "Cette heure est déjà passée : choisissez une heure à venir." };
  }
  return { ok: true, endsAt };
}

// ---------------------------------------------------------------------------------------------
// Auctions (R12, N16): the organizer sees every sealed bid.

export interface RankedBid {
  teamId: string;
  amount: number;
  order: number;
}

/** Bids from the highest; on a tie, the earliest wins (same order as the engine). */
export function rankedBids(
  bids: Readonly<Record<string, { amount: number; order: number }>>,
): RankedBid[] {
  return Object.entries(bids)
    .map(([teamId, bid]) => ({ teamId, amount: bid.amount, order: bid.order }))
    .sort((a, b) => b.amount - a.amount || a.order - b.order);
}

export type AuctionOutcome = "open" | "won" | "unsold" | "cancelled";

/** Open, won, closed without any bid, or cancelled by the end of the game (bids refunded). */
export function auctionOutcome(
  auction: Pick<AdminAuction, "status" | "winnerTeamId" | "bids">,
): AuctionOutcome {
  if (auction.status === "open") return "open";
  if (auction.winnerTeamId) return "won";
  return Object.keys(auction.bids).length === 0 ? "unsold" : "cancelled";
}

/** Open auctions closing first, then closed ones, the most recent first. */
export function sortAuctions<T extends Pick<AdminAuction, "status" | "opensDay" | "closesDay">>(
  auctions: readonly T[],
): T[] {
  return [...auctions].sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    return a.status === "open" ? a.closesDay - b.closesDay : b.opensDay - a.opensDay;
  });
}

const auctionContent = new Map(scenarioAuctions.map((auction) => [auction.id, auction]));

/** Starting price of a scenario auction, or null for an unknown id. */
export function startingPrice(auctionId: string): number | null {
  return auctionContent.get(auctionId)?.startingPrice ?? null;
}

/** Scenario auctions not opened yet, in the order they will open. */
export function upcomingAuctions(openedIds: Iterable<string>): ScenarioAuction[] {
  const opened = new Set(openedIds);
  return scenarioAuctions
    .filter((auction) => !opened.has(auction.id))
    .sort((a, b) => a.openDay - b.openDay);
}

// ---------------------------------------------------------------------------------------------
// Trades between companies (R15)

/** "120 × Farine", or the machine type for a machine. */
export function goodLabel(good: TradeGood): string {
  if (good.kind === "item") return `${formatNumber(good.quantity)} × ${itemName(good.item)}`;
  return machineTypeById.get(good.typeId)?.name ?? "Machine";
}

/** "Standard (route)", "Express (avion)", "Verte (rail ou électrique)". */
export function transportLabel(option: TransportOption): string {
  return deliveryRules.options[option].name;
}

// ---------------------------------------------------------------------------------------------
// Final reveal (N21): one team at a time, from the last to the first, then the breakdown.

export interface RevealProgress {
  total: number;
  revealed: number;
  /** The entry the next reveal shows, or null once the whole ranking is revealed. */
  next: RankingEntry | null;
  allRevealed: boolean;
  breakdownShown: boolean;
}

export function revealProgress(
  results: Pick<ResultsState, "ranking" | "revealedCount" | "breakdownShown">,
): RevealProgress {
  const total = results.ranking.length;
  const revealed = Math.min(results.revealedCount, total);
  return {
    total,
    revealed,
    next: revealed < total ? (results.ranking[total - revealed - 1] ?? null) : null,
    allRevealed: revealed >= total,
    breakdownShown: results.breakdownShown,
  };
}

/** Whether the room has already seen this rank (revealed from the last place up). */
export function isRevealed(rank: number, total: number, revealedCount: number): boolean {
  return rank > total - revealedCount;
}

// ---------------------------------------------------------------------------------------------
// Server health (S10)

export type Health = "good" | "slow" | "critical";

/**
 * A step blocks commands while it runs: it should take a few milliseconds and stay far below
 * the interval between steps (15 s in a real game, less in a rehearsal).
 */
export const STEP_LIMITS = {
  slowMs: 100,
  criticalMs: 1_000,
  slowShare: 0.2,
  criticalShare: 0.5,
} as const;

export function stepHealth(durationMs: number, stepMs: number): Health {
  const share = stepMs > 0 ? durationMs / stepMs : 1;
  if (durationMs >= STEP_LIMITS.criticalMs || share >= STEP_LIMITS.criticalShare) {
    return "critical";
  }
  if (durationMs >= STEP_LIMITS.slowMs || share >= STEP_LIMITS.slowShare) return "slow";
  return "good";
}

/**
 * The game is saved after every step. The view is computed just before that save, so the last
 * save normally trails the last step by one interval; several missed intervals mean saves fail
 * (the server keeps retrying). Steps without any save at all are late too.
 */
export function saveIsLate(
  metrics: Pick<ServerMetrics, "lastStepAt" | "lastSavedAt">,
  stepMs: number,
): boolean {
  if (!metrics.lastStepAt) return false;
  if (!metrics.lastSavedAt) return true;
  const lag = Date.parse(metrics.lastStepAt) - Date.parse(metrics.lastSavedAt);
  return lag > Math.max(3 * stepMs, 10_000);
}

/** Overall state for the organizer: the worst of the step duration and the saves. */
export function serverHealth(metrics: ServerMetrics, stepMs: number): Health {
  const step = metrics.lastStepAt ? stepHealth(metrics.lastStepDurationMs, stepMs) : "good";
  if (step === "critical") return "critical";
  return step === "slow" || saveIsLate(metrics, stepMs) ? "slow" : "good";
}

const timeFormat = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Wall-clock time of an ISO date ("14:32:05"), or null when absent or invalid. */
export function formatClockTime(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : timeFormat.format(date);
}

const millisecondsFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const secondsFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** "0,42 ms", "125 ms", "1,5 s". */
export function formatDurationMs(ms: number): string {
  if (ms >= 1_000) return `${secondsFormat.format(ms / 1_000)} s`;
  return `${millisecondsFormat.format(ms)} ms`;
}

// ---------------------------------------------------------------------------------------------
// Errors of organizer calls

export const OFFLINE_MESSAGE = "Le serveur ne répond pas. Vérifiez la connexion et réessayez.";
const GENERIC_MESSAGE = "Action impossible, réessayez.";

/** tRPC error code of a failed call (FORBIDDEN, NOT_FOUND…), when the server answered. */
function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("data" in error)) return undefined;
  const data: unknown = error.data;
  if (typeof data !== "object" || data === null || !("code" in data)) return undefined;
  return typeof data.code === "string" ? data.code : undefined;
}

/** French message for a failed call: the server's own message when it is meant for people. */
export function errorMessage(error: unknown): string {
  const code = errorCode(error);
  if (!code) return OFFLINE_MESSAGE;
  if (code === "BAD_REQUEST" || code === "INTERNAL_SERVER_ERROR") return GENERIC_MESSAGE;
  return error instanceof Error && error.message ? error.message : GENERIC_MESSAGE;
}
