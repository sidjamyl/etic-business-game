import {
  equipmentSupplierById,
  equipmentSuppliers,
  itemName,
  machineTypeById,
  materialSupplierById,
  materialSuppliers,
  purchasableMachineTypes,
  purchasePriceFactor,
  type RegionId,
  travelDays,
  warehouseRules,
} from "@etic/content";
import { z } from "zod";
import { defineCommand } from "../commands.ts";
import { refuse } from "../errors.ts";
import { allocateId, logTeam } from "../log.ts";
import type { GameSystem } from "../systems.ts";
import type { GameState, TeamState } from "../types.ts";
import { recordPurchase } from "./impact.ts";
import { supplierConditions } from "./scenario.ts";
import {
  actingTeam,
  addItem,
  credits,
  describeQuantity,
  freeSpace,
  newMachine,
  spend,
} from "./shared.ts";

function homeRegion(team: TeamState): RegionId {
  if (!team.region) refuse("INVALID_STATE", "Choisissez d'abord une région.");
  return team.region;
}

/** Unit price paid by a team buying from a material supplier right now. */
export function materialUnitPrice(state: GameState, supplierId: string, region: RegionId): number {
  const supplier = materialSupplierById.get(supplierId);
  const market = state.market.suppliers[supplierId];
  if (!supplier || !market) return Number.NaN;
  return supplier.price * market.priceFactor * purchasePriceFactor[region];
}

export function machinePrice(
  state: GameState,
  supplierId: string,
  machineTypeId: string,
  region: RegionId,
): number {
  const supplier = equipmentSupplierById.get(supplierId);
  const type = machineTypeById.get(machineTypeId);
  const market = state.market.equipment[supplierId];
  if (!supplier || !type || !market) return Number.NaN;
  return Math.round(
    type.price * supplier.priceFactor * market.priceFactor * purchasePriceFactor[region],
  );
}

/** Simulated days between an order and its arrival (R4). */
export function deliveryDays(handlingDays: number, from: RegionId, to: RegionId): number {
  return handlingDays + travelDays(from, to);
}

export const purchasingCommands = [
  defineCommand({
    type: "purchase.buyMaterial",
    actor: "team",
    schema: z.object({
      supplierId: z.string().min(1),
      quantity: z
        .int("La quantité doit être un nombre entier.")
        .positive("La quantité doit être positive.")
        .max(100_000),
    }),
    apply: (draft, { supplierId, quantity }, actor) => {
      const team = actingTeam(draft, actor);
      const region = homeRegion(team);
      const supplier = materialSupplierById.get(supplierId);
      const market = draft.market.suppliers[supplierId];
      if (!supplier || !market) refuse("NOT_FOUND", "Fournisseur introuvable.");
      const priority = draft.market.supplierPriority[supplierId];
      if (priority && priority.day === draft.time.day && priority.teamId !== team.id) {
        refuse(
          "OUT_OF_STOCK",
          `${supplier.name} réserve aujourd'hui son stock à un client prioritaire.`,
        );
      }
      if (market.stock < quantity) {
        refuse(
          "OUT_OF_STOCK",
          market.stock === 0
            ? `${supplier.name} est en rupture de stock.`
            : `Stock insuffisant chez ${supplier.name} : il reste ${market.stock}.`,
        );
      }
      const cost = Math.round(materialUnitPrice(draft, supplierId, region) * quantity);
      spend(
        draft,
        team,
        cost,
        "purchases",
        `${describeQuantity(supplier.material, quantity)} chez ${supplier.name}`,
      );
      // Paid and reserved immediately, no cancellation (R4).
      market.stock -= quantity;
      recordPurchase(team, quantity, supplier.ethics);
      const id = `in-${allocateId(draft)}`;
      const arrivesOnDay =
        draft.time.day + deliveryDays(supplier.handlingDays, supplier.region, region);
      team.inbound[id] = {
        id,
        kind: "material",
        supplierId,
        item: supplier.material,
        quantity,
        arrivesOnDay,
        status: "in-transit",
      };
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `Achat de ${describeQuantity(supplier.material, quantity)} chez ${supplier.name} pour ${credits(cost)}, livraison jour ${arrivesOnDay}.`,
      });
    },
  }),

  defineCommand({
    type: "purchase.buyMachine",
    actor: "team",
    schema: z.object({ supplierId: z.string().min(1), machineTypeId: z.string().min(1) }),
    apply: (draft, { supplierId, machineTypeId }, actor) => {
      const team = actingTeam(draft, actor);
      const region = homeRegion(team);
      const supplier = equipmentSupplierById.get(supplierId);
      const market = draft.market.equipment[supplierId];
      const type = machineTypeById.get(machineTypeId);
      if (!supplier || !market || !type) refuse("NOT_FOUND", "Machine introuvable.");
      if ((market.stock[machineTypeId] ?? 0) < 1) {
        refuse("OUT_OF_STOCK", `${supplier.name} n'a plus de ${type.name} en stock.`);
      }
      const cost = machinePrice(draft, supplierId, machineTypeId, region);
      spend(draft, team, cost, "machines", `${type.name} chez ${supplier.name}`);
      market.stock[machineTypeId] = (market.stock[machineTypeId] ?? 0) - 1;
      const id = `in-${allocateId(draft)}`;
      const arrivesOnDay =
        draft.time.day + deliveryDays(supplier.handlingDays, supplier.region, region);
      team.inbound[id] = {
        id,
        kind: "machine",
        supplierId,
        machineTypeId,
        arrivesOnDay,
        status: "in-transit",
      };
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `Achat d'une machine « ${type.name} » chez ${supplier.name} pour ${credits(cost)}, livraison jour ${arrivesOnDay}.`,
      });
    },
  }),

  defineCommand({
    type: "warehouse.expand",
    actor: "team",
    schema: z.object({}).optional(),
    apply: (draft, _payload, actor) => {
      const team = actingTeam(draft, actor);
      if (team.warehouse.expansion) {
        refuse("ALREADY_IN_PROGRESS", "Une extension de l'entrepôt est déjà en cours.");
      }
      spend(draft, team, warehouseRules.expansionCost, "warehouse", "Extension de l'entrepôt");
      const completesOnDay = draft.time.day + warehouseRules.expansionDays;
      team.warehouse.expansion = { completesOnDay, amount: warehouseRules.expansionCapacity };
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `Extension de l'entrepôt (+${warehouseRules.expansionCapacity} unités) pour ${credits(warehouseRules.expansionCost)}, prête jour ${completesOnDay}.`,
      });
    },
  }),
];

function receiveShipments(draft: GameState, team: TeamState): void {
  for (const shipment of Object.values(team.inbound)) {
    if (shipment.arrivesOnDay > draft.time.day) continue;
    if (shipment.kind === "machine") {
      const id = `m-${allocateId(draft)}`;
      team.machines[id] = newMachine(id, shipment.machineTypeId);
      delete team.inbound[shipment.id];
      const name = machineTypeById.get(shipment.machineTypeId)?.name ?? "machine";
      logTeam(draft, team.id, { kind: "system", message: `Machine « ${name} » livrée.` });
      continue;
    }
    // Arrivals wait without loss when the warehouse is full (R9).
    if (freeSpace(team) < shipment.quantity) {
      if (shipment.status !== "waiting-space") {
        shipment.status = "waiting-space";
        logTeam(draft, team.id, {
          kind: "system",
          message: `Entrepôt plein : ${describeQuantity(shipment.item, shipment.quantity)} attend de la place.`,
        });
      }
      continue;
    }
    addItem(team, shipment.item, shipment.quantity);
    delete team.inbound[shipment.id];
    logTeam(draft, team.id, {
      kind: "system",
      message: `Livraison reçue : ${shipment.quantity.toLocaleString("fr-FR")} × ${itemName(shipment.item)}.`,
    });
  }
}

function completeExpansion(draft: GameState, team: TeamState): void {
  const expansion = team.warehouse.expansion;
  if (!expansion || expansion.completesOnDay > draft.time.day) return;
  team.warehouse.capacity += expansion.amount;
  team.warehouse.expansion = null;
  logTeam(draft, team.id, {
    kind: "system",
    message: `Extension terminée : l'entrepôt contient désormais ${team.warehouse.capacity} unités.`,
  });
}

export const purchasingSystem: GameSystem = {
  name: "purchasing",
  onCreate: (draft) => {
    for (const supplier of materialSuppliers) {
      draft.market.suppliers[supplier.id] = {
        stock: supplier.restock.level,
        nextRestockDay: 1 + supplier.restock.everyDays,
        priceFactor: 1,
      };
    }
    for (const supplier of equipmentSuppliers) {
      const stock: Record<string, number> = {};
      for (const type of purchasableMachineTypes) stock[type.id] = supplier.restock.unitsPerType;
      draft.market.equipment[supplier.id] = {
        stock,
        nextRestockDay: 1 + supplier.restock.everyDays,
        priceFactor: 1,
      };
    }
  },
  onDay: (draft) => {
    // Fixed-date restocking up to the defined level (R4).
    for (const supplier of materialSuppliers) {
      const market = draft.market.suppliers[supplier.id];
      if (!market || draft.time.day < market.nextRestockDay) continue;
      market.nextRestockDay += supplier.restock.everyDays;
      // Events can block restocking (outage) or cut the restock level (R12).
      const { stockFactor, outage } = supplierConditions(draft, supplier.id);
      if (outage) continue;
      market.stock = Math.max(market.stock, Math.floor(supplier.restock.level * stockFactor));
    }
    for (const supplier of equipmentSuppliers) {
      const market = draft.market.equipment[supplier.id];
      if (!market || draft.time.day < market.nextRestockDay) continue;
      for (const type of purchasableMachineTypes) {
        market.stock[type.id] = Math.max(market.stock[type.id] ?? 0, supplier.restock.unitsPerType);
      }
      market.nextRestockDay += supplier.restock.everyDays;
    }
  },
  onStep: (draft) => {
    for (const team of Object.values(draft.teams)) {
      completeExpansion(draft, team);
      receiveShipments(draft, team);
    }
  },
};
