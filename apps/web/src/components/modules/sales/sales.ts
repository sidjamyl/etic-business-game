import {
  deliveryRules,
  itemName,
  type ProductId,
  productById,
  productIds,
  products,
  progressionRules,
  type RegionId,
  regionById,
  regionIds,
} from "@etic/content";
import type { CustomerOrder, ProgressionState, SimTime, TeamState } from "@etic/engine";

/**
 * Pure helpers of the Sales module (#31): price input, price position, order inbox and
 * order history. Display only: the server stays the source of truth.
 */

/** Highest price the engine accepts (sales.setPrice schema). */
export const MAX_PRICE = 1_000_000;

export type PriceInput =
  | { kind: "empty" }
  | { kind: "invalid"; message: string }
  | { kind: "price"; value: number };

const DECIMAL = /^(\d+(\.\d*)?|\.\d+)$/;

/** Reads a price typed by a player: "23,5", "23.50", "₢ 1 200". Empty = not selling. */
export function parsePriceInput(text: string): PriceInput {
  const cleaned = text.replace(/[\s₢]/g, "").replace(",", ".");
  if (cleaned === "") return { kind: "empty" };
  if (!DECIMAL.test(cleaned)) {
    return { kind: "invalid", message: "Saisissez un montant, par exemple 24,50." };
  }
  // The engine keeps two decimals.
  const value = Math.round(Number(cleaned) * 100) / 100;
  if (value <= 0) return { kind: "invalid", message: "Le prix doit être positif." };
  if (value > MAX_PRICE) return { kind: "invalid", message: "Prix trop élevé." };
  return { kind: "price", value };
}

/** A price as written in an input: "31" or "23,25". */
export function formatPriceInput(price: number): string {
  return Number.isInteger(price) ? String(price) : price.toFixed(2).replace(".", ",");
}

export type PricePosition =
  | { kind: "no-demand" }
  | { kind: "local" }
  | { kind: "below" | "above"; ratio: number };

/** Where a price sits against a region's local and maximum prices (N10, story 64). */
export function pricePosition(price: number, hint: { local: number; max: number }): PricePosition {
  if (price >= hint.max) return { kind: "no-demand" };
  const ratio = (price - hint.local) / hint.local;
  if (Math.abs(ratio) < 0.005) return { kind: "local" };
  return ratio < 0 ? { kind: "below", ratio: -ratio } : { kind: "above", ratio };
}

/** True when the company sells at least one product somewhere (R7: no price = no sale). */
export function sellsAnywhere(prices: TeamState["prices"]): boolean {
  return Object.values(prices).some((byProduct) => Object.keys(byProduct ?? {}).length > 0);
}

/**
 * Why a product cannot be produced (tier or tier-3 branch), mirroring the engine's
 * `canProduce`. It can still be priced and sold, e.g. after a trade.
 */
export function productLock(
  productId: ProductId,
  progression: Pick<ProgressionState, "unlockedTier" | "branch">,
): string | null {
  const product = productById.get(productId);
  if (!product) return null;
  if (product.tier > progression.unlockedTier) return `Palier ${product.tier} non débloqué`;
  if (product.tier === 3 && product.branch && product.branch !== progression.branch) {
    return `Branche ${progressionRules.branches[product.branch]} fermée`;
  }
  return null;
}

export type ReputationLevel = {
  label: string;
  tone: "default" | "success" | "warning" | "danger";
};

/** Words for a 0–100 reputation, so the value is never read from colour alone. */
export function reputationLevel(reputation: number): ReputationLevel {
  if (reputation >= 80) return { label: "Excellente", tone: "success" };
  if (reputation >= 60) return { label: "Bonne", tone: "success" };
  if (reputation >= 40) return { label: "Moyenne", tone: "default" };
  if (reputation >= 20) return { label: "Fragile", tone: "warning" };
  return { label: "Mauvaise", tone: "danger" };
}

// ——— Orders ———

/** Amount paid by the customer on an on-time delivery (R7: paid on delivery). */
export function orderValue(order: Pick<CustomerOrder, "quantity" | "unitPrice">): number {
  return Math.round(order.quantity * order.unitPrice);
}

const byId = (a: CustomerOrder, b: CustomerOrder) =>
  a.id.localeCompare(b.id, undefined, { numeric: true });

/** Most urgent first: an order leaves the inbox once its last day is over. */
export function byExpiry(a: CustomerOrder, b: CustomerOrder): number {
  return a.expiresOnDay - b.expiresOnDay || a.createdDay - b.createdDay || byId(a, b);
}

export function byDeadline(a: CustomerOrder, b: CustomerOrder): number {
  return a.deadlineDay - b.deadlineDay || a.createdDay - b.createdDay || byId(a, b);
}

/**
 * Simulated days until the end of `lastDay`: an order can be accepted until its expiry day
 * is over, and the step in progress has already started (engine step semantics).
 */
export function daysUntilEndOf(lastDay: number, time: SimTime, stepsPerDay: number): number {
  return Math.max(0, lastDay + 1 - time.day - time.step / stepsPerDay);
}

export function expiryLabel(expiresOnDay: number, today: number): string {
  const days = expiresOnDay - today;
  if (days <= 0) return "Dernier jour";
  if (days === 1) return "Expire demain";
  return `Expire dans ${days} j`;
}

export type DeadlineState =
  | { kind: "on-time"; daysLeft: number }
  | { kind: "late"; daysLate: number; cancelAfterDay: number };

/**
 * Where an accepted order stands against its deadline (R8). An order never shipped is
 * cancelled once `cancelAfterDay` is over.
 */
export function deadlineState(deadlineDay: number, today: number): DeadlineState {
  if (today <= deadlineDay) return { kind: "on-time", daysLeft: deadlineDay - today };
  return {
    kind: "late",
    daysLate: today - deadlineDay,
    cancelAfterDay: deadlineDay + deliveryRules.failureGraceDays,
  };
}

export function deadlineLabel(state: DeadlineState): string {
  if (state.kind === "late") return `En retard de ${state.daysLate} j`;
  if (state.daysLeft === 0) return "Aujourd'hui";
  if (state.daysLeft === 1) return "Demain";
  return `Dans ${state.daysLeft} j`;
}

export interface OrderBook {
  /** Waiting in the inbox, most urgent first. */
  pending: CustomerOrder[];
  /** Accepted (to ship) or already shipping, earliest deadline first. */
  toDeliver: CustomerOrder[];
  /** Accepted orders not shipped yet. */
  toShip: number;
  /** Orders to deliver whose deadline has passed. */
  late: number;
  /** Money expected on delivery, before late discounts. */
  toCollect: number;
}

export function orderBook(orders: Record<string, CustomerOrder>, today: number): OrderBook {
  const all = Object.values(orders);
  const pending = all.filter((order) => order.status === "pending").sort(byExpiry);
  const toDeliver = all.filter((order) => order.status !== "pending").sort(byDeadline);
  return {
    pending,
    toDeliver,
    toShip: toDeliver.filter((order) => order.status === "accepted").length,
    late: toDeliver.filter((order) => order.deadlineDay < today).length,
    toCollect: toDeliver.reduce((sum, order) => sum + orderValue(order), 0),
  };
}

/**
 * Pending orders the current stock can cover together, most urgent first (O2: acceptance
 * reserves the stock, so two orders may compete for the same units).
 */
export function countAcceptable(
  pending: readonly CustomerOrder[],
  stockOf: (productId: ProductId) => number,
): number {
  const left = new Map<ProductId, number>();
  let count = 0;
  for (const order of [...pending].sort(byExpiry)) {
    const available = left.get(order.productId) ?? stockOf(order.productId);
    if (available >= order.quantity) {
      count += 1;
      left.set(order.productId, available - order.quantity);
    } else {
      left.set(order.productId, available);
    }
  }
  return count;
}

// ——— Order history (story 63) ———

export type OrderHistory = TeamState["stats"]["orderHistory"];

export interface OrderFilter {
  fromDay: number;
  toDay: number;
  /** null = every product. */
  productId: ProductId | null;
  /** Regions kept by the filter. */
  regions: readonly RegionId[];
}

/** Small multiples: one panel per region, or one per product ordered in the period. */
export type Grouping = "region" | "product";

export interface OrderSeries {
  key: RegionId | ProductId;
  label: string;
  /** Units ordered on each day of `days`. */
  units: number[];
  total: number;
}

export interface GroupedOrders {
  days: number[];
  series: OrderSeries[];
  /** Highest daily value of all series, for a scale shared by every panel. */
  peak: number;
}

export const isRegionId = (value: string | undefined): value is RegionId =>
  (regionIds as readonly string[]).includes(value ?? "");
export const isProductId = (value: string | undefined): value is ProductId =>
  (productIds as readonly string[]).includes(value ?? "");

/** Reads a history key ("region:product", see the engine's comboKey). */
export function parseComboKey(key: string): { region: RegionId; productId: ProductId } | null {
  const [region, productId] = key.split(":");
  if (!isRegionId(region) || !isProductId(productId)) return null;
  return { region, productId };
}

/** Units ordered per day of the period, per region or per product, days without orders included. */
export function groupOrders(
  history: OrderHistory,
  filter: OrderFilter,
  grouping: Grouping,
): GroupedOrders {
  const days: number[] = [];
  for (let day = filter.fromDay; day <= filter.toDay; day += 1) days.push(day);
  const byKey = new Map<RegionId | ProductId, number[]>();
  days.forEach((day, index) => {
    for (const [key, units] of Object.entries(history[String(day)] ?? {})) {
      const combo = parseComboKey(key);
      if (!combo || !filter.regions.includes(combo.region)) continue;
      if (filter.productId !== null && combo.productId !== filter.productId) continue;
      const group = grouping === "region" ? combo.region : combo.productId;
      const row = byKey.get(group) ?? days.map(() => 0);
      row[index] = (row[index] ?? 0) + units;
      byKey.set(group, row);
    }
  });
  const keys: readonly (RegionId | ProductId)[] =
    grouping === "region"
      ? filter.regions
      : products.filter((product) => byKey.has(product.id)).map((product) => product.id);
  const series = keys.map((key) => {
    const units = byKey.get(key) ?? days.map(() => 0);
    const label = isRegionId(key) ? (regionById.get(key)?.name ?? key) : itemName(key);
    return { key, label, units, total: units.reduce((sum, value) => sum + value, 0) };
  });
  const peak = series.reduce((max, line) => Math.max(max, ...line.units), 0);
  return { days, series, peak };
}

/** Rounds an axis maximum up to a readable value: 37 → 40, 120 → 150. */
export function niceCeil(value: number): number {
  if (value <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8]) {
    if (step * magnitude >= value) return step * magnitude;
  }
  return 10 * magnitude;
}

/** "1 commande", "3 commandes" (French: 0 and 1 take the singular). */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count.toLocaleString("fr-FR")} ${Math.abs(count) > 1 ? pluralForm : singular}`;
}
