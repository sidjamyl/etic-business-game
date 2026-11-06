import { describe, expect, test } from "bun:test";
import { regionIds, transportOptions } from "@etic/content";
import {
  type CustomerOrder,
  type Employee,
  type Shipment,
  shippingCost,
  type TeamView,
} from "@etic/engine";
import {
  byCreation,
  cancellationDay,
  deliveryPlan,
  deliveryRevenue,
  departureDays,
  eventDelayDays,
  firstPreparationDay,
  optionMode,
  optionShortName,
  orderOutlook,
  type PreparationSlots,
  relativeDay,
  routeRates,
  shippingQuotes,
  tripProgress,
} from "./logistics.ts";

const slots = (overrides: Partial<PreparationSlots> = {}): PreparationSlots => ({
  day: 10,
  step: 1,
  stepsPerDay: 4,
  preparedToday: 0,
  capacityOn: () => 5,
  ...overrides,
});

// Ferronia → Azura: 2 travel days (standard 2, express 1, green 3).
const order = (overrides: Partial<CustomerOrder> = {}): CustomerOrder => ({
  id: "o-1",
  productId: "bread",
  region: "azura",
  quantity: 40,
  unitPrice: 31,
  createdDay: 8,
  expiresOnDay: 10,
  deadlineDay: 12,
  status: "accepted",
  ...overrides,
});

describe("departure estimates", () => {
  test("the rest of today's quota goes first, then full days", () => {
    expect(departureDays(slots({ preparedToday: 3 }), 4)).toEqual([10, 10, 11, 11]);
  });

  test("after the evening sub-step, the next preparation is tomorrow's", () => {
    const evening = slots({ step: 3, preparedToday: 5 });
    expect(firstPreparationDay(evening)).toBe(11);
    expect(departureDays(evening, 2)).toEqual([11, 11]);
  });

  test("logisticians still on their way delay the departure", () => {
    const hiring = slots({ capacityOn: (day) => (day >= 12 ? 5 : 0) });
    expect(departureDays(hiring, 1)).toEqual([12]);
  });

  test("without any capacity, nothing leaves", () => {
    expect(departureDays(slots({ capacityOn: () => 0 }), 2)).toEqual([null, null]);
  });
});

describe("shipping quotes", () => {
  test("cost, travel time and arrival per option, like the engine", () => {
    const quotes = shippingQuotes(order(), "ferronia", 1, 10);
    expect(quotes.map((q) => [q.option, q.cost, q.travelDays, q.arrivalDay, q.onTime])).toEqual([
      ["standard", 52, 2, 12, true],
      ["express", 116, 1, 11, true],
      ["green", 68, 3, 13, false],
    ]);
  });

  test("a late delivery is paid 20 % less", () => {
    const [, , green] = shippingQuotes(order(), "ferronia", 1, 10);
    expect(green?.revenue).toBe(992);
    expect(deliveryRevenue(order(), true)).toBe(1_240);
  });

  test("Port-Libre's discount and the auction perk lower the cost", () => {
    const [standard] = shippingQuotes(order(), "port-libre", 0.9, 10);
    // (20 + 0.4 × 40 × 3) × 0.7 = 47.6 → 48, then × 0.9 = 43.2 → 43.
    expect(standard?.cost).toBe(43);
  });

  test("the arrival is unknown while nobody can prepare the shipment", () => {
    const quotes = shippingQuotes(order(), "ferronia", 1, null);
    expect(quotes.every((q) => q.arrivalDay === null && q.onTime === null)).toBe(true);
    expect(quotes[0]?.revenue).toBe(1_240);
  });
});

describe("route rates", () => {
  test("a flat fee plus a price per unit, like the engine's shipping cost", () => {
    for (const from of regionIds) {
      for (const to of regionIds) {
        for (const rate of routeRates(from, to, 1)) {
          expect(Math.round(rate.fixed + rate.perUnit * 37)).toBe(
            shippingCost(rate.option, 37, from, to),
          );
        }
      }
    }
    expect(routeRates("ferronia", "azura", 1).map((rate) => rate.option)).toEqual([
      ...transportOptions,
    ]);
  });

  test("Ferronia to Nordhaven, standard: 2 days, ₢20 + ₢0.80 per unit", () => {
    const [standard] = routeRates("ferronia", "nordhaven", 1);
    expect(standard).toEqual({ option: "standard", days: 2, fixed: 20, perUnit: 0.8 });
  });

  test("Port-Libre's discount and the auction perk apply to both parts", () => {
    const [standard] = routeRates("port-libre", "azura", 0.9);
    expect(standard?.fixed).toBeCloseTo(20 * 0.7 * 0.9);
    expect(standard?.perUnit).toBeCloseTo(0.4 * 3 * 0.7 * 0.9);
  });
});

describe("order outlook", () => {
  test("on time when the standard option makes it", () => {
    const quotes = shippingQuotes(order(), "ferronia", 1, 10);
    expect(orderOutlook(order(), quotes, 10)).toEqual({ kind: "on-time" });
  });

  test("only express is left when the deadline is close", () => {
    const quotes = shippingQuotes(order(), "ferronia", 1, 11);
    expect(orderOutlook(order(), quotes, 11)).toEqual({
      kind: "faster-only",
      options: ["express"],
    });
  });

  test("late whatever the option, by the fastest arrival", () => {
    const quotes = shippingQuotes(order(), "ferronia", 1, 12);
    expect(orderOutlook(order(), quotes, 12)).toEqual({ kind: "late", daysLate: 1 });
  });

  test("past the deadline, the order is cancelled five days later unless shipped", () => {
    const quotes = shippingQuotes(order(), "ferronia", 1, 13);
    expect(orderOutlook(order(), quotes, 13)).toEqual({ kind: "overdue", cancelDay: 18 });
    expect(cancellationDay(order())).toBe(18);
  });

  test("stuck when no logistician can prepare it", () => {
    const quotes = shippingQuotes(order(), "ferronia", 1, null);
    expect(orderOutlook(order(), quotes, 10)).toEqual({ kind: "stuck" });
  });
});

describe("shipments on the road", () => {
  const shipment = {
    option: "standard",
    destination: "azura",
    departedDay: 10,
    arrivesOnDay: 15,
  } as const;

  test("event delays are the days beyond the normal trip", () => {
    expect(eventDelayDays(shipment, "ferronia")).toBe(3);
    expect(eventDelayDays({ ...shipment, arrivesOnDay: 12 }, "ferronia")).toBe(0);
  });

  test("trip progress", () => {
    expect(tripProgress({ departedDay: 10, arrivesOnDay: 12 }, 11)).toBe(0.5);
    expect(tripProgress({ departedDay: 10, arrivesOnDay: 12 }, 14)).toBe(1);
    expect(tripProgress({ departedDay: null, arrivesOnDay: null }, 14)).toBe(0);
  });
});

describe("labels", () => {
  test("relative days", () => {
    expect(relativeDay(10, 10)).toBe("aujourd'hui");
    expect(relativeDay(11, 10)).toBe("demain");
    expect(relativeDay(13, 10)).toBe("dans 3 j");
    expect(relativeDay(9, 10)).toBe("hier");
    expect(relativeDay(7, 10)).toBe("il y a 3 j");
  });

  test("option names", () => {
    expect(optionShortName("green")).toBe("Verte");
    expect(optionMode("express")).toBe("avion");
  });

  test("engine ids sort in creation order", () => {
    const ids = ["s-12", "s-3", "s-100"].map((id) => ({ id })).sort(byCreation);
    expect(ids.map((s) => s.id)).toEqual(["s-3", "s-12", "s-100"]);
  });
});

describe("delivery plan", () => {
  const logistician = (id: string, arrivesOnDay: number): Employee => ({
    id,
    job: "logistician",
    wage: 1_760,
    efficiency: 1,
    hiredOnDay: 1,
    arrivesOnDay,
    lastRaiseDay: 1,
    machineId: null,
  });
  const queued = (id: string, orderId: string): Shipment => ({
    id,
    orderId,
    productId: "bread",
    destination: "azura",
    quantity: 40,
    option: "standard",
    cost: 52,
    status: "queued",
    travelDays: 2,
    departedDay: null,
    arrivesOnDay: null,
  });

  function view(): TeamView {
    const team = {
      region: "ferronia",
      perks: { outputFactor: 1, shippingFactor: 1 },
      hr: { unpaidWages: 0 },
      preparedToday: 4,
      employees: { "e-1": logistician("e-1", 3), "e-2": logistician("e-2", 11) },
      orders: {
        "o-1": order({ id: "o-1", status: "shipping" }),
        "o-2": order({ id: "o-2", status: "shipping", deadlineDay: 11 }),
        "o-4": order({ id: "o-4", status: "shipping", region: "ferronia", deadlineDay: 9 }),
        "o-6": order({ id: "o-6", deadlineDay: 14 }),
        "o-7": order({ id: "o-7", deadlineDay: 13 }),
        "o-8": order({ id: "o-8", status: "pending" }),
      },
      shipments: {
        "s-5": queued("s-5", "o-2"),
        "s-3": queued("s-3", "o-1"),
        "s-4": {
          ...queued("s-4", "o-4"),
          destination: "ferronia",
          status: "in-transit",
          travelDays: 1,
          departedDay: 9,
          arrivesOnDay: 11,
        },
      },
    };
    return {
      clock: { time: { day: 10, step: 1 }, stepsPerDay: 4 },
      team,
      logisticsCapacity: 5,
      market: { transportDelays: [] },
    } as unknown as TeamView;
  }

  test("queue order, departures, arrivals and lateness", () => {
    const plan = deliveryPlan(view(), "ferronia");
    expect(
      plan.queue.map((q) => [q.shipment.id, q.position, q.departureDay, q.arrivalDay, q.onTime]),
    ).toEqual([
      ["s-3", 1, 10, 12, true],
      // One slot left today: the second shipment leaves tomorrow and misses its deadline.
      ["s-5", 2, 11, 13, false],
    ]);
    expect(plan.backlog).toBe(1);
    // A second logistician arrives on day 11: ten slots that day.
    expect(plan.nextDeparture).toBe(11);
    expect(plan.logisticiansArriveOn).toBe(11);
    expect(plan.logisticiansAtWork).toBe(1);
  });

  test("orders to ship are sorted by deadline, pending orders are counted", () => {
    const plan = deliveryPlan(view(), "ferronia");
    expect(plan.toShip.map((entry) => [entry.order.id, entry.outlook.kind])).toEqual([
      ["o-7", "on-time"],
      ["o-6", "on-time"],
    ]);
    expect(plan.pendingOrders).toBe(1);
  });

  test("shipments on the road carry their delay and expected payment", () => {
    const [road] = deliveryPlan(view(), "ferronia").onTheRoad;
    expect(road?.shipment.id).toBe("s-4");
    expect(road?.eventDelay).toBe(1);
    expect(road?.onTime).toBe(false);
    expect(road?.revenue).toBe(992);
    expect(road?.progress).toBeCloseTo(1.25 / 2);
  });
});

// Previews must match the regional events that the server applies at departure.
test("transport events delay new quotes and queued shipments without changing the fare", () => {
  const delays = [{ region: "azura" as const, extraDays: 3, untilDay: 20 }];
  const customer = order({ region: "azura" });
  const normal = shippingQuotes(customer, "ferronia", 1, 10);
  const delayed = shippingQuotes(customer, "ferronia", 1, 10, delays);
  for (const [index, quote] of delayed.entries()) {
    expect(quote.cost).toBe(normal[index]?.cost ?? -1);
    expect(quote.travelDays).toBe((normal[index]?.travelDays ?? -1) + 3);
    expect(quote.arrivalDay).toBe((normal[index]?.arrivalDay ?? -1) + 3);
  }
  expect(routeRates("azura", "azura", 1, delays)[0]?.days).toBe(4);
});
