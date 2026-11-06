import {
  deliveryRules,
  hrRules,
  itemName,
  type RegionId,
  regionById,
  salesRules,
  shippingCostFactor,
  type TransportOption,
  transportOptions,
  travelDays,
} from "@etic/content";
import { z } from "zod";
import { defineCommand } from "../commands.ts";
import { refuse } from "../errors.ts";
import { allocateId, logTeam } from "../log.ts";
import type { GameSystem } from "../systems.ts";
import type { CustomerOrder, GameState, TeamState } from "../types.ts";
import { activeEmployees, isOnStrike } from "./hr.ts";
import { recordTransport } from "./impact.ts";
import { actingTeam, credits, earn, spend } from "./shared.ts";

/** Travel days for an option: express halves, green adds half, minimum one day (N11). */
export function shippingDays(option: TransportOption, from: RegionId, to: RegionId): number {
  const days = travelDays(from, to) * deliveryRules.options[option].durationFactor;
  return Math.max(1, Math.ceil(days));
}

/** Cost of a shipment, paid when it is requested (N11). */
export function shippingCost(
  option: TransportOption,
  quantity: number,
  from: RegionId,
  to: RegionId,
): number {
  const variable =
    deliveryRules.options[option].costPerUnitPerDay * quantity * travelDays(from, to);
  return Math.round((deliveryRules.baseCost + variable) * shippingCostFactor[from]);
}

/** Extra days caused by transport events touching either end of a route (R12). */
export function extraTransportDays(state: GameState, from: RegionId, to: RegionId): number {
  let extra = 0;
  for (const delay of Object.values(state.market.transportDelays)) {
    if (delay.region === from || delay.region === to) extra += delay.extraDays;
  }
  return extra;
}

/** Shipments the team can prepare per day: logisticians at work × 5, none during a strike. */
export function logisticsCapacity(team: TeamState, day: number): number {
  if (isOnStrike(team)) return 0;
  const logisticians = activeEmployees(team, day).filter((e) => e.job === "logistician").length;
  return logisticians * hrRules.shipmentsPerLogisticianPerDay;
}

function adjustReputation(team: TeamState, delta: number): void {
  const { min, max } = salesRules.reputation;
  team.reputation = Math.min(max, Math.max(min, team.reputation + delta));
}

function releaseReservation(team: TeamState, order: CustomerOrder): void {
  const left = (team.reserved[order.productId] ?? 0) - order.quantity;
  if (left > 0) team.reserved[order.productId] = left;
  else delete team.reserved[order.productId];
}

export const deliveryCommands = [
  defineCommand({
    type: "delivery.ship",
    actor: "team",
    schema: z.object({ orderId: z.string().min(1), option: z.enum(transportOptions) }),
    apply: (draft, { orderId, option }, actor) => {
      const team = actingTeam(draft, actor);
      const order = team.orders[orderId];
      if (!order) refuse("NOT_FOUND", "Commande introuvable.");
      if (order.status === "pending") refuse("INVALID_STATE", "Acceptez d'abord la commande.");
      if (order.status === "shipping")
        refuse("ALREADY_IN_PROGRESS", "Cette commande est déjà expédiée.");
      if (!team.region) refuse("INVALID_STATE", "Choisissez d'abord une région.");
      const cost = Math.round(
        shippingCost(option, order.quantity, team.region, order.region) * team.perks.shippingFactor,
      );
      spend(
        draft,
        team,
        cost,
        "shipping",
        `Expédition vers ${regionById.get(order.region)?.name ?? order.region}`,
      );
      const id = `s-${allocateId(draft)}`;
      team.shipments[id] = {
        id,
        orderId,
        productId: order.productId,
        destination: order.region,
        quantity: order.quantity,
        option,
        cost,
        status: "queued",
        travelDays: shippingDays(option, team.region, order.region),
        departedDay: null,
        arrivesOnDay: null,
      };
      order.status = "shipping";
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `Expédition ${deliveryRules.options[option].name.toLowerCase()} de ${order.quantity} × ${itemName(order.productId)} vers ${regionById.get(order.region)?.name ?? order.region} pour ${credits(cost)}.`,
      });
    },
  }),
];

function prepareShipments(draft: GameState, team: TeamState): void {
  const capacity = logisticsCapacity(team, draft.time.day);
  for (const shipment of Object.values(team.shipments)) {
    if (shipment.status !== "queued") continue;
    if (team.preparedToday >= capacity) return;
    const order = team.orders[shipment.orderId];
    if (order) releaseReservation(team, order);
    const left = (team.inventory[shipment.productId] ?? 0) - shipment.quantity;
    if (left > 0) team.inventory[shipment.productId] = left;
    else delete team.inventory[shipment.productId];
    shipment.status = "in-transit";
    if (team.region)
      shipment.travelDays += extraTransportDays(draft, team.region, shipment.destination);
    shipment.departedDay = draft.time.day;
    shipment.arrivesOnDay = draft.time.day + shipment.travelDays;
    team.preparedToday += 1;
    team.stats.shippedUnits[shipment.option] =
      (team.stats.shippedUnits[shipment.option] ?? 0) + shipment.quantity;
    recordTransport(team, shipment.option, shipment.quantity);
  }
}

function deliverShipments(draft: GameState, team: TeamState): void {
  for (const shipment of Object.values(team.shipments)) {
    if (shipment.status !== "in-transit" || (shipment.arrivesOnDay ?? Infinity) > draft.time.day) {
      continue;
    }
    const order = team.orders[shipment.orderId];
    delete team.shipments[shipment.id];
    if (!order) continue;
    delete team.orders[order.id];
    const onTime = draft.time.day <= order.deadlineDay;
    const revenue = Math.round(
      order.quantity * order.unitPrice * (onTime ? 1 : 1 - deliveryRules.lateDiscount),
    );
    earn(draft, team, revenue, "sales", `${order.quantity} × ${itemName(order.productId)}`);
    team.stats.revenue += revenue;
    team.stats.sold[order.productId] = (team.stats.sold[order.productId] ?? 0) + order.quantity;
    if (onTime) {
      adjustReputation(team, salesRules.reputation.onTime);
    } else {
      team.stats.lateDeliveries += 1;
      adjustReputation(team, salesRules.reputation.late);
    }
    logTeam(draft, team.id, {
      kind: "system",
      message: onTime
        ? `Livraison de ${order.quantity} × ${itemName(order.productId)} : ${credits(revenue)} encaissés.`
        : `Livraison en retard de ${order.quantity} × ${itemName(order.productId)} : remise de ${deliveryRules.lateDiscount * 100} %, ${credits(revenue)} encaissés.`,
    });
  }
}

function failOverdueOrders(draft: GameState, team: TeamState): void {
  for (const order of Object.values(team.orders)) {
    if (order.status !== "accepted") continue;
    if (draft.time.day <= order.deadlineDay + deliveryRules.failureGraceDays) continue;
    releaseReservation(team, order);
    delete team.orders[order.id];
    team.stats.failedOrders += 1;
    adjustReputation(team, salesRules.reputation.failed);
    logTeam(draft, team.id, {
      kind: "event",
      message: `Commande annulée faute d'expédition : ${order.quantity} × ${itemName(order.productId)}, réputation en baisse.`,
    });
  }
}

export const deliverySystem: GameSystem = {
  name: "delivery",
  onDay: (draft) => {
    for (const team of Object.values(draft.teams)) team.preparedToday = 0;
  },
  onStep: (draft) => {
    for (const team of Object.values(draft.teams)) {
      deliverShipments(draft, team);
      prepareShipments(draft, team);
      failOverdueOrders(draft, team);
    }
  },
};
