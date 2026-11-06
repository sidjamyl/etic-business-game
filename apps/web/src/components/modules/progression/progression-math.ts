import {
  type Branch,
  itemName,
  type MaterialId,
  machineTypes,
  type Product,
  type ProductId,
  products,
  progressionRules,
} from "@etic/content";
import {
  type GameStatus,
  type ProgressionState,
  type SimTime,
  type TeamState,
  unitsSold,
} from "@etic/engine";
import { credits, formatNumber } from "@/lib/format";

/** Product tiers (R1). */
export type Tier = 1 | 2 | 3;

/** Tiers opened by a development project (R2). */
export type UnlockableTier = keyof typeof progressionRules.tiers;

/** Narrows a tier number (the team view types it loosely) to a tier opened by a project. */
export function isUnlockableTier(tier: number): tier is UnlockableTier {
  return Object.hasOwn(progressionRules.tiers, tier);
}

/** Names of the tiers (product.md §14). */
export const tierNames: Record<Tier, string> = {
  1: "Essentiels",
  2: "Courants",
  3: "Avancés",
};

/** The two exclusive tier-3 branches, in content order (Tech, then Loisirs). */
export const branchIds = Object.keys(progressionRules.branches) as Branch[];

export function branchName(branch: Branch): string {
  return progressionRules.branches[branch];
}

/** The branch closed for good once `branch` is chosen. */
export function otherBranch(branch: Branch): Branch {
  return branchIds.find((id) => id !== branch) ?? branch;
}

/** Products of a tier, or of one tier-3 branch, in catalog order (R1). */
export function tierProducts(tier: Tier, branch?: Branch): Product[] {
  return products.filter(
    (product) => product.tier === tier && (branch === undefined || product.branch === branch),
  );
}

/** "Vêtements, Plats préparés, Bouilloire". */
export function productNames(list: readonly Product[]): string {
  return list.map((product) => product.name).join(", ");
}

/** Raw materials of a product, by name, in recipe order (N7). */
export function recipeMaterials(product: Product): string[] {
  return (Object.keys(product.recipe) as MaterialId[]).map((id) => itemName(id));
}

/** Machines sold by equipment suppliers that make a product (auction-only lines left out). */
export function machinesFor(productId: ProductId): string[] {
  return machineTypes
    .filter((type) => !type.auctionOnly && type.products[productId] !== undefined)
    .map((type) => type.name);
}

/** The branch the company is committed to: unlocked, or chosen by the tier-3 project. */
export function chosenBranch(progression: ProgressionState): Branch | null {
  return progression.branch ?? progression.project?.branch ?? null;
}

export type BranchStatus = "open" | "chosen" | "closed";

export function branchStatus(progression: ProgressionState, branch: Branch): BranchStatus {
  const chosen = chosenBranch(progression);
  if (chosen === null) return "open";
  return chosen === branch ? "chosen" : "closed";
}

/** Sales milestone and development project of a tier (R2, story 51). */
export interface TierMilestone {
  tier: UnlockableTier;
  /** Tier whose units delivered and paid count toward the milestone. */
  salesTier: 1 | 2;
  sold: number;
  required: number;
  cost: number;
  days: number;
}

export function tierMilestone(team: TeamState, tier: UnlockableTier): TierMilestone {
  const rule = progressionRules.tiers[tier];
  return {
    tier,
    salesTier: rule.milestoneTier,
    sold: unitsSold(team, rule.milestoneTier),
    required: rule.milestoneUnits,
    cost: rule.cost,
    days: rule.days,
  };
}

/** Share of a milestone reached, from 0 to 1. */
export function milestoneRatio(sold: number, required: number): number {
  if (required <= 0) return 1;
  return Math.min(1, Math.max(0, sold / required));
}

/** "1 vente", "170 ventes". */
export function salesLabel(count: number): string {
  return `${formatNumber(count)} ${Math.abs(count) < 2 ? "vente" : "ventes"}`;
}

export type TierStatus =
  | { kind: "unlocked" }
  | { kind: "developing"; completesOnDay: number }
  /** Next tier, milestone met: the project can be financed. */
  | { kind: "ready" }
  /** Next tier, milestone not met yet. */
  | { kind: "locked" }
  /** The tier before it must be unlocked first. */
  | { kind: "later" };

/** Where a tier stands for the company (R2). */
export function tierStatus(
  progression: ProgressionState,
  tier: Tier,
  milestoneMet: boolean,
): TierStatus {
  if (tier <= progression.unlockedTier) return { kind: "unlocked" };
  const project = progression.project;
  if (project?.tier === tier) return { kind: "developing", completesOnDay: project.completesOnDay };
  if (tier > progression.unlockedTier + 1) return { kind: "later" };
  return milestoneMet ? { kind: "ready" } : { kind: "locked" };
}

export interface InvestBlocker {
  kind: "paused" | "ended" | "not-started" | "milestone" | "cash";
  message: string;
}

/** Why the next development project cannot be financed now, or null when it can (R2, R16). */
export function investBlocker(check: {
  status: GameStatus;
  sold: number;
  required: number;
  salesTier: number;
  cost: number;
  available: number;
}): InvestBlocker | null {
  if (check.status === "paused") {
    return { kind: "paused", message: "Jeu en pause : vous pourrez investir à la reprise." };
  }
  if (check.status === "ended") {
    return { kind: "ended", message: "Partie terminée : plus aucune décision possible." };
  }
  if (check.status !== "running") {
    return { kind: "not-started", message: "La partie n'a pas encore commencé." };
  }
  if (check.sold < check.required) {
    return {
      kind: "milestone",
      message: `Jalon non atteint : encore ${salesLabel(check.required - check.sold)} de produits du palier ${check.salesTier}.`,
    };
  }
  if (check.cost > check.available) {
    return {
      kind: "cash",
      message: `Trésorerie disponible insuffisante : il manque ${credits(check.cost - check.available)}.`,
    };
  }
  return null;
}

/** Share of a development project already done, from 0 to 1. */
export function developmentProgress(
  completesOnDay: number,
  days: number,
  time: SimTime,
  stepsPerDay: number,
): number {
  if (days <= 0) return 1;
  const now = time.day + time.step / stepsPerDay;
  return Math.min(1, Math.max(0, (now - (completesOnDay - days)) / days));
}

/** Simulated days left before the start of `day`, sub-steps included. */
export function daysUntil(day: number, time: SimTime, stepsPerDay: number): number {
  return Math.max(0, day - time.day - time.step / stepsPerDay);
}

/** "aujourd'hui", "demain", "dans 7 j". */
export function relativeDay(day: number, today: number): string {
  const delta = day - today;
  if (delta <= 0) return "aujourd'hui";
  if (delta === 1) return "demain";
  return `dans ${delta} j`;
}
