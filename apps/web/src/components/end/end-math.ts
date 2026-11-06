import { scoreRules } from "@etic/content";
import type { RankingEntry, TeamState, TeamView } from "@etic/engine";
import { credits, formatNumber, percent } from "@/lib/format";

/**
 * Pure helpers of the end of the game (#42, R18, R19, N21). Display only: the server
 * computes the ranking once, when the game ends, and stays the source of truth.
 */

/** Results as a team receives them: null until the organizer shows the breakdown (N21). */
export type TeamResults = NonNullable<TeamView["results"]>;
type ResultLine = TeamResults["ranking"][number];

/** Before the breakdown, a ranking line only carries the rank and the company name. */
export function hasBreakdown(line: ResultLine): line is RankingEntry {
  return "final" in line;
}

/** The full ranking with every score, best first; empty while the breakdown is hidden. */
export function finalRanking(results: TeamResults | null | undefined): RankingEntry[] {
  if (!results?.breakdownShown) return [];
  return results.ranking.filter(hasBreakdown).sort((a, b) => a.rank - b.rank);
}

/** Net cash as the final score counts it (R18): cash minus the remaining debt. */
export function netCashOf(team: {
  cash: TeamState["cash"];
  finance: Pick<TeamState["finance"], "debt">;
}): number {
  return Math.round(team.cash - team.finance.debt);
}

/** Reference of the economic score: the best net cash of the game, never below 0 (R18). */
export function bestNetCash(ranking: readonly Pick<RankingEntry, "netCash">[]): number {
  return Math.max(0, ...ranking.map((entry) => entry.netCash));
}

/** Impact score (R18): mean of the environmental and social indicators, to one decimal. */
export function impactScore(environmental: number, social: number): number {
  return Math.round(((environmental + social) / 2) * 10) / 10;
}

const oneDecimal = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** A score out of 100, to one decimal like the ranking: "79,3". */
export function scoreValue(value: number): string {
  return oneDecimal.format(value);
}

/** Weights of the final score, from the game data (R18): "70 %" and "30 %". */
export const scoreWeights = {
  economic: percent(scoreRules.economicWeight),
  impact: percent(scoreRules.impactWeight),
} as const;

/** French ordinal suffix of a place (« la 1re place », « la 2e place »). */
export function placeSuffix(rank: number): string {
  return rank === 1 ? "re" : "e";
}

/** "1re", "2e"… */
export function placeLabel(rank: number): string {
  return `${rank}${placeSuffix(rank)}`;
}

/** The line under the team's place on the end screen. */
export function resultTagline(rank: number, total: number): string {
  if (rank === 1) return "Victoire ! Votre entreprise remporte la partie.";
  if (rank <= 3 && rank < total) return "Sur le podium ! Bravo à toute l'équipe.";
  return "La partie est jouée : voyez ci-dessous ce qui a fait la différence.";
}

/** How the economic score was obtained (R18), with the team's own figures. */
export function economicExplanation(netCash: number, best: number, economic: number): string {
  if (best <= 0) {
    return "Aucune entreprise ne finit avec une trésorerie nette positive : 0 pour toutes.";
  }
  if (netCash <= 0) return "Trésorerie nette nulle ou négative : 0 sur 100.";
  if (netCash >= best) return "C'est la meilleure trésorerie nette de la partie : 100 sur 100.";
  return `100 × ${credits(netCash)} ÷ ${credits(best)} = ${scoreValue(economic)}`;
}

/** How the impact score was obtained (R18): "(62,3 + 58,1) ÷ 2 = 60,2". */
export function impactExplanation(
  entry: Pick<RankingEntry, "environmental" | "social" | "impact">,
): string {
  return `(${scoreValue(entry.environmental)} + ${scoreValue(entry.social)}) ÷ 2 = ${scoreValue(entry.impact)}`;
}

/** The final score with the team's figures: "70 % × 87,5 + 30 % × 60,2 = 79,3". */
export function finalFormula(entry: Pick<RankingEntry, "economic" | "impact" | "final">): string {
  return `${scoreWeights.economic} × ${scoreValue(entry.economic)} + ${scoreWeights.impact} × ${scoreValue(entry.impact)} = ${scoreValue(entry.final)}`;
}

/** "0 unité", "1 unité", "1 240 unités". */
export function unitsLabel(count: number): string {
  return `${formatNumber(count)} ${count > 1 ? "unités" : "unité"}`;
}
