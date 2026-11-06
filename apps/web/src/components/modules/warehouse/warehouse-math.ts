import {
  equipmentSupplierById,
  type ItemId,
  type MaterialId,
  materialSupplierById,
  materials,
  type ProductId,
  products,
} from "@etic/content";
import {
  availableStock,
  type CompanySummary,
  type InboundShipment,
  type TeamState,
} from "@etic/engine";
import { formatNumber } from "@/lib/format";

export type FillLevel = "ok" | "high" | "full";

/** From this share of the capacity on, the warehouse is about to saturate (story 32). */
export const HIGH_FILL_RATIO = 0.85;

export function fillLevel(used: number, capacity: number): FillLevel {
  if (capacity <= 0 || used >= capacity) return "full";
  return used / capacity >= HIGH_FILL_RATIO ? "high" : "ok";
}

export function freeUnits(used: number, capacity: number): number {
  return Math.max(0, capacity - used);
}

/** "1 unité", "0 unité libre", "1 200 unités libres" (French singular below 2). */
export function unitsLabel(count: number, adjective?: string): string {
  const plural = Math.abs(count) >= 2;
  const label = `${formatNumber(count)} ${plural ? "unités" : "unité"}`;
  return adjective ? `${label} ${adjective}${plural ? "s" : ""}` : label;
}

export interface RoomAtArrival {
  /** Space left when the order arrives, if nothing leaves the warehouse meanwhile. */
  room: number;
  /** Free space today. */
  free: number;
  /** Goods already on their way, which will take their place first. */
  incoming: number;
  /** Capacity added by an extension finished by the arrival day. */
  extension: number;
}

/** Space for a new order on its arrival day: free today − goods on their way + extension. */
export function roomAtArrival({
  team,
  used,
  arrivalDay,
}: {
  team: TeamState;
  used: number;
  arrivalDay: number | null;
}): RoomAtArrival {
  const expansion = team.warehouse.expansion;
  const extension =
    expansion && arrivalDay !== null && expansion.completesOnDay <= arrivalDay
      ? expansion.amount
      : 0;
  const free = freeUnits(used, team.warehouse.capacity);
  const { incoming } = inboundTotals(team);
  return { room: Math.max(0, free + extension - incoming), free, incoming, extension };
}

/** Units on their way to the warehouse, per item. Machines go to the workshop, not here. */
export function incomingByItem(team: TeamState): Partial<Record<ItemId, number>> {
  const incoming: Partial<Record<ItemId, number>> = {};
  for (const shipment of Object.values(team.inbound)) {
    if (shipment.kind !== "material") continue;
    incoming[shipment.item] = (incoming[shipment.item] ?? 0) + shipment.quantity;
  }
  return incoming;
}

export interface InboundTotals {
  /** Units still to enter the warehouse, waiting ones included. */
  incoming: number;
  /** Units already arrived but held back by a full warehouse (R9). */
  waiting: number;
  waitingShipments: number;
  machines: number;
}

export function inboundTotals(team: TeamState): InboundTotals {
  const totals: InboundTotals = { incoming: 0, waiting: 0, waitingShipments: 0, machines: 0 };
  for (const shipment of Object.values(team.inbound)) {
    if (shipment.kind === "machine") {
      totals.machines += 1;
      continue;
    }
    totals.incoming += shipment.quantity;
    if (shipment.status === "waiting-space") {
      totals.waiting += shipment.quantity;
      totals.waitingShipments += 1;
    }
  }
  return totals;
}

/** Stock split between raw materials and finished products. */
export function stockTotals(team: TeamState): { materials: number; products: number } {
  let materialUnits = 0;
  for (const { id } of materials) materialUnits += team.inventory[id] ?? 0;
  let productUnits = 0;
  for (const { id } of products) productUnits += team.inventory[id] ?? 0;
  return { materials: materialUnits, products: productUnits };
}

export interface MaterialLine {
  id: MaterialId;
  quantity: number;
  incoming: number;
}

/** Raw materials in stock or on their way, in catalog order. */
export function materialLines(team: TeamState): MaterialLine[] {
  const incoming = incomingByItem(team);
  return materials
    .map(({ id }) => ({ id, quantity: team.inventory[id] ?? 0, incoming: incoming[id] ?? 0 }))
    .filter((line) => line.quantity > 0 || line.incoming > 0);
}

export interface ProductLine {
  id: ProductId;
  quantity: number;
  /** Held for accepted customer orders (O2). */
  reserved: number;
  /** Free for new orders. */
  available: number;
  incoming: number;
}

/** Finished products in stock, reserved or on their way (trades), in catalog order. */
export function productLines(team: TeamState): ProductLine[] {
  const incoming = incomingByItem(team);
  return products
    .map(({ id }) => ({
      id,
      quantity: team.inventory[id] ?? 0,
      reserved: team.reserved[id] ?? 0,
      available: Math.max(0, availableStock(team, id)),
      incoming: incoming[id] ?? 0,
    }))
    .filter((line) => line.quantity > 0 || line.reserved > 0 || line.incoming > 0);
}

/** Shipments held back by a full warehouse first, then by arrival day. */
export function sortShipments(shipments: Iterable<InboundShipment>): InboundShipment[] {
  return [...shipments].sort((a, b) => {
    const waiting = Number(b.status === "waiting-space") - Number(a.status === "waiting-space");
    return waiting || a.arrivesOnDay - b.arrivesOnDay || a.id.localeCompare(b.id);
  });
}

/** Who sends a shipment: a supplier, the black market, another company or a secret. */
export function shipmentOrigin(
  supplierId: string,
  competitors: Record<string, CompanySummary>,
): string {
  if (supplierId === "black-market") return "Marché noir";
  if (supplierId === "secret") return "Fournisseur secret";
  if (supplierId.startsWith("trade:")) {
    const company = competitors[supplierId.slice("trade:".length)];
    return `Échange avec ${company ? (company.companyName ?? company.name) : "une entreprise"}`;
  }
  return (
    materialSupplierById.get(supplierId)?.name ??
    equipmentSupplierById.get(supplierId)?.name ??
    supplierId
  );
}

/** "aujourd'hui", "demain", "dans 3 j", "il y a 2 j". */
export function relativeDay(day: number, today: number): string {
  const delta = day - today;
  if (delta === 0) return "aujourd'hui";
  if (delta === 1) return "demain";
  if (delta > 1) return `dans ${delta} j`;
  if (delta === -1) return "hier";
  return `il y a ${-delta} j`;
}

/** Share of the construction already done, from 0 to 1. */
export function expansionProgress(
  completesOnDay: number,
  durationDays: number,
  time: { day: number; step: number },
  stepsPerDay: number,
): number {
  if (durationDays <= 0) return 1;
  const elapsed = time.day + time.step / stepsPerDay - (completesOnDay - durationDays);
  return Math.min(1, Math.max(0, elapsed / durationDays));
}
