import {
  type Branch,
  itemName,
  type MachineType,
  type MaterialId,
  machineTypeById,
  materialSupplierById,
  materials,
  type ProductId,
  productById,
  products,
  progressionRules,
  purchasableMachineTypes,
  purchasePriceFactor,
  type RegionId,
  regionById,
} from "@etic/content";
import {
  canProduce,
  type GameStatus,
  type MachineOffer,
  type SupplierOffer,
  type TeamState,
} from "@etic/engine";
import { unitsLabel } from "@/components/modules/warehouse/warehouse-math";
import { credits } from "@/lib/format";

/** Biggest quantity accepted by `purchase.buyMaterial` (engine schema). */
export const MAX_ORDER_QUANTITY = 100_000;

/** Why decisions are blocked (pause, end of game, O1), or null while the game runs. */
export function blockedReason(status: GameStatus): string | null {
  if (status === "paused") return "Jeu en pause : vous pourrez décider à la reprise.";
  if (status === "ended") return "Partie terminée : plus aucune décision possible.";
  if (status === "lobby") return "La partie n'a pas encore commencé.";
  return null;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Lower case without accents, so "electronique" finds "Électronique Port-Libre". */
export function normalizeSearch(text: string): string {
  // NFD splits "É" into "E" + a combining accent; \p{M} removes the accents.
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/** Whether a supplier matches the search box: its name, region or material. */
export function matchesSearch(offer: SupplierOffer, query: string): boolean {
  const needle = normalizeSearch(query);
  if (!needle) return true;
  const region = regionById.get(offer.region)?.name ?? "";
  const material = itemName(offer.material as MaterialId);
  return normalizeSearch(`${offer.name} ${region} ${material}`).includes(needle);
}

export type MaterialFilter = MaterialId | "all";

export interface MaterialGroup {
  material: MaterialId;
  offers: SupplierOffer[];
}

/** Offers grouped by material in catalog order, cheapest first, after the filter and search. */
export function groupOffers(
  offers: readonly SupplierOffer[],
  filter: MaterialFilter,
  query: string,
): MaterialGroup[] {
  const groups: MaterialGroup[] = [];
  for (const { id } of materials) {
    if (filter !== "all" && filter !== id) continue;
    const list = offers
      .filter((offer) => offer.material === id && matchesSearch(offer, query))
      .sort((a, b) => a.unitPrice - b.unitPrice || a.name.localeCompare(b.name, "fr"));
    if (list.length > 0) groups.push({ material: id, offers: list });
  }
  return groups;
}

/** Catalog price × the buyer's regional factor, before any event. */
function basePrice(offer: SupplierOffer, region: RegionId | null): number | null {
  const supplier = materialSupplierById.get(offer.id);
  if (!supplier) return null;
  return supplier.price * (region ? purchasePriceFactor[region] : 1);
}

/**
 * Unit price the engine charges. The view rounds it to the cent; when no event changes the
 * price, the exact value is the catalog price × the regional factor (e.g. ₢0.675 in Ferronia).
 */
export function exactUnitPrice(offer: SupplierOffer, region: RegionId | null): number {
  const base = basePrice(offer, region);
  return base !== null && round2(base) === offer.unitPrice ? base : offer.unitPrice;
}

/** Price change caused by running events: 0.3 = +30 %, 0 when the price is the usual one. */
export function eventPriceShift(offer: SupplierOffer, region: RegionId | null): number {
  const base = basePrice(offer, region);
  if (base === null || base <= 0 || round2(base) === offer.unitPrice) return 0;
  return offer.unitPrice / base - 1;
}

const unitPriceFormat = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

/** "₢3", "₢3,60", "₢0,675": a unit price with the precision the engine really charges. */
export function unitPriceLabel(price: number): string {
  return Number.isInteger(price) ? credits(price) : `₢${unitPriceFormat.format(price)}`;
}

/** Amount paid for an order, rounded to the crédit like the engine. */
export function orderTotal(unitPrice: number, quantity: number): number {
  return Math.round(unitPrice * quantity);
}

/** Largest order the supplier can serve and the team can pay right now. */
export function maxOrderQuantity(stock: number, unitPrice: number, cash: number): number {
  let quantity = Math.min(stock, MAX_ORDER_QUANTITY);
  if (unitPrice > 0) quantity = Math.min(quantity, Math.floor(Math.max(0, cash) / unitPrice));
  while (quantity > 0 && orderTotal(unitPrice, quantity) > cash) quantity -= 1;
  return Math.max(0, quantity);
}

export interface OrderMessage {
  /** "error" blocks the order; "warning" only informs. */
  tone: "error" | "warning";
  text: string;
}

export function hasError(messages: readonly OrderMessage[]): boolean {
  return messages.some((message) => message.tone === "error");
}

/**
 * Explicit refusals of a raw-material order before anything is sent (story 28), plus the
 * warning that a full warehouse will make the delivery wait (R9).
 */
export function materialOrderMessages({
  text,
  quantity,
  supplierName,
  stock,
  nextRestockDay,
  total,
  cash,
  room,
}: {
  text: string;
  quantity: number | null;
  supplierName: string;
  stock: number;
  nextRestockDay: number;
  total: number;
  cash: number;
  room: number;
}): OrderMessage[] {
  const messages: OrderMessage[] = [];
  if (quantity === null) {
    if (text.trim() !== "") {
      messages.push({
        tone: "error",
        text: "Indiquez un nombre entier d'unités, supérieur à zéro.",
      });
    }
    return messages;
  }
  if (quantity > MAX_ORDER_QUANTITY) {
    messages.push({
      tone: "error",
      text: `Pas plus de ${unitsLabel(MAX_ORDER_QUANTITY)} par commande.`,
    });
  }
  if (quantity > stock) {
    messages.push({
      tone: "error",
      text:
        stock === 0
          ? `${supplierName} est en rupture de stock jusqu'au jour ${nextRestockDay}.`
          : `Stock insuffisant : ${supplierName} n'a plus que ${unitsLabel(stock)}.`,
    });
  }
  if (total > cash) {
    messages.push({
      tone: "error",
      text: `Trésorerie disponible insuffisante : il manque ${credits(total - cash)}.`,
    });
  }
  if (quantity > room) {
    messages.push({
      tone: "warning",
      text: `Place insuffisante à ce jour : il ne restera que ${unitsLabel(room, "libre")} à l'arrivée. La livraison attendra qu'une place se libère, sans perte.`,
    });
  }
  return messages;
}

/**
 * Refusals of a machine order (stock, cash) and warnings for products the company cannot
 * make yet: buying ahead is allowed (R2), so locks never block.
 */
export function machineOrderMessages({
  supplierName,
  typeName,
  stock,
  nextRestockDay,
  price,
  cash,
  locks,
}: {
  supplierName: string;
  typeName: string;
  stock: number;
  nextRestockDay: number;
  price: number;
  cash: number;
  locks: readonly { productId: ProductId; lock: ProductLock | null }[];
}): OrderMessage[] {
  const messages: OrderMessage[] = [];
  if (stock < 1) {
    messages.push({
      tone: "error",
      text: `${supplierName} n'a plus de « ${typeName} » en stock : réapprovisionnement le jour ${nextRestockDay}.`,
    });
  }
  if (price > cash) {
    messages.push({
      tone: "error",
      text: `Trésorerie disponible insuffisante : il manque ${credits(price - cash)}.`,
    });
  }
  for (const { productId, lock } of locks) {
    if (lock?.kind === "tier") {
      const branch = lock.branch ? ` (branche ${progressionRules.branches[lock.branch]})` : "";
      messages.push({
        tone: "warning",
        text: `Achat anticipé : débloquez le palier ${lock.tier}${branch} pour fabriquer ${itemName(productId)} (voir Progression).`,
      });
    }
    if (lock?.kind === "branch") {
      messages.push({
        tone: "warning",
        text: `Votre entreprise a choisi l'autre branche : ${itemName(productId)} ne lui sera jamais accessible.`,
      });
    }
  }
  return messages;
}

/** A whole positive number of units typed by the player, or null. */
export function parseQuantity(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 ? value : null;
}

/** Products whose recipe uses a material, in catalog order. */
export function productsUsing(material: MaterialId): ProductId[] {
  return products
    .filter((product) => (product.recipe[material] ?? 0) > 0)
    .map((product) => product.id);
}

export interface MachineGroup {
  type: MachineType;
  offers: MachineOffer[];
}

/** Equipment offers grouped by machine type (catalog order), cheapest supplier first. */
export function groupMachineOffers(machines: Record<string, MachineOffer>): MachineGroup[] {
  const offers = Object.values(machines);
  return purchasableMachineTypes
    .map((type) => ({
      type,
      offers: offers
        .filter((offer) => offer.machineTypeId === type.id)
        .sort((a, b) => a.price - b.price || a.supplierName.localeCompare(b.supplierName, "fr")),
    }))
    .filter((group) => group.offers.length > 0);
}

export function machineTypeName(machineTypeId: string): string {
  return machineTypeById.get(machineTypeId)?.name ?? machineTypeId;
}

/** Machines a company owns and has on their way, per machine type. */
export function machineCounts(
  team: TeamState,
): Record<string, { owned: number; incoming: number }> {
  const counts: Record<string, { owned: number; incoming: number }> = {};
  const entry = (typeId: string) => {
    counts[typeId] ??= { owned: 0, incoming: 0 };
    return counts[typeId];
  };
  for (const machine of Object.values(team.machines)) entry(machine.typeId).owned += 1;
  for (const shipment of Object.values(team.inbound)) {
    if (shipment.kind === "machine") entry(shipment.machineTypeId).incoming += 1;
  }
  return counts;
}

export interface CompatibleProduct {
  productId: ProductId;
  cycleDays: number;
  outputPerCycle: number;
}

/** What a machine type can make, one product at a time (R5), in catalog order. */
export function compatibleProducts(type: MachineType): CompatibleProduct[] {
  const list: CompatibleProduct[] = [];
  for (const { id } of products) {
    const settings = type.products[id];
    if (settings) list.push({ productId: id, ...settings });
  }
  return list;
}

/**
 * Why a company cannot produce a product yet: a tier still to unlock, or a tier-3 product of
 * the branch it did not choose (the choice is final, R2). Null when it can produce it.
 */
export type ProductLock =
  | { kind: "tier"; tier: number; branch: Branch | null }
  | { kind: "branch"; branch: Branch };

export function productLock(team: TeamState, productId: ProductId): ProductLock | null {
  if (canProduce(team, productId)) return null;
  const product = productById.get(productId);
  if (!product) return null;
  const chosen = team.progression.branch ?? team.progression.project?.branch ?? null;
  if (product.tier === 3 && product.branch && chosen && chosen !== product.branch) {
    return { kind: "branch", branch: product.branch };
  }
  return { kind: "tier", tier: product.tier, branch: product.branch };
}

export function lockLabel(lock: ProductLock): string {
  if (lock.kind === "branch") {
    return `Branche ${progressionRules.branches[lock.branch]} non choisie`;
  }
  return lock.branch
    ? `Palier ${lock.tier} · ${progressionRules.branches[lock.branch]}`
    : `Palier ${lock.tier}`;
}
