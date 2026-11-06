import {
  itemName,
  marketingRules,
  type ProductId,
  productIds,
  type RegionId,
  regionIds,
} from "@etic/content";
import {
  type Campaign,
  campaignCost,
  describeTarget,
  type GameStatus,
  type SimTime,
  type TeamState,
} from "@etic/engine";
import { credits, formatNumber, percent, regionName } from "@/lib/format";

/**
 * Pure helpers of the Marketing module (#35, R10, N14): campaign targets, what the active
 * campaigns already cover, the cost preview and the reasons to block or warn before a launch.
 * Display only: the server stays the source of truth.
 */

/** Value of the "all regions" and "whole range" choices in form controls. */
export const ALL = "all";

/** A campaign target: a null region or product means every region or the whole range. */
export interface CampaignTarget {
  region: RegionId | null;
  productId: ProductId | null;
}

/** One product in one region: what a campaign boosts, and what a price puts on sale (R7). */
export interface Pair {
  region: RegionId;
  productId: ProductId;
}

export function isRegionId(value: string): value is RegionId {
  return (regionIds as readonly string[]).includes(value);
}

export function isProductId(value: string): value is ProductId {
  return (productIds as readonly string[]).includes(value);
}

/** Reads a region choice: "all" = every region; undefined when unknown. */
export function parseRegionChoice(value: string): RegionId | null | undefined {
  if (value === ALL) return null;
  return isRegionId(value) ? value : undefined;
}

/** Reads a product choice: "all" = the whole range; undefined when unknown. */
export function parseProductChoice(value: string): ProductId | null | undefined {
  if (value === ALL) return null;
  return isProductId(value) ? value : undefined;
}

/** Campaign lengths allowed by the engine (7, 14 or 30 days). */
export function isDuration(days: number): boolean {
  return (marketingRules.durations as readonly number[]).includes(days);
}

// ——— Targets and coverage ———

export function sameTarget(a: CampaignTarget, b: CampaignTarget): boolean {
  return a.region === b.region && a.productId === b.productId;
}

/** Whether a target reaches a product in a region (same rule as the engine's boost). */
export function reaches(target: CampaignTarget, pair: Pair): boolean {
  return (
    (target.region === null || target.region === pair.region) &&
    (target.productId === null || target.productId === pair.productId)
  );
}

/** Whether two targets share at least one product in one region. */
export function overlaps(a: CampaignTarget, b: CampaignTarget): boolean {
  return (
    (a.region === null || b.region === null || a.region === b.region) &&
    (a.productId === null || b.productId === null || a.productId === b.productId)
  );
}

/** Every product × region pair of a target (32 at most). */
export function targetPairs(target: CampaignTarget): Pair[] {
  const regions = target.region === null ? regionIds : [target.region];
  const products = target.productId === null ? productIds : [target.productId];
  return regions.flatMap((region) => products.map((productId) => ({ region, productId })));
}

/** Products on sale, region by region (R7: no price, no sale), in display order. */
export function offersOf(prices: TeamState["prices"]): Pair[] {
  const offers: Pair[] = [];
  for (const region of regionIds) {
    for (const productId of productIds) {
      if (prices[region]?.[productId] !== undefined) offers.push({ region, productId });
    }
  }
  return offers;
}

/** Campaigns still in effect on `today`, the soonest to end first. */
export function activeCampaigns(campaigns: Record<string, Campaign>, today: number): Campaign[] {
  return Object.values(campaigns)
    .filter((campaign) => campaign.endDay >= today)
    .sort(
      (a, b) =>
        a.endDay - b.endDay ||
        a.startDay - b.startDay ||
        a.id.localeCompare(b.id, undefined, { numeric: true }),
    );
}

/** The active campaign aimed at exactly this target, if any: the engine refuses a second one. */
export function campaignOn(
  campaigns: readonly Campaign[],
  target: CampaignTarget,
): Campaign | undefined {
  return campaigns.find((campaign) => sameTarget(campaign, target));
}

/**
 * Last day until which every pair of the target is already boosted by these campaigns, or
 * null when at least one pair is not. Active campaigns have all started, so each pair stays
 * covered without a gap until the latest end among the campaigns reaching it.
 */
export function coveredUntil(
  target: CampaignTarget,
  campaigns: readonly Campaign[],
): number | null {
  let until: number | null = null;
  for (const pair of targetPairs(target)) {
    let pairUntil: number | null = null;
    for (const campaign of campaigns) {
      if (reaches(campaign, pair) && (pairUntil === null || campaign.endDay > pairUntil)) {
        pairUntil = campaign.endDay;
      }
    }
    if (pairUntil === null) return null;
    if (until === null || pairUntil < until) until = pairUntil;
  }
  return until;
}

// ——— Time ———

/** Last day of effect of a campaign launched today: the launch day counts as the first one. */
export function endDayOf(today: number, days: number): number {
  return today + days - 1;
}

/** Days of effect left, today included; 0 once over. */
export function daysLeft(endDay: number, today: number): number {
  return Math.max(0, endDay - today + 1);
}

export function daysLeftLabel(endDay: number, today: number): string {
  const left = daysLeft(endDay, today);
  if (left === 0) return "Terminée";
  if (left === 1) return "Dernier jour";
  return `${left} jours restants`;
}

/**
 * Simulated days until the campaign's last day is over, for the real-time estimate: the
 * step in progress has already started (engine step semantics).
 */
export function daysUntilEnd(endDay: number, time: SimTime, stepsPerDay: number): number {
  return Math.max(0, endDay + 1 - time.day - time.step / stepsPerDay);
}

/** Share of the campaign already elapsed, from 0 to 1. */
export function campaignProgress(
  campaign: Pick<Campaign, "startDay" | "endDay">,
  time: SimTime,
  stepsPerDay: number,
): number {
  const total = campaign.endDay - campaign.startDay + 1;
  if (total <= 0) return 1;
  const left = daysUntilEnd(campaign.endDay, time, stepsPerDay);
  return Math.min(1, Math.max(0, 1 - left / total));
}

// ——— Plan of a new campaign ———

export interface CampaignPlan {
  target: CampaignTarget;
  days: number;
  /** Paid at launch (N14). */
  cost: number;
  endDay: number;
  /** Active campaign on exactly this target: launching is refused (R10). */
  duplicate: Campaign | null;
  /** Other active campaigns sharing part of the target: effects do not stack there (N14). */
  overlapping: Campaign[];
  /** Day until which the whole target is already boosted by them; null when part is free. */
  coveredUntil: number | null;
  /** Products on sale in the target: the only offers the campaign helps. */
  offers: Pair[];
  /** Available cash missing to pay the campaign; 0 when affordable. */
  shortfall: number;
}

export function planCampaign({
  target,
  days,
  today,
  campaigns,
  prices,
  available,
}: {
  target: CampaignTarget;
  days: number;
  today: number;
  /** Active campaigns (see activeCampaigns). */
  campaigns: readonly Campaign[];
  prices: TeamState["prices"];
  /** Available cash: cash minus the amounts locked by auction bids. */
  available: number;
}): CampaignPlan {
  const cost = campaignCost(target.region, target.productId, days);
  const others = campaigns.filter((campaign) => !sameTarget(campaign, target));
  return {
    target,
    days,
    cost,
    endDay: endDayOf(today, days),
    duplicate: campaignOn(campaigns, target) ?? null,
    overlapping: others.filter((campaign) => overlaps(campaign, target)),
    coveredUntil: coveredUntil(target, others),
    offers: offersOf(prices).filter((pair) => reaches(target, pair)),
    shortfall: Math.max(0, cost - available),
  };
}

export type CampaignMessage = { tone: "error" | "warning" | "info"; text: string };

/** What blocks a launch (errors), then what deserves attention before paying. */
export function campaignMessages(plan: CampaignPlan, reservedCash: number): CampaignMessage[] {
  const messages: CampaignMessage[] = [];
  if (plan.duplicate) {
    const end = plan.duplicate.endDay;
    messages.push({
      tone: "error",
      text: `Une campagne vise déjà exactement cette cible, jusqu'au jour ${end} : une seule à la fois par cible. Vous pourrez la relancer dès le jour ${end + 1}.`,
    });
  }
  if (plan.shortfall > 0) {
    const locked = reservedCash > 0 ? ` (${credits(reservedCash)} bloqués par vos enchères)` : "";
    messages.push({
      tone: "error",
      text: `Trésorerie disponible insuffisante : il manque ${credits(plan.shortfall)}${locked}.`,
    });
  }
  if (plan.duplicate) return messages;

  if (plan.coveredUntil !== null && plan.coveredUntil >= plan.endDay) {
    messages.push({
      tone: "warning",
      text: `Toute cette cible est déjà soutenue jusqu'au jour ${plan.coveredUntil} par vos autres campagnes : celle-ci n'apporterait rien, les effets ne se cumulent pas.`,
    });
  } else if (plan.coveredUntil !== null) {
    messages.push({
      tone: "warning",
      text: `Toute cette cible est déjà soutenue jusqu'au jour ${plan.coveredUntil} par vos autres campagnes : les effets ne se cumulent pas, celle-ci n'agira qu'à partir du jour ${plan.coveredUntil + 1}.`,
    });
  } else if (plan.overlapping.length > 0) {
    const others = plan.overlapping.map(
      (campaign) =>
        `« ${describeTarget(campaign.region, campaign.productId)} » (jusqu'au jour ${campaign.endDay})`,
    );
    messages.push({
      tone: "info",
      text: `Cible déjà soutenue en partie par ${listLabel(others)} : là où les campagnes se recouvrent, l'effet ne se cumule pas.`,
    });
  }
  if (plan.offers.length === 0) {
    messages.push({
      tone: "warning",
      text: `${nothingOnSale(plan.target)} Sans prix fixé (page Ventes), la campagne n'attirera aucun client.`,
    });
  }
  return messages;
}

function nothingOnSale({ region, productId }: CampaignTarget): string {
  if (region && productId) {
    return `Vous ne vendez pas « ${itemName(productId)} » à ${regionName(region)}.`;
  }
  if (region) return `Vous ne vendez rien à ${regionName(region)}.`;
  if (productId) return `Vous ne vendez « ${itemName(productId)} » dans aucune région.`;
  return "Vous ne vendez encore rien.";
}

/** Why decisions are closed (O1), or null while the game runs. */
export function blockedReason(status: GameStatus): string | null {
  if (status === "paused") return "Jeu en pause : vous pourrez lancer une campagne à la reprise.";
  if (status === "ended") return "Partie terminée : plus aucune campagne possible.";
  if (status === "lobby") return "La partie n'a pas encore commencé.";
  return null;
}

// ——— Labels ———

/** "+20 %": attractiveness gained on the target (N14). */
export function boostLabel(): string {
  return `+${percent(marketingRules.attractivenessBoost - 1)}`;
}

const factorFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/** "2,5": cost multiplier of the whole range against one product (N14). */
export function rangeFactorLabel(): string {
  return factorFormat.format(marketingRules.wholeRangeFactor);
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Toute la gamme, Azura": the engine's wording, as the activity log writes it. */
export function targetLabel(target: CampaignTarget): string {
  return capitalize(describeTarget(target.region, target.productId));
}

/** "1 offre", "3 offres" (French: 0 and 1 are singular). */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${formatNumber(count)} ${count > 1 ? many : one}`;
}

/** What a target reaches among the products on sale, from their count in the target. */
export function onSaleLabel({ region, productId }: CampaignTarget, count: number): string {
  if (region && productId) return count > 0 ? "En vente" : "Pas en vente";
  if (region) return count > 0 ? `${plural(count, "produit")} en vente` : "Rien en vente";
  if (productId)
    return count > 0 ? `En vente dans ${plural(count, "région")}` : "En vente nulle part";
  return count > 0 ? `${plural(count, "offre")} en vente` : "Rien en vente";
}

/** "a", "a et b", "a, b et c". */
export function listLabel(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

function shortList(items: readonly string[], max: number): string {
  if (items.length <= max) return listLabel(items);
  return listLabel([...items.slice(0, max), `${items.length - max} autres`]);
}

/** "Pain et Savon à Azura", "Pain à Azura et Ferronia", "Pain à Azura, Savon à Ferronia…". */
export function offersLabel(pairs: readonly Pair[], max = 3): string {
  const [first] = pairs;
  if (!first) return "";
  if (pairs.every((pair) => pair.region === first.region)) {
    const names = pairs.map((pair) => itemName(pair.productId));
    return `${shortList(names, max)} à ${regionName(first.region)}`;
  }
  if (pairs.every((pair) => pair.productId === first.productId)) {
    const names = pairs.map((pair) => regionName(pair.region));
    return `${itemName(first.productId)} à ${shortList(names, max)}`;
  }
  const names = pairs.map((pair) => `${itemName(pair.productId)} à ${regionName(pair.region)}`);
  return shortList(names, max);
}
