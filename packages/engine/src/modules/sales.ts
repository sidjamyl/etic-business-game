import {
  itemName,
  type ProductId,
  productById,
  productIds,
  products,
  type RegionId,
  regionById,
  regionIds,
  regions,
  salesRules,
  travelDays,
} from "@etic/content";
import { z } from "zod";
import { defineCommand } from "../commands.ts";
import { refuse } from "../errors.ts";
import { allocateId, logTeam } from "../log.ts";
import { nextInt } from "../rng.ts";
import type { GameSystem } from "../systems.ts";
import type { CustomerOrder, GameState, TeamState } from "../types.ts";
import { campaignBoost } from "./marketing.ts";
import { actingTeam, availableStock, credits } from "./shared.ts";

export const comboKey = (region: RegionId, productId: ProductId) => `${region}:${productId}`;

/** Price customers of a region consider normal (N10). */
export function localPrice(region: RegionId, productId: ProductId): number {
  const reference = productById.get(productId)?.referencePrice ?? 0;
  return reference * (regionById.get(region)?.purchasingPower ?? 1);
}

export function maxPrice(region: RegionId, productId: ProductId): number {
  return localPrice(region, productId) * salesRules.maxPriceFactor;
}

/**
 * Demand multiplier from a price: 1 at the local price, up to `cheapDemandBoost` when cheaper,
 * down to 0 at the maximum price (N10).
 */
export function priceEffect(price: number, region: RegionId, productId: ProductId): number {
  const local = localPrice(region, productId);
  const max = maxPrice(region, productId);
  if (price >= max) return 0;
  if (price >= local) return 1 - (price - local) / (max - local);
  const boost = salesRules.cheapDemandBoost - 1;
  return Math.min(salesRules.cheapDemandBoost, 1 + (boost * (local - price)) / (local / 2));
}

/** Share of the tier's full demand reached on `day` in `region` (N10). */
export function recoveryLevel(state: GameState, tier: 1 | 2 | 3, region: RegionId, day: number) {
  if (tier === 1) return 1;
  const ramp = salesRules.recovery[tier];
  const offset =
    state.market.recoveryShiftDays[tier] - (regionById.get(region)?.recoveryHeadStartDays ?? 0);
  const from = ramp.from + offset;
  const to = ramp.to + offset;
  if (day <= from) return 0;
  if (day >= to) return 1;
  return (day - from) / (to - from);
}

export function demandModifier(state: GameState, region: RegionId, productId: ProductId): number {
  let factor = 1;
  for (const modifier of Object.values(state.market.demandModifiers)) {
    if (modifier.region !== null && modifier.region !== region) continue;
    if (modifier.productId !== null && modifier.productId !== productId) continue;
    factor *= modifier.factor;
  }
  return factor;
}

/** Marketing boost for a team's offer (R10). */
export function marketingFactor(team: TeamState, region: RegionId, productId: ProductId): number {
  return campaignBoost(team, region, productId);
}

export function reputationFactor(team: TeamState): number {
  return 0.5 + team.reputation / 100;
}

export function deliveryFactor(team: TeamState, region: RegionId): number {
  if (!team.region) return 0;
  const extraDays = travelDays(team.region, region) - 1;
  return Math.max(0, 1 - extraDays * salesRules.deliveryPenaltyPerDay);
}

export function attractiveness(team: TeamState, region: RegionId, productId: ProductId): number {
  const price = team.prices[region]?.[productId];
  if (price === undefined) return 0;
  return (
    priceEffect(price, region, productId) *
    reputationFactor(team) *
    deliveryFactor(team, region) *
    marketingFactor(team, region, productId)
  );
}

/** Units demanded per day from each team in a region for a product (N10). */
export function teamDemand(state: GameState, region: RegionId, productId: ProductId) {
  const product = productById.get(productId);
  const regionData = regionById.get(region);
  const result = new Map<string, number>();
  if (!product || !regionData) return result;
  const offers = Object.values(state.teams)
    .map((team) => ({ team, weight: attractiveness(team, region, productId) }))
    .filter((offer) => offer.weight > 0);
  const totalWeight = offers.reduce((sum, offer) => sum + offer.weight, 0);
  if (totalWeight === 0) return result;
  const base =
    product.baseDemand *
    regionData.population *
    recoveryLevel(state, product.tier, region, state.time.day) *
    demandModifier(state, region, productId);
  // Market size follows the attractiveness-weighted price effect of the offers.
  const priceWeighted =
    offers.reduce((sum, offer) => {
      const price = offer.team.prices[region]?.[productId] ?? 0;
      return sum + offer.weight * priceEffect(price, region, productId);
    }, 0) / totalWeight;
  for (const offer of offers) {
    result.set(offer.team.id, (base * priceWeighted * offer.weight) / totalWeight);
  }
  return result;
}

function requireOrder(team: TeamState, orderId: string): CustomerOrder {
  const order = team.orders[orderId];
  if (!order) refuse("NOT_FOUND", "Commande introuvable.");
  return order;
}

function accept(team: TeamState, order: CustomerOrder): void {
  team.reserved[order.productId] = (team.reserved[order.productId] ?? 0) + order.quantity;
  order.status = "accepted";
}

export const salesCommands = [
  defineCommand({
    type: "sales.setPrice",
    actor: "team",
    schema: z.object({
      region: z.enum(regionIds),
      productId: z.enum(productIds),
      price: z.number().positive("Le prix doit être positif.").max(1_000_000).nullable(),
    }),
    apply: (draft, { region, productId, price }, actor) => {
      const team = actingTeam(draft, actor);
      const regionPrices = team.prices[region] ?? {};
      if (price === null) delete regionPrices[productId];
      else regionPrices[productId] = Math.round(price * 100) / 100;
      team.prices[region] = regionPrices;
      const regionName = regionById.get(region)?.name ?? region;
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message:
          price === null
            ? `Retrait de ${itemName(productId)} du marché de ${regionName}.`
            : `Prix de ${itemName(productId)} à ${regionName} : ${credits(price)}.`,
      });
    },
  }),

  defineCommand({
    type: "sales.acceptOrder",
    actor: "team",
    schema: z.object({ orderId: z.string().min(1) }),
    apply: (draft, { orderId }, actor) => {
      const team = actingTeam(draft, actor);
      const order = requireOrder(team, orderId);
      if (order.status !== "pending") refuse("INVALID_STATE", "Cette commande est déjà acceptée.");
      const available = availableStock(team, order.productId);
      if (available < order.quantity) {
        refuse(
          "OUT_OF_STOCK",
          `Stock insuffisant : ${available} ${itemName(order.productId)} disponible(s), ${order.quantity} demandé(s).`,
        );
      }
      accept(team, order);
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `Commande acceptée : ${order.quantity} × ${itemName(order.productId)} pour ${credits(order.quantity * order.unitPrice)}.`,
      });
    },
  }),

  defineCommand({
    type: "sales.declineOrder",
    actor: "team",
    schema: z.object({ orderId: z.string().min(1) }),
    apply: (draft, { orderId }, actor) => {
      const team = actingTeam(draft, actor);
      const order = requireOrder(team, orderId);
      if (order.status !== "pending") {
        refuse("INVALID_STATE", "Une commande acceptée ne peut plus être refusée.");
      }
      delete team.orders[orderId];
    },
  }),

  defineCommand({
    type: "sales.setAutoAccept",
    actor: "team",
    schema: z.object({ productId: z.enum(productIds), enabled: z.boolean() }),
    apply: (draft, { productId, enabled }, actor) => {
      const team = actingTeam(draft, actor);
      if (enabled) team.autoAccept[productId] = true;
      else delete team.autoAccept[productId];
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `Acceptation automatique de ${itemName(productId)} ${enabled ? "activée" : "désactivée"}.`,
      });
    },
  }),
];

function createOrders(
  draft: GameState,
  team: TeamState,
  region: RegionId,
  productId: ProductId,
  units: number,
) {
  const product = productById.get(productId);
  if (!product || !team.region) return;
  const key = comboKey(region, productId);
  let carry = (team.demandCarry[key] ?? 0) + units;
  const size = salesRules.orderSize[product.tier];
  while (carry >= size.min) {
    const quantity = Math.min(nextInt(draft.rng, size.min, size.max), Math.floor(carry));
    carry -= quantity;
    const id = `o-${allocateId(draft)}`;
    const order: CustomerOrder = {
      id,
      productId,
      region,
      quantity,
      unitPrice: team.prices[region]?.[productId] ?? 0,
      createdDay: draft.time.day,
      expiresOnDay: draft.time.day + salesRules.orderExpiryDays,
      deadlineDay: draft.time.day + travelDays(team.region, region) + salesRules.deadlineSlackDays,
      status: "pending",
    };
    team.orders[id] = order;
    const history = team.stats.orderHistory[draft.time.day] ?? {};
    history[key] = (history[key] ?? 0) + quantity;
    team.stats.orderHistory[draft.time.day] = history;
  }
  team.demandCarry[key] = carry;
}

function autoAcceptOrders(draft: GameState, team: TeamState): void {
  for (const order of Object.values(team.orders)) {
    if (order.status !== "pending" || !team.autoAccept[order.productId]) continue;
    if (availableStock(team, order.productId) < order.quantity) continue;
    accept(team, order);
    logTeam(draft, team.id, {
      kind: "system",
      message: `Commande acceptée automatiquement : ${order.quantity} × ${itemName(order.productId)}.`,
    });
  }
}

export const salesSystem: GameSystem = {
  name: "sales",
  onDay: (draft) => {
    const oldest = draft.time.day - salesRules.historyDays;
    for (const team of Object.values(draft.teams)) {
      for (const day of Object.keys(team.stats.orderHistory)) {
        if (Number(day) < oldest) delete team.stats.orderHistory[day];
      }
    }
    for (const [id, modifier] of Object.entries(draft.market.demandModifiers)) {
      if (modifier.untilDay !== null && draft.time.day > modifier.untilDay) {
        delete draft.market.demandModifiers[id];
      }
    }
  },
  onStep: (draft) => {
    for (const region of regions) {
      for (const product of products) {
        const demand = teamDemand(draft, region.id, product.id);
        for (const [teamId, unitsPerDay] of demand) {
          const team = draft.teams[teamId];
          if (team)
            createOrders(
              draft,
              team,
              region.id,
              product.id,
              unitsPerDay / draft.config.stepsPerDay,
            );
        }
      }
    }
    for (const team of Object.values(draft.teams)) {
      for (const order of Object.values(team.orders)) {
        if (order.status === "pending" && draft.time.day > order.expiresOnDay)
          delete team.orders[order.id];
      }
      autoAcceptOrders(draft, team);
    }
  },
};
