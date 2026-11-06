import {
  deliveryRules,
  type RegionId,
  shippingCostFactor,
  type TransportOption,
  transportOptions,
  travelDays,
} from "@etic/content";
import {
  type CustomerOrder,
  logisticsCapacity,
  type Shipment,
  shippingCost,
  shippingDays,
  type TeamView,
  type TransportDelay,
} from "@etic/engine";

/**
 * Client-side previews of the delivery rules (R8, N11) for the Livraisons page. The server
 * stays the source of truth: these figures only help players choose before they ship.
 */

/** Days ahead the departure estimates look; beyond that, a shipment counts as stuck. */
export const PLANNING_HORIZON_DAYS = 30;

/** When shipments can be prepared, seen from the current sub-step. */
export interface PreparationSlots {
  day: number;
  step: number;
  stepsPerDay: number;
  /** Shipments the logisticians already prepared today. */
  preparedToday: number;
  /** Shipments that can be prepared on a day: 0 without logisticians or during a strike. */
  capacityOn: (day: number) => number;
}

/** Shipments are prepared at the next sub-step: after the evening, that is the next day. */
export function firstPreparationDay(slots: PreparationSlots): number {
  return slots.step >= slots.stepsPerDay - 1 ? slots.day + 1 : slots.day;
}

/**
 * Expected departure day of the first `count` shipments of the preparation queue, in queue
 * order; null when no logistician can prepare them within the planning horizon.
 */
export function departureDays(slots: PreparationSlots, count: number): (number | null)[] {
  const days: (number | null)[] = [];
  const lastDay = slots.day + PLANNING_HORIZON_DAYS;
  let day = firstPreparationDay(slots);
  let used = day === slots.day ? slots.preparedToday : 0;
  for (let index = 0; index < count; index++) {
    while (day <= lastDay && used >= slots.capacityOn(day)) {
      day += 1;
      used = 0;
    }
    if (day > lastDay) {
      days.push(null);
      continue;
    }
    days.push(day);
    used += 1;
  }
  return days;
}

/** Payment received on delivery: the order's price, minus the late discount when late (N11). */
export function deliveryRevenue(
  order: Pick<CustomerOrder, "quantity" | "unitPrice">,
  onTime: boolean,
): number {
  const factor = onTime ? 1 : 1 - deliveryRules.lateDiscount;
  return Math.round(order.quantity * order.unitPrice * factor);
}

/** Day an accepted order that was never shipped is cancelled, without payment (N11). */
export function cancellationDay(order: Pick<CustomerOrder, "deadlineDay">): number {
  return order.deadlineDay + deliveryRules.failureGraceDays + 1;
}

/** One transport option for an order, priced like the engine does (N11). */
export interface ShippingQuote {
  option: TransportOption;
  /** Paid when the shipment is requested. */
  cost: number;
  /** Travel days once the shipment has left, current event delays included. */
  travelDays: number;
  /** Expected delivery day; null while nobody can prepare the shipment. */
  arrivalDay: number | null;
  /** Null when the arrival is unknown. */
  onTime: boolean | null;
  /** Expected payment on delivery. */
  revenue: number;
}

export function shippingQuotes(
  order: Pick<CustomerOrder, "quantity" | "unitPrice" | "region" | "deadlineDay">,
  from: RegionId,
  shippingFactor: number,
  departureDay: number | null,
  delays: readonly TransportDelay[] = [],
): ShippingQuote[] {
  return transportOptions.map((option) => {
    const travelDays =
      shippingDays(option, from, order.region) + routeDelayDays(delays, from, order.region);
    const arrivalDay = departureDay === null ? null : departureDay + travelDays;
    const onTime = arrivalDay === null ? null : arrivalDay <= order.deadlineDay;
    return {
      option,
      cost: Math.round(shippingCost(option, order.quantity, from, order.region) * shippingFactor),
      travelDays,
      arrivalDay,
      onTime,
      revenue: deliveryRevenue(order, onTime !== false),
    };
  });
}

/** How an accepted order can still be delivered if it is shipped now. */
export type OrderOutlook =
  | { kind: "on-time" }
  /** Only faster (dearer, more polluting) options still arrive on time. */
  | { kind: "faster-only"; options: TransportOption[] }
  | { kind: "late"; daysLate: number }
  /** Deadline passed: cancelled on `cancelDay` unless it is shipped before. */
  | { kind: "overdue"; cancelDay: number }
  /** Nobody can prepare it within the planning horizon. */
  | { kind: "stuck" };

export function orderOutlook(
  order: Pick<CustomerOrder, "deadlineDay">,
  quotes: readonly ShippingQuote[],
  today: number,
): OrderOutlook {
  if (today > order.deadlineDay) return { kind: "overdue", cancelDay: cancellationDay(order) };
  const arrivals = quotes.flatMap((quote) => (quote.arrivalDay === null ? [] : [quote.arrivalDay]));
  if (arrivals.length === 0) return { kind: "stuck" };
  if (quotes.some((quote) => quote.option === "standard" && quote.onTime)) {
    return { kind: "on-time" };
  }
  const faster = quotes.filter((quote) => quote.onTime).map((quote) => quote.option);
  if (faster.length > 0) return { kind: "faster-only", options: faster };
  return { kind: "late", daysLate: Math.min(...arrivals) - order.deadlineDay };
}

/** Travel time and price of a route for one option: a flat fee plus an amount per unit. */
export interface RouteRate {
  option: TransportOption;
  days: number;
  /** Flat part of the cost, per shipment. */
  fixed: number;
  perUnit: number;
}

/** Rates from the home region to `to` (story 66): Port-Libre and auction perks included. */
export function routeRates(
  from: RegionId,
  to: RegionId,
  shippingFactor: number,
  delays: readonly TransportDelay[] = [],
): RouteRate[] {
  const factor = shippingCostFactor[from] * shippingFactor;
  return transportOptions.map((option) => ({
    option,
    days: shippingDays(option, from, to) + routeDelayDays(delays, from, to),
    fixed: deliveryRules.baseCost * factor,
    perUnit: deliveryRules.options[option].costPerUnitPerDay * travelDays(from, to) * factor,
  }));
}

/** Extra days an event added to a shipment on the road (R12), compared with its normal trip. */
export function eventDelayDays(
  shipment: Pick<Shipment, "option" | "destination" | "departedDay" | "arrivesOnDay">,
  from: RegionId,
): number {
  if (shipment.departedDay === null || shipment.arrivesOnDay === null) return 0;
  const normal = shippingDays(shipment.option, from, shipment.destination);
  return Math.max(0, shipment.arrivesOnDay - shipment.departedDay - normal);
}

/** Share of the trip done, from 0 to 1; `now` counts days with their fraction. */
export function tripProgress(
  shipment: Pick<Shipment, "departedDay" | "arrivesOnDay">,
  now: number,
): number {
  if (shipment.departedDay === null || shipment.arrivesOnDay === null) return 0;
  const total = shipment.arrivesOnDay - shipment.departedDay;
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, (now - shipment.departedDay) / total));
}

/** Engine ids end with a counter allocated in creation order ("s-12"): the queue order (R8). */
export function byCreation(a: { id: string }, b: { id: string }): number {
  return idCounter(a.id) - idCounter(b.id) || a.id.localeCompare(b.id);
}

function idCounter(id: string): number {
  const value = Number(id.slice(id.lastIndexOf("-") + 1));
  return Number.isFinite(value) ? value : 0;
}

/** "aujourd'hui", "demain", "dans 3 j", "hier", "il y a 2 j". */
export function relativeDay(target: number, today: number): string {
  const diff = target - today;
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return "demain";
  if (diff === -1) return "hier";
  return diff > 0 ? `dans ${diff} j` : `il y a ${-diff} j`;
}

/** "Standard (route)" → "Standard": the option's short name for buttons and badges. */
export function optionShortName(option: TransportOption): string {
  const name = deliveryRules.options[option].name;
  const cut = name.indexOf(" (");
  return cut > 0 ? name.slice(0, cut) : name;
}

/** "Standard (route)" → "route": how the goods travel, when the name says it. */
export function optionMode(option: TransportOption): string | null {
  const match = /\(([^)]+)\)/.exec(deliveryRules.options[option].name);
  return match?.[1] ?? null;
}

export interface OrderToShip {
  order: CustomerOrder;
  quotes: ShippingQuote[];
  outlook: OrderOutlook;
}

export interface QueuedShipment {
  shipment: Shipment;
  /** Position in the preparation queue, from 1. */
  position: number;
  departureDay: number | null;
  arrivalDay: number | null;
  deadlineDay: number | null;
  onTime: boolean | null;
}

export interface ShipmentOnTheRoad {
  shipment: Shipment;
  deadlineDay: number | null;
  onTime: boolean | null;
  /** Extra travel days caused by events. */
  eventDelay: number;
  /** Expected payment on delivery; null when the order is unknown. */
  revenue: number | null;
  /** Share of the trip done, from 0 to 1. */
  progress: number;
}

export interface DeliveryPlan {
  today: number;
  /** Shipments the logisticians can prepare today. */
  capacity: number;
  preparedToday: number;
  /** Day a shipment requested now should leave; null when nobody can prepare it. */
  nextDeparture: number | null;
  /** Accepted orders waiting to be shipped, most urgent first. */
  toShip: OrderToShip[];
  /** Preparation queue, in the order the logisticians handle it. */
  queue: QueuedShipment[];
  /** Shipments on their way, earliest arrival first. */
  onTheRoad: ShipmentOnTheRoad[];
  /** Orders still waiting for acceptance in the sales inbox. */
  pendingOrders: number;
  /** Queued shipments that will not leave at the next preparation. */
  backlog: number;
  /** First day a logistician hired but not yet at work arrives, if any. */
  logisticiansArriveOn: number | null;
  logisticiansAtWork: number;
}

/** Everything the Livraisons page shows, computed from the live team view. */
export function deliveryPlan(view: TeamView, from: RegionId): DeliveryPlan {
  const { team, clock } = view;
  const today = clock.time.day;
  const slots: PreparationSlots = {
    day: today,
    step: clock.time.step,
    stepsPerDay: clock.stepsPerDay,
    preparedToday: team.preparedToday,
    capacityOn: (day) => logisticsCapacity(team, day),
  };
  const shipments = Object.values(team.shipments).sort(byCreation);
  const queued = shipments.filter((shipment) => shipment.status === "queued");
  const departures = departureDays(slots, queued.length + 1);
  const firstDay = firstPreparationDay(slots);

  const queue = queued.map((shipment, index): QueuedShipment => {
    const departureDay = departures[index] ?? null;
    const arrivalDay =
      departureDay === null
        ? null
        : departureDay +
          shipment.travelDays +
          routeDelayDays(view.market.transportDelays, from, shipment.destination);
    const deadlineDay = team.orders[shipment.orderId]?.deadlineDay ?? null;
    return {
      shipment,
      position: index + 1,
      departureDay,
      arrivalDay,
      deadlineDay,
      onTime: arrivalDay === null || deadlineDay === null ? null : arrivalDay <= deadlineDay,
    };
  });

  const now = today + clock.time.step / clock.stepsPerDay;
  const onTheRoad = shipments
    .filter((shipment) => shipment.status === "in-transit")
    .map((shipment): ShipmentOnTheRoad => {
      const order = team.orders[shipment.orderId];
      const onTime =
        order && shipment.arrivesOnDay !== null ? shipment.arrivesOnDay <= order.deadlineDay : null;
      return {
        shipment,
        deadlineDay: order?.deadlineDay ?? null,
        onTime,
        eventDelay: eventDelayDays(shipment, from),
        revenue: order ? deliveryRevenue(order, onTime !== false) : null,
        progress: tripProgress(shipment, now),
      };
    })
    .sort(
      (a, b) =>
        (a.shipment.arrivesOnDay ?? 0) - (b.shipment.arrivesOnDay ?? 0) ||
        byCreation(a.shipment, b.shipment),
    );

  const nextDeparture = departures[queued.length] ?? null;
  const orders = Object.values(team.orders);
  const toShip = orders
    .filter((order) => order.status === "accepted")
    .sort((a, b) => a.deadlineDay - b.deadlineDay || byCreation(a, b))
    .map((order): OrderToShip => {
      const quotes = shippingQuotes(
        order,
        from,
        team.perks.shippingFactor,
        nextDeparture,
        view.market.transportDelays,
      );
      return { order, quotes, outlook: orderOutlook(order, quotes, today) };
    });

  const logisticians = Object.values(team.employees).filter(
    (employee) => employee.job === "logistician",
  );
  const arrivals = logisticians
    .filter((employee) => employee.arrivesOnDay > today)
    .map((employee) => employee.arrivesOnDay);

  return {
    today,
    capacity: view.logisticsCapacity,
    preparedToday: team.preparedToday,
    nextDeparture,
    toShip,
    queue,
    onTheRoad,
    pendingOrders: orders.filter((order) => order.status === "pending").length,
    backlog: queue.filter((entry) => entry.departureDay === null || entry.departureDay > firstDay)
      .length,
    logisticiansArriveOn: arrivals.length > 0 ? Math.min(...arrivals) : null,
    logisticiansAtWork: logisticians.length - arrivals.length,
  };
}

/** Each active regional delay affects routes that touch the region once. */
export function routeDelayDays(
  delays: readonly TransportDelay[],
  from: RegionId,
  to: RegionId,
): number {
  return delays.reduce(
    (sum, delay) => sum + (delay.region === from || delay.region === to ? delay.extraDays : 0),
    0,
  );
}
