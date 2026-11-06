import { scoreRules } from "@etic/content";
import { z } from "zod";
import { defineCommand } from "../commands.ts";
import { refuse } from "../errors.ts";
import { announce } from "../log.ts";
import type { GameSystem } from "../systems.ts";
import type { GameState, RankingEntry } from "../types.ts";
import { impactScores } from "./impact.ts";

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Ranking (R18): net cash = cash − debt; economic score relative to the best net cash;
 * final = 70% economic + 30% impact. Ties: net cash, then impact.
 * Used live by the organizer and frozen at the end.
 */
export function computeRanking(state: GameState): RankingEntry[] {
  const teams = Object.values(state.teams);
  const netCash = new Map(teams.map((team) => [team.id, team.cash - team.finance.debt]));
  const best = Math.max(0, ...netCash.values());
  const entries = teams.map((team) => {
    const net = netCash.get(team.id) ?? 0;
    const economic = best > 0 && net > 0 ? (100 * net) / best : 0;
    const { environmental, social } = impactScores(team);
    const impact = (environmental + social) / 2;
    return {
      rank: 0,
      teamId: team.id,
      companyName: team.companyName ?? team.name,
      netCash: Math.round(net),
      economic: round(economic),
      environmental,
      social,
      impact: round(impact),
      final: round(scoreRules.economicWeight * economic + scoreRules.impactWeight * impact),
    };
  });
  entries.sort((a, b) => b.final - a.final || b.netCash - a.netCash || b.impact - a.impact);
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });
  return entries;
}

/**
 * End-of-game settlement (R19), run after auctions and trades have released their money:
 * customer shipments still travelling are not paid, supplier orders not received are lost,
 * stock and machines are worth nothing, no wage or interest is charged.
 */
function settle(state: GameState): void {
  for (const team of Object.values(state.teams)) {
    team.shipments = {};
    team.orders = {};
    team.reserved = {};
    team.inbound = {};
  }
}

/** What the projector and the teams may see of the results, given the reveal progress. */
export function revealedResults(state: GameState) {
  const results = state.results;
  if (!results) return null;
  const total = results.ranking.length;
  const visible = results.ranking.filter((entry) => entry.rank > total - results.revealedCount);
  return {
    total,
    revealedCount: results.revealedCount,
    finished: results.revealedCount === total,
    breakdownShown: results.breakdownShown,
    // Before the breakdown, only ranks and names are public.
    ranking: visible.map((entry) =>
      results.breakdownShown
        ? entry
        : { rank: entry.rank, teamId: entry.teamId, companyName: entry.companyName },
    ),
  };
}

export const scoringCommands = [
  defineCommand({
    type: "control.revealNext",
    actor: "organizer",
    allowedStatuses: ["ended"],
    schema: z.object({}).optional(),
    apply: (draft) => {
      const results = draft.results;
      if (!results) refuse("INVALID_STATE", "Aucun résultat à révéler.");
      if (results.revealedCount >= results.ranking.length) {
        refuse("INVALID_STATE", "Tout le classement est déjà révélé.");
      }
      results.revealedCount += 1;
      const entry = results.ranking[results.ranking.length - results.revealedCount];
      if (entry) {
        announce(
          draft,
          entry.rank === 1
            ? `Victoire de ${entry.companyName} !`
            : `${entry.rank}e : ${entry.companyName}`,
        );
      }
    },
  }),
  defineCommand({
    type: "control.showBreakdown",
    actor: "organizer",
    allowedStatuses: ["ended"],
    schema: z.object({}).optional(),
    apply: (draft) => {
      const results = draft.results;
      if (!results) refuse("INVALID_STATE", "Aucun résultat à afficher.");
      if (results.revealedCount < results.ranking.length) {
        refuse("INVALID_STATE", "Révélez d'abord tout le classement.");
      }
      results.breakdownShown = true;
    },
  }),
];

/** Must run last at the end: other systems release money first. */
export const scoringSystem: GameSystem = {
  name: "scoring",
  onEnd: (draft) => {
    settle(draft);
    draft.results = { ranking: computeRanking(draft), revealedCount: 0, breakdownShown: false };
  },
};
