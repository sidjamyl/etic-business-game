import {
  type Branch,
  type ProductId,
  productById,
  products,
  progressionRules,
} from "@etic/content";
import { z } from "zod";
import { defineCommand } from "../commands.ts";
import { refuse } from "../errors.ts";
import { logTeam } from "../log.ts";
import type { GameSystem } from "../systems.ts";
import type { TeamState } from "../types.ts";
import { actingTeam, credits, spend } from "./shared.ts";

const branchName = (branch: Branch) => progressionRules.branches[branch];

/** Units delivered and paid for the products of a tier (R2: sales milestone). */
export function unitsSold(team: TeamState, tier: 1 | 2 | 3): number {
  return products
    .filter((product) => product.tier === tier)
    .reduce((sum, product) => sum + (team.stats.sold[product.id] ?? 0), 0);
}

/** Progress toward the next tier, for the team view. */
export function milestoneProgress(team: TeamState) {
  const next = team.progression.unlockedTier + 1;
  if (next !== 2 && next !== 3) return null;
  const rule = progressionRules.tiers[next];
  return {
    tier: next,
    sold: unitsSold(team, rule.milestoneTier),
    required: rule.milestoneUnits,
    cost: rule.cost,
    days: rule.days,
  };
}

/** Whether the company may produce a product (tier unlocked and, for tier 3, its branch). */
export function canProduce(team: TeamState, productId: ProductId): boolean {
  const product = productById.get(productId);
  if (!product) return false;
  if (product.tier > team.progression.unlockedTier) return false;
  return product.tier < 3 || product.branch === team.progression.branch;
}

export const progressionCommands = [
  defineCommand({
    type: "progression.invest",
    actor: "team",
    schema: z.object({
      tier: z.union([z.literal(2), z.literal(3)]),
      branch: z.enum(["tech", "leisure"]).optional(),
    }),
    apply: (draft, { tier, branch }, actor) => {
      const team = actingTeam(draft, actor);
      const progression = team.progression;
      if (progression.project) {
        refuse("ALREADY_IN_PROGRESS", "Un projet de développement est déjà en cours.");
      }
      if (tier <= progression.unlockedTier) refuse("INVALID_STATE", "Ce palier est déjà débloqué.");
      if (tier !== progression.unlockedTier + 1) {
        refuse("INVALID_STATE", "Débloquez d'abord le palier précédent.");
      }
      if (tier === 3 && !branch) {
        refuse("INVALID_PAYLOAD", "Choisissez la branche Tech ou Loisirs.");
      }
      const rule = progressionRules.tiers[tier];
      const sold = unitsSold(team, rule.milestoneTier);
      if (sold < rule.milestoneUnits) {
        refuse(
          "NOT_READY",
          `Jalon non atteint : ${sold} / ${rule.milestoneUnits} produits du palier ${rule.milestoneTier} vendus.`,
        );
      }
      spend(draft, team, rule.cost, "development", `Projet de développement du palier ${tier}`);
      const chosen = tier === 3 ? (branch ?? null) : null;
      progression.project = { tier, branch: chosen, completesOnDay: draft.time.day + rule.days };
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `Projet de développement du palier ${tier}${chosen ? ` (branche ${branchName(chosen)}, choix définitif)` : ""} pour ${credits(rule.cost)}, prêt jour ${progression.project.completesOnDay}.`,
      });
    },
  }),
];

export const progressionSystem: GameSystem = {
  name: "progression",
  onDay: (draft) => {
    for (const team of Object.values(draft.teams)) {
      const project = team.progression.project;
      if (!project || draft.time.day < project.completesOnDay) continue;
      team.progression.unlockedTier = project.tier;
      if (project.branch) team.progression.branch = project.branch;
      team.progression.project = null;
      logTeam(draft, team.id, {
        kind: "system",
        message: project.branch
          ? `Palier 3 débloqué : branche ${branchName(project.branch)}.`
          : `Palier ${project.tier} débloqué.`,
      });
    }
  },
};
