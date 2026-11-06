import {
  type Branch,
  equipmentSuppliers,
  type JobId,
  materialSuppliers,
  type ProductId,
  products,
  purchasableMachineTypes,
  purchasePriceFactor,
  type RegionId,
  regions,
  salesRules,
  travelDays,
} from "@etic/content";
import { daysRemaining, isCountdown } from "./clock.ts";
import { auctionsView } from "./modules/auctions.ts";
import { blackMarketView } from "./modules/black-market.ts";
import { logisticsCapacity } from "./modules/delivery.ts";
import { baseWage } from "./modules/hr.ts";
import { type ImpactScores, impactScores } from "./modules/impact.ts";
import { milestoneProgress } from "./modules/progression.ts";
import { revealedResults } from "./modules/scoring.ts";
import { tradesView } from "./modules/trades.ts";
import type {
  Announcement,
  GameState,
  GameStatus,
  NewsItem,
  SimTime,
  TeamState,
  TransportDelay,
} from "./types.ts";

/** What every team (and the projector) may know about a company. */
export interface CompanySummary {
  id: string;
  name: string;
  companyName: string | null;
  region: RegionId | null;
  memberCount: number;
  ready: boolean;
  /** Tier and branch reached: visible on the market anyway. */
  tier: 1 | 2 | 3;
  branch: Branch | null;
}

/** Shared clock information, safe for everyone. */
export interface ClockView {
  status: GameStatus;
  time: SimTime;
  stepsPerDay: number;
  endDay: number | null;
  daysRemaining: number | null;
  countdown: boolean;
}

/** A material supplier as seen by one team: price and delay depend on the buyer's region. */
export interface SupplierOffer {
  id: string;
  name: string;
  region: RegionId;
  material: string;
  unitPrice: number;
  deliveryDays: number | null;
  ethics: { social: number; environmental: number };
  stock: number;
  nextRestockDay: number;
}

export interface MachineOffer {
  supplierId: string;
  supplierName: string;
  supplierRegion: RegionId;
  machineTypeId: string;
  price: number;
  deliveryDays: number | null;
  ethics: { social: number; environmental: number };
  stock: number;
  nextRestockDay: number;
}

export interface MarketView {
  suppliers: Record<string, SupplierOffer>;
  machines: Record<string, MachineOffer>;
  /** People still available for hire, per region (R6). */
  laborPool: Partial<Record<RegionId, number>>;
  /** Normal and maximum price per region and product (N10, story 61). */
  pricing: Partial<Record<RegionId, Partial<Record<ProductId, { local: number; max: number }>>>>;
  /**
   * Transport events in progress (R12): extra days on every route touching the region. Already
   * visible on the shipments they delay; listed here for the shipping previews.
   */
  transportDelays: TransportDelay[];
}

/** A news item as players see it: its origin (scenario or secret card) is never revealed. */
export type PublicNews = Omit<NewsItem, "origin">;

export function publicNews(state: GameState): PublicNews[] {
  return state.news.map(({ origin: _origin, ...item }) => item);
}

/** Everything one team may see. Never contains another team's private data (S9). */
export interface TeamView {
  clock: ClockView;
  team: TeamState;
  memberCap: number;
  /** Units currently stored, all goods combined (R9). */
  warehouseUsed: number;
  /** Shipments the logisticians can prepare per day (R8). */
  logisticsCapacity: number;
  /** Wage of a new hire per job in the team's region, events included (R6, R12). */
  wages: Record<JobId, number>;
  /** Black-market offers for this team (R13); its own traces are in `team.blackMarket`. */
  blackMarket: ReturnType<typeof blackMarketView>;
  /** Final results, only once the organizer has finished the reveal (N21). */
  results: ReturnType<typeof revealedResults>;
  /** Social and environmental indicators with their breakdown (R17). */
  impact: ImpactScores;
  /** Offers and trades involving this company only (R15). */
  trades: ReturnType<typeof tradesView>;
  /** Auctions with this team's own bid only (sealed, R12). */
  auctions: ReturnType<typeof auctionsView>;
  /** Progress toward the next tier; null once tier 3 is reached (R2). */
  nextMilestone: ReturnType<typeof milestoneProgress>;
  market: MarketView;
  /** Other companies, public information only (lobby choices are visible, R21). */
  competitors: Record<string, CompanySummary>;
  news: PublicNews[];
  announcements: Announcement[];
}

/** What the projector screen shows (P10): no private data, no ranking before the end. */
export interface PublicView {
  clock: ClockView;
  teams: Record<string, CompanySummary>;
  news: PublicNews[];
  announcements: Announcement[];
  /** Results as revealed by the organizer (N21); null before the end. */
  results: ReturnType<typeof revealedResults>;
}

/** A team can start once it has a member, a company name and a region (R21). */
export function isTeamReady(team: TeamState): boolean {
  return Object.keys(team.members).length > 0 && team.companyName !== null && team.region !== null;
}

export function companySummary(team: TeamState): CompanySummary {
  return {
    id: team.id,
    name: team.name,
    companyName: team.companyName,
    region: team.region,
    memberCount: Object.keys(team.members).length,
    ready: isTeamReady(team),
    tier: team.progression.unlockedTier,
    branch: team.progression.branch,
  };
}

export function clockView(state: GameState): ClockView {
  return {
    status: state.status,
    time: { ...state.time },
    stepsPerDay: state.config.stepsPerDay,
    endDay: state.endDay,
    daysRemaining: daysRemaining(state),
    countdown: isCountdown(state),
  };
}

export function teamView(state: GameState, teamId: string): TeamView | null {
  const team = state.teams[teamId];
  if (!team) return null;
  const competitors: TeamView["competitors"] = {};
  for (const other of Object.values(state.teams)) {
    if (other.id !== teamId) competitors[other.id] = companySummary(other);
  }
  let warehouseUsed = 0;
  for (const quantity of Object.values(team.inventory)) warehouseUsed += quantity ?? 0;
  return {
    clock: clockView(state),
    team,
    memberCap: state.memberCap,
    warehouseUsed,
    logisticsCapacity: logisticsCapacity(team, state.time.day),
    wages: {
      operator: baseWage(state, team, "operator"),
      logistician: baseWage(state, team, "logistician"),
    },
    nextMilestone: milestoneProgress(team),
    auctions: auctionsView(state, teamId),
    trades: tradesView(state, teamId),
    impact: impactScores(team),
    results: state.results?.breakdownShown ? revealedResults(state) : null,
    blackMarket: blackMarketView(state, team),
    market: marketView(state, team.region),
    competitors,
    news: publicNews(state),
    announcements: state.announcements,
  };
}

export function publicView(state: GameState): PublicView {
  const teams: PublicView["teams"] = {};
  for (const team of Object.values(state.teams)) teams[team.id] = companySummary(team);
  return {
    clock: clockView(state),
    teams,
    news: publicNews(state),
    announcements: state.announcements,
    results: revealedResults(state),
  };
}

/** Finds the team of a user in this game, if any. */
export function teamOfUser(state: GameState, userId: string): string | null {
  for (const team of Object.values(state.teams)) if (team.members[userId]) return team.id;
  return null;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Prices and delays for a buyer in `region` (unknown before the region is chosen). */
export function marketView(state: GameState, region: RegionId | null): MarketView {
  const factor = region ? purchasePriceFactor[region] : 1;
  const suppliers: MarketView["suppliers"] = {};
  for (const supplier of materialSuppliers) {
    const market = state.market.suppliers[supplier.id];
    if (!market) continue;
    suppliers[supplier.id] = {
      id: supplier.id,
      name: supplier.name,
      region: supplier.region,
      material: supplier.material,
      unitPrice: round2(supplier.price * market.priceFactor * factor),
      deliveryDays: region ? supplier.handlingDays + travelDays(supplier.region, region) : null,
      ethics: supplier.ethics,
      stock: market.stock,
      nextRestockDay: market.nextRestockDay,
    };
  }
  const machines: MarketView["machines"] = {};
  for (const supplier of equipmentSuppliers) {
    const market = state.market.equipment[supplier.id];
    if (!market) continue;
    for (const type of purchasableMachineTypes) {
      machines[`${supplier.id}:${type.id}`] = {
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierRegion: supplier.region,
        machineTypeId: type.id,
        price: Math.round(type.price * supplier.priceFactor * market.priceFactor * factor),
        deliveryDays: region ? supplier.handlingDays + travelDays(supplier.region, region) : null,
        ethics: supplier.ethics,
        stock: market.stock[type.id] ?? 0,
        nextRestockDay: market.nextRestockDay,
      };
    }
  }
  const pricing: MarketView["pricing"] = {};
  for (const region of regions) {
    const byProduct: Partial<Record<ProductId, { local: number; max: number }>> = {};
    for (const product of products) {
      const local = product.referencePrice * region.purchasingPower;
      byProduct[product.id] = {
        local: round2(local),
        max: round2(local * salesRules.maxPriceFactor),
      };
    }
    pricing[region.id] = byProduct;
  }
  return {
    suppliers,
    machines,
    laborPool: { ...state.market.laborPool },
    pricing,
    transportDelays: Object.values(state.market.transportDelays).map((delay) => ({ ...delay })),
  };
}
