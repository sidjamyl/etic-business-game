import {
  itemName,
  marketingRules,
  type ProductId,
  productIds,
  type RegionId,
  regionById,
  regionIds,
  regions,
} from "@etic/content";
import { z } from "zod";
import { defineCommand } from "../commands.ts";
import { refuse } from "../errors.ts";
import { allocateId, logTeam } from "../log.ts";
import type { GameSystem } from "../systems.ts";
import type { Campaign, TeamState } from "../types.ts";
import { actingTeam, credits, spend } from "./shared.ts";

/** Campaign cost (N14): ₢60 × population × breadth × days. */
export function campaignCost(region: RegionId | null, productId: ProductId | null, days: number) {
  const population =
    region === null
      ? regions.reduce((sum, r) => sum + r.population, 0)
      : (regionById.get(region)?.population ?? 0);
  const breadth = productId === null ? marketingRules.wholeRangeFactor : 1;
  return Math.round(marketingRules.costPerDay * population * breadth * days);
}

function covers(campaign: Campaign, region: RegionId, productId: ProductId): boolean {
  return (
    (campaign.region === null || campaign.region === region) &&
    (campaign.productId === null || campaign.productId === productId)
  );
}

/** Attractiveness multiplier from active campaigns; overlapping campaigns do not stack. */
export function campaignBoost(team: TeamState, region: RegionId, productId: ProductId): number {
  for (const campaign of Object.values(team.campaigns)) {
    if (covers(campaign, region, productId)) return marketingRules.attractivenessBoost;
  }
  return 1;
}

export function describeTarget(region: RegionId | null, productId: ProductId | null): string {
  const where = region === null ? "toutes les régions" : (regionById.get(region)?.name ?? region);
  const what = productId === null ? "toute la gamme" : itemName(productId);
  return `${what}, ${where}`;
}

export const marketingCommands = [
  defineCommand({
    type: "marketing.launch",
    actor: "team",
    schema: z.object({
      region: z.enum(regionIds).nullable(),
      productId: z.enum(productIds).nullable(),
      days: z.int().refine((d) => (marketingRules.durations as readonly number[]).includes(d), {
        message: "Durée possible : 7, 14 ou 30 jours.",
      }),
    }),
    apply: (draft, { region, productId, days }, actor) => {
      const team = actingTeam(draft, actor);
      const duplicate = Object.values(team.campaigns).some(
        (c) => c.region === region && c.productId === productId,
      );
      if (duplicate) {
        refuse("ALREADY_IN_PROGRESS", "Une campagne vise déjà exactement cette cible.");
      }
      const cost = campaignCost(region, productId, days);
      const target = describeTarget(region, productId);
      spend(draft, team, cost, "marketing", `Campagne : ${target}`);
      const id = `c-${allocateId(draft)}`;
      team.campaigns[id] = {
        id,
        region,
        productId,
        startDay: draft.time.day,
        endDay: draft.time.day + days - 1,
        cost,
      };
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `Campagne de ${days} jours (${target}) pour ${credits(cost)}.`,
      });
    },
  }),
];

export const marketingSystem: GameSystem = {
  name: "marketing",
  onDay: (draft) => {
    for (const team of Object.values(draft.teams)) {
      for (const campaign of Object.values(team.campaigns)) {
        if (draft.time.day <= campaign.endDay) continue;
        delete team.campaigns[campaign.id];
        logTeam(draft, team.id, {
          kind: "system",
          message: `Fin de la campagne (${describeTarget(campaign.region, campaign.productId)}).`,
        });
      }
    }
  },
};
