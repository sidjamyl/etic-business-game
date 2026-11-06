import {
  deliveryRules,
  impactRules,
  type ProductId,
  products,
  scoreRules,
  type TransportOption,
  transportOptions,
} from "@etic/content";
import type { HrState, ImpactScores, TeamState } from "@etic/engine";
import { formatNumber } from "@/lib/format";

/**
 * Pure helpers for the Impact page (#41, R17, R18, N20). The server computes the indicators
 * (`view.impact`); these helpers only format them and add context from the team's own facts.
 */

/** Level of a 0–100 rating, on the thresholds of `ratingTone` (components/game/impact-badge). */
export type RatingLevel = "good" | "fair" | "poor";

export const GOOD_FROM = 65;
export const FAIR_FROM = 40;

export function ratingLevel(value: number): RatingLevel {
  if (value >= GOOD_FROM) return "good";
  if (value >= FAIR_FROM) return "fair";
  return "poor";
}

/** Shown next to the colour, never colour alone (DESIGN.md §3). */
export const levelLabels: Record<RatingLevel, string> = {
  good: "Bon",
  fair: "Moyen",
  poor: "Faible",
};

const round1 = (value: number) => Math.round(value * 10) / 10;

const oneDecimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** 62.5 → "62,5", 50 → "50": indicators keep one decimal, like the engine. */
export function formatScore(value: number): string {
  // Avoids "-0" for values rounded to zero.
  return oneDecimal.format(round1(value) || 0);
}

/** 12.5 → "+12,5", −8 → "−8", 0 → "0" (minus sign, as `signedCredits`). */
export function signedScore(value: number): string {
  const rounded = round1(value);
  if (rounded > 0) return `+${formatScore(rounded)}`;
  if (rounded < 0) return `−${formatScore(-rounded)}`;
  return "0";
}

/** Points above (+) or below (−) the level both indicators start from (R17: 50). */
export function fromStart(value: number): number {
  return round1(value - impactRules.neutral);
}

/** Impact score (R18): the average of both indicators, rounded like the final ranking. */
export function impactScore(environmental: number, social: number): number {
  return round1((environmental + social) / 2);
}

/** Points of the final score (out of 100) the impact can bring: 30 (R18). */
export const IMPACT_POINTS = Math.round(scoreRules.impactWeight * 100);

/** Points of the final score that depend on the net cash: 70 (R18). */
export const ECONOMIC_POINTS = Math.round(scoreRules.economicWeight * 100);

/** Points the impact brings to the final score at this level, out of `IMPACT_POINTS`. */
export function scoreContribution(impact: number): number {
  return round1(impact * scoreRules.impactWeight);
}

export type ImpactPenalties = ImpactScores["breakdown"]["social"]["penalties"];

/** Points taken off the social indicator by incidents (N20, N25). */
export function totalPenalties(penalties: ImpactPenalties): number {
  return penalties.strikes + penalties.layoffs + penalties.convictions + penalties.resignations;
}

/**
 * Social indicator before its penalties (N20): the average of the wage and supplier
 * sub-scores, or the starting level while neither exists. Read back from the indicator when
 * it is above its floor, so that "base − penalties = indicator" matches the server's rounding.
 */
export function socialBase(impact: Pick<ImpactScores, "social" | "breakdown">): number {
  const penalties = totalPenalties(impact.breakdown.social.penalties);
  if (impact.social > 0) return round1(impact.social + penalties);
  const { wages, suppliers } = impact.breakdown.social;
  const present = [wages, suppliers].filter((value): value is number => value !== null);
  if (present.length === 0) return impactRules.neutral;
  return round1(present.reduce((sum, value) => sum + value, 0) / present.length);
}

/** Sub-scores that already count in an indicator (a null one has no data yet). */
export function countedScores(scores: readonly (number | null)[]): number {
  return scores.filter((value) => value !== null).length;
}

/** Average wage paid since the start, as a share of the regional base wage; null before any employee-day. */
export function averageWageRatio(
  hr: Pick<HrState, "wageRatioSum" | "employeeDays">,
): number | null {
  return hr.employeeDays > 0 ? hr.wageRatioSum / hr.employeeDays : null;
}

export type Tier = 1 | 2 | 3;

/** Units produced since the start, per product tier (the footprint grows with the tier). */
export function producedByTier(produced: Partial<Record<ProductId, number>>): Record<Tier, number> {
  const byTier: Record<Tier, number> = { 1: 0, 2: 0, 3: 0 };
  for (const product of products) byTier[product.tier] += produced[product.id] ?? 0;
  return byTier;
}

export interface TransportMix {
  /** Units shipped since the start: customer deliveries and goods sent to other companies. */
  total: number;
  /** Customer deliveries per option. */
  byOption: Record<TransportOption, number>;
  /** Customer deliveries, all options together. */
  deliveries: number;
  /** Units sent to other companies (contracts and gifts): their options are not kept apart. */
  trades: number;
}

export function transportMix(team: Pick<TeamState, "impact" | "stats">): TransportMix {
  const byOption: Record<TransportOption, number> = { standard: 0, express: 0, green: 0 };
  let deliveries = 0;
  for (const option of transportOptions) {
    const units = team.stats.shippedUnits[option] ?? 0;
    byOption[option] = units;
    deliveries += units;
  }
  const total = team.impact.transport.units;
  return { total, byOption, deliveries, trades: Math.max(0, total - deliveries) };
}

/** Transport options from the cleanest to the most polluting (R8: green, standard, express). */
export const optionsByImpact: TransportOption[] = [...transportOptions].sort(
  (a, b) => deliveryRules.options[b].environmental - deliveryRules.options[a].environmental,
);

/** "Verte (rail ou électrique)" → "Verte". */
export function optionLabel(option: TransportOption): string {
  return deliveryRules.options[option].name.replace(/\s*\(.*\)\s*$/, "");
}

/** "(rail ou électrique)" → "rail ou électrique"; empty when the name has no detail. */
export function optionMode(option: TransportOption): string {
  return /\((.*)\)/.exec(deliveryRules.options[option].name)?.[1] ?? "";
}

/** "0 jour", "1 jour", "3 jours", "1 200 unités": French singular for 0 and 1. */
export function countLabel(count: number, one: string, many: string): string {
  return `${formatNumber(count)} ${count > 1 ? many : one}`;
}

/** Like `countLabel`, with its own wording for zero: "Aucun licenciement", "2 licenciements". */
export function countPhrase(count: number, none: string, one: string, many: string): string {
  return count === 0 ? none : countLabel(count, one, many);
}

/** "a", "a et b", "a, b et c". */
export function joinFrench(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} et ${parts.at(-1)}`;
}

/** French elision before a place name: "d'Azura", "de Ferronia". */
export function ofPlace(name: string): string {
  return /^[aeiouyàâäéèêëîïôöûü]/i.test(name) ? `d'${name}` : `de ${name}`;
}

/** "1 240 unités de matières achetées, dont 270 chez des fournisseurs mal notés et 50 au marché noir." */
export function purchasesSentence(units: number, lowRated: number, blackMarket: number): string {
  // Black-market units are rated 0 by the engine, so they are part of the low-rated ones.
  const legalLowRated = Math.max(0, lowRated - blackMarket);
  const parts = [
    legalLowRated > 0 ? `${formatNumber(legalLowRated)} chez des fournisseurs mal notés` : null,
    blackMarket > 0 ? `${formatNumber(blackMarket)} au marché noir` : null,
  ].filter((part): part is string => part !== null);
  const head = countLabel(units, "unité de matière achetée", "unités de matières achetées");
  return parts.length > 0 ? `${head}, dont ${joinFrench(parts)}.` : `${head}.`;
}

/** "860 unités produites : 600 au palier 1 et 260 au palier 2." */
export function productionSentence(byTier: Record<Tier, number>): string {
  const tiers = ([1, 2, 3] as const).filter((tier) => byTier[tier] > 0);
  const head = countLabel(byTier[1] + byTier[2] + byTier[3], "unité produite", "unités produites");
  if (tiers.length === 1) return `${head} au palier ${tiers[0]}.`;
  if (tiers.length === 0) return `${head}.`;
  return `${head} : ${joinFrench(tiers.map((tier) => `${formatNumber(byTier[tier])} au palier ${tier}`))}.`;
}

/** "1 000 unités expédiées, dont 120 vers d'autres entreprises." */
export function transportSentence(mix: TransportMix): string {
  if (mix.deliveries === 0 && mix.trades > 0) {
    return `${countLabel(mix.trades, "unité envoyée", "unités envoyées")} à d'autres entreprises.`;
  }
  const head = countLabel(mix.total, "unité expédiée", "unités expédiées");
  return mix.trades > 0
    ? `${head}, dont ${formatNumber(mix.trades)} vers d'autres entreprises.`
    : `${head}.`;
}

/** How the environmental sub-scores make the indicator: "Moyenne des 3 sous-notes calculées". */
export function averageLabel(counted: number): string {
  if (counted === 0) return "Aucune sous-note calculée : niveau de départ";
  if (counted === 1) return "Une seule sous-note calculée";
  return `Moyenne des ${counted} sous-notes calculées`;
}

/**
 * How the social indicator is made: "Moyenne des sous-notes 62,4 − pénalités 9". The floor
 * at 0 is spelled out when the penalties exceed the sub-scores.
 */
export function socialEquation(base: number, penalties: number, counted: number): string {
  if (counted === 0 && penalties === 0) return "Aucune sous-note ni pénalité : niveau de départ";
  const label =
    counted === 0 ? "Niveau de départ" : counted === 1 ? "Sous-note" : "Moyenne des sous-notes";
  const floored = base - penalties < 0 ? " (minimum 0)" : "";
  return `${label} ${formatScore(base)} − pénalités ${formatNumber(penalties)}${floored}`;
}
