import { describe, expect, test } from "bun:test";
import { companySummary, gameEngine, type InboundShipment, type TeamState } from "@etic/engine";
import {
  expansionProgress,
  fillLevel,
  freeUnits,
  inboundTotals,
  incomingByItem,
  materialLines,
  productLines,
  relativeDay,
  roomAtArrival,
  shipmentOrigin,
  sortShipments,
  stockTotals,
  unitsLabel,
} from "./warehouse-math.ts";

function newTeams() {
  const state = gameEngine.createGame({
    id: "g-warehouse",
    seed: "warehouse",
    config: { stepsPerDay: 4, countdownDays: 30 },
    teams: [
      { id: "t1", name: "Équipe 1" },
      { id: "t2", name: "Équipe 2" },
    ],
  });
  const [first, second] = [state.teams.t1, state.teams.t2];
  if (!first || !second) throw new Error("missing team");
  return { team: first, other: second };
}

function material(
  id: string,
  item: "flour" | "water" | "bread",
  quantity: number,
  arrivesOnDay: number,
  status: InboundShipment["status"] = "in-transit",
): InboundShipment {
  return {
    id,
    kind: "material",
    supplierId: "moulins-azura",
    item,
    quantity,
    arrivesOnDay,
    status,
  };
}

function stocked(): TeamState {
  const { team } = newTeams();
  team.inventory = { flour: 100, water: 0, bread: 50, soap: 0 };
  team.reserved = { bread: 20 };
  team.inbound = {
    a: material("a", "water", 200, 12),
    b: material("b", "flour", 80, 9, "waiting-space"),
    c: {
      id: "c",
      kind: "machine",
      supplierId: "ferro-machines",
      machineTypeId: "oven",
      arrivesOnDay: 11,
      status: "in-transit",
    },
  };
  return team;
}

describe("capacity", () => {
  test("fill levels warn before saturation", () => {
    expect(fillLevel(0, 1_500)).toBe("ok");
    expect(fillLevel(1_200, 1_500)).toBe("ok");
    expect(fillLevel(1_300, 1_500)).toBe("high");
    expect(fillLevel(1_500, 1_500)).toBe("full");
    expect(fillLevel(1_600, 1_500)).toBe("full");
    expect(fillLevel(0, 0)).toBe("full");
    expect(freeUnits(1_600, 1_500)).toBe(0);
    expect(freeUnits(400, 1_500)).toBe(1_100);
  });

  test("stock is split between materials and products", () => {
    expect(stockTotals(stocked())).toEqual({ materials: 100, products: 50 });
  });

  test("units take the French singular below two", () => {
    const clean = (text: string) => text.replace(/\s/g, " ");
    expect(unitsLabel(0)).toBe("0 unité");
    expect(unitsLabel(1)).toBe("1 unité");
    expect(clean(unitsLabel(1_200))).toBe("1 200 unités");
    expect(unitsLabel(1, "libre")).toBe("1 unité libre");
    expect(unitsLabel(30, "libre")).toBe("30 unités libres");
  });

  test("room at arrival counts goods on their way and a finished extension", () => {
    const team = stocked();
    team.warehouse = { capacity: 1_500, expansion: null };
    // 1 500 − 150 in stock − 280 on their way.
    expect(roomAtArrival({ team, used: 150, arrivalDay: 12 })).toEqual({
      room: 1_070,
      free: 1_350,
      incoming: 280,
      extension: 0,
    });
    team.warehouse.expansion = { completesOnDay: 14, amount: 1_000 };
    expect(roomAtArrival({ team, used: 150, arrivalDay: 12 }).room).toBe(1_070);
    expect(roomAtArrival({ team, used: 150, arrivalDay: 14 })).toEqual({
      room: 2_070,
      free: 1_350,
      incoming: 280,
      extension: 1_000,
    });
    expect(roomAtArrival({ team, used: 1_400, arrivalDay: null }).room).toBe(0);
  });
});

describe("inbound shipments", () => {
  test("only goods count toward the warehouse; machines go to the workshop", () => {
    const team = stocked();
    expect(incomingByItem(team)).toEqual({ water: 200, flour: 80 });
    expect(inboundTotals(team)).toEqual({
      incoming: 280,
      waiting: 80,
      waitingShipments: 1,
      machines: 1,
    });
  });

  test("shipments waiting for space come first, then by arrival day", () => {
    const sorted = sortShipments(Object.values(stocked().inbound));
    expect(sorted.map((shipment) => shipment.id)).toEqual(["b", "c", "a"]);
  });

  test("origins name suppliers, trades, the black market and secrets", () => {
    const { team, other } = newTeams();
    other.companyName = "Société 2";
    const competitors = { [other.id]: companySummary(other) };
    expect(shipmentOrigin("moulins-azura", competitors)).toBe("Moulins d'Azura");
    expect(shipmentOrigin("nordic-equipment", competitors)).toBe("Nordic Equipment");
    expect(shipmentOrigin("black-market", competitors)).toBe("Marché noir");
    expect(shipmentOrigin("secret", competitors)).toBe("Fournisseur secret");
    expect(shipmentOrigin(`trade:${other.id}`, competitors)).toBe("Échange avec Société 2");
    expect(shipmentOrigin(`trade:${team.id}`, competitors)).toBe("Échange avec une entreprise");
    expect(shipmentOrigin("unknown", competitors)).toBe("unknown");
  });
});

describe("inventory lines", () => {
  test("materials in stock or on their way, in catalog order", () => {
    expect(materialLines(stocked())).toEqual([
      { id: "flour", quantity: 100, incoming: 80 },
      { id: "water", quantity: 0, incoming: 200 },
    ]);
  });

  test("products show what accepted orders reserve", () => {
    expect(productLines(stocked())).toEqual([
      { id: "bread", quantity: 50, reserved: 20, available: 30, incoming: 0 },
    ]);
  });
});

describe("time", () => {
  test("relative days", () => {
    expect(relativeDay(12, 12)).toBe("aujourd'hui");
    expect(relativeDay(13, 12)).toBe("demain");
    expect(relativeDay(15, 12)).toBe("dans 3 j");
    expect(relativeDay(11, 12)).toBe("hier");
    expect(relativeDay(9, 12)).toBe("il y a 3 j");
  });

  test("expansion progress goes from 0 to 1 over the construction days", () => {
    expect(expansionProgress(15, 5, { day: 10, step: 0 }, 4)).toBe(0);
    expect(expansionProgress(15, 5, { day: 12, step: 2 }, 4)).toBeCloseTo(0.5, 5);
    expect(expansionProgress(15, 5, { day: 16, step: 0 }, 4)).toBe(1);
    expect(expansionProgress(15, 0, { day: 10, step: 0 }, 4)).toBe(1);
  });
});
