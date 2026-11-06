import {
  type ItemId,
  itemName,
  machineTypeById,
  materialIds,
  productIds,
  type TransportOption,
  tradeRules,
  transportOptions,
} from "@etic/content";
import { z } from "zod";
import { defineCommand } from "../commands.ts";
import { refuse } from "../errors.ts";
import { allocateId, logTeam } from "../log.ts";
import type { GameSystem } from "../systems.ts";
import type { GameState, MachineState, TeamState, TradeGood } from "../types.ts";
import { extraTransportDays, shippingCost, shippingDays } from "./delivery.ts";
import { recordTransport } from "./impact.ts";
import {
  actingTeam,
  availableCash,
  credits,
  describeQuantity,
  recordCash,
  spend,
} from "./shared.ts";

const itemIdSchema = z.enum([...materialIds, ...productIds]);
const goodSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("item"),
    item: itemIdSchema,
    quantity: z
      .int("La quantité doit être un nombre entier.")
      .positive("La quantité doit être positive."),
  }),
  z.object({ kind: z.literal("machine"), machineId: z.string().min(1) }),
]);
type GoodInput = z.infer<typeof goodSchema>;

function companyName(team: TeamState): string {
  return team.companyName ?? team.name;
}

function otherTeam(state: GameState, team: TeamState, id: string): TeamState {
  if (id === team.id) refuse("INVALID_PAYLOAD", "Choisissez une autre entreprise.");
  const found = state.teams[id];
  if (!found) refuse("NOT_FOUND", "Entreprise introuvable.");
  return found;
}

function describeGood(good: TradeGood): string {
  return good.kind === "item"
    ? describeQuantity(good.item, good.quantity)
    : `machine « ${machineTypeById.get(good.typeId)?.name ?? good.typeId} »`;
}

/** Resolves a requested good against the seller's current possessions. */
function resolveGood(seller: TeamState, input: GoodInput): TradeGood {
  if (input.kind === "machine") {
    const machine = seller.machines[input.machineId];
    if (!machine) refuse("NOT_FOUND", "Machine introuvable.");
    return { kind: "machine", machineId: machine.id, typeId: machine.typeId };
  }
  if ((seller.inventory[input.item] ?? 0) <= 0) {
    refuse("OUT_OF_STOCK", `Vous n'avez pas de ${itemName(input.item)}.`);
  }
  return { kind: "item", item: input.item, quantity: input.quantity };
}

/** Removes the goods from the seller; returns the travelling machine if any. */
function takeGoods(seller: TeamState, good: TradeGood): MachineState | null {
  if (good.kind === "machine") {
    const machine = seller.machines[good.machineId];
    if (!machine) refuse("OUT_OF_STOCK", "Le vendeur ne possède plus cette machine.");
    if (machine.cycle || machine.pendingOutput) {
      refuse("INVALID_STATE", "La machine est en plein cycle : attendez sa fin.");
    }
    for (const employee of Object.values(seller.employees)) {
      if (employee.machineId === machine.id) employee.machineId = null;
    }
    delete seller.machines[machine.id];
    return { ...machine, job: null, status: "idle", ranToday: false };
  }
  const item = good.item;
  const reserved = (seller.reserved as Partial<Record<ItemId, number>>)[item] ?? 0;
  const available = (seller.inventory[item] ?? 0) - reserved;
  if (available < good.quantity) {
    refuse("OUT_OF_STOCK", `Stock disponible insuffisant : ${available} ${itemName(item)}.`);
  }
  const left = (seller.inventory[item] ?? 0) - good.quantity;
  if (left > 0) seller.inventory[item] = left;
  else delete seller.inventory[item];
  return null;
}

function routeCost(
  state: GameState,
  payer: TeamState,
  seller: TeamState,
  buyer: TeamState,
  good: TradeGood,
  option: TransportOption,
) {
  if (!seller.region || !buyer.region) refuse("INVALID_STATE", "Région inconnue.");
  const units = good.kind === "item" ? good.quantity : tradeRules.machineShippingUnits;
  const cost = Math.round(
    shippingCost(option, units, seller.region, buyer.region) * payer.perks.shippingFactor,
  );
  const days =
    shippingDays(option, seller.region, buyer.region) +
    extraTransportDays(state, seller.region, buyer.region);
  return { cost, days };
}

function ship(
  state: GameState,
  kind: "contract" | "gift",
  seller: TeamState,
  buyer: TeamState,
  good: TradeGood,
  machine: MachineState | null,
  escrow: number,
  days: number,
  option: TransportOption,
) {
  recordTransport(
    seller,
    option,
    good.kind === "item" ? good.quantity : tradeRules.machineShippingUnits,
  );
  const id = `t-${allocateId(state)}`;
  state.trades.shipments[id] = {
    id,
    kind,
    sellerId: seller.id,
    buyerId: buyer.id,
    good,
    machine,
    escrow,
    arrivesOnDay: state.time.day + days,
  };
}

const offerSchema = z.object({
  buyerTeamId: z.string().min(1),
  good: goodSchema,
  price: z.int("Le prix doit être un nombre entier.").min(0, "Le prix ne peut pas être négatif."),
  option: z.enum(transportOptions),
  shippingPaidBy: z.enum(["seller", "buyer"]),
});

export const tradeCommands = [
  defineCommand({
    type: "trade.offer",
    actor: "team",
    schema: offerSchema,
    apply: (draft, payload, actor) => {
      const seller = actingTeam(draft, actor);
      const buyer = otherTeam(draft, seller, payload.buyerTeamId);
      const good = resolveGood(seller, payload.good);
      const id = `to-${allocateId(draft)}`;
      draft.trades.offers[id] = {
        id,
        sellerId: seller.id,
        buyerId: buyer.id,
        good,
        price: payload.price,
        option: payload.option,
        shippingPaidBy: payload.shippingPaidBy,
        createdDay: draft.time.day,
        expiresOnDay: draft.time.day + tradeRules.offerExpiryDays,
      };
      logTeam(draft, seller.id, {
        kind: "decision",
        actor: actor.name,
        message: `Offre envoyée à ${companyName(buyer)} : ${describeGood(good)} pour ${credits(payload.price)}.`,
      });
      logTeam(draft, buyer.id, {
        kind: "event",
        message: `${companyName(seller)} vous propose ${describeGood(good)} pour ${credits(payload.price)}.`,
      });
    },
  }),

  defineCommand({
    type: "trade.withdraw",
    actor: "team",
    schema: z.object({ offerId: z.string().min(1) }),
    apply: (draft, { offerId }, actor) => {
      const team = actingTeam(draft, actor);
      const offer = draft.trades.offers[offerId];
      if (!offer || offer.sellerId !== team.id) refuse("NOT_FOUND", "Offre introuvable.");
      delete draft.trades.offers[offerId];
      logTeam(draft, offer.buyerId, {
        kind: "event",
        message: `${companyName(team)} a retiré son offre.`,
      });
    },
  }),

  defineCommand({
    type: "trade.decline",
    actor: "team",
    schema: z.object({ offerId: z.string().min(1) }),
    apply: (draft, { offerId }, actor) => {
      const team = actingTeam(draft, actor);
      const offer = draft.trades.offers[offerId];
      if (!offer || offer.buyerId !== team.id) refuse("NOT_FOUND", "Offre introuvable.");
      delete draft.trades.offers[offerId];
      logTeam(draft, offer.sellerId, {
        kind: "event",
        message: `${companyName(team)} a refusé votre offre.`,
      });
    },
  }),

  defineCommand({
    type: "trade.accept",
    actor: "team",
    schema: z.object({ offerId: z.string().min(1) }),
    apply: (draft, { offerId }, actor) => {
      const buyer = actingTeam(draft, actor);
      const offer = draft.trades.offers[offerId];
      if (!offer || offer.buyerId !== buyer.id) refuse("NOT_FOUND", "Offre introuvable.");
      const seller = draft.teams[offer.sellerId];
      if (!seller) refuse("NOT_FOUND", "Vendeur introuvable.");
      const payer = offer.shippingPaidBy === "buyer" ? buyer : seller;
      const { cost, days } = routeCost(draft, payer, seller, buyer, offer.good, offer.option);
      const buyerNeeds = offer.price + (payer === buyer ? cost : 0);
      if (availableCash(buyer) < buyerNeeds) {
        refuse(
          "INSUFFICIENT_FUNDS",
          `Trésorerie disponible insuffisante : il faut ${credits(buyerNeeds)}.`,
        );
      }
      if (payer === seller && availableCash(seller) < cost) {
        refuse("INSUFFICIENT_FUNDS", "Le vendeur ne peut pas payer le transport.");
      }
      const machine = takeGoods(seller, offer.good);
      recordCash(
        draft,
        buyer,
        -offer.price,
        "trades",
        `Achat à ${companyName(seller)} (séquestre)`,
      );
      recordCash(draft, payer, -cost, "shipping", "Transport d'un échange");
      ship(draft, "contract", seller, buyer, offer.good, machine, offer.price, days, offer.option);
      delete draft.trades.offers[offerId];
      logTeam(draft, buyer.id, {
        kind: "decision",
        actor: actor.name,
        message: `Offre de ${companyName(seller)} acceptée : ${describeGood(offer.good)}, arrivée jour ${draft.time.day + days}.`,
      });
      logTeam(draft, seller.id, {
        kind: "event",
        message: `${companyName(buyer)} accepte votre offre : ${describeGood(offer.good)} expédié, paiement à la livraison.`,
      });
    },
  }),

  defineCommand({
    type: "transfer.money",
    actor: "team",
    schema: z.object({
      toTeamId: z.string().min(1),
      amount: z
        .int("Le montant doit être un nombre entier.")
        .positive("Le montant doit être positif."),
    }),
    apply: (draft, { toTeamId, amount }, actor) => {
      const team = actingTeam(draft, actor);
      const target = otherTeam(draft, team, toTeamId);
      spend(draft, team, amount, "transfers", `Virement à ${companyName(target)}`);
      recordCash(draft, target, amount, "transfers", `Virement de ${companyName(team)}`);
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `Virement de ${credits(amount)} à ${companyName(target)}.`,
      });
      logTeam(draft, target.id, {
        kind: "event",
        message: `${companyName(team)} vous a viré ${credits(amount)}.`,
      });
    },
  }),

  defineCommand({
    type: "transfer.goods",
    actor: "team",
    schema: z.object({
      toTeamId: z.string().min(1),
      good: goodSchema,
      option: z.enum(transportOptions),
    }),
    apply: (draft, { toTeamId, good: input, option }, actor) => {
      const team = actingTeam(draft, actor);
      const target = otherTeam(draft, team, toTeamId);
      const good = resolveGood(team, input);
      const { cost, days } = routeCost(draft, team, team, target, good, option);
      spend(draft, team, cost, "shipping", `Envoi à ${companyName(target)}`);
      const machine = takeGoods(team, good);
      ship(draft, "gift", team, target, good, machine, 0, days, option);
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `Envoi gratuit à ${companyName(target)} : ${describeGood(good)}.`,
      });
    },
  }),
];

function deliverTrades(draft: GameState): void {
  for (const shipment of Object.values(draft.trades.shipments)) {
    if (shipment.arrivesOnDay > draft.time.day) continue;
    delete draft.trades.shipments[shipment.id];
    const buyer = draft.teams[shipment.buyerId];
    const seller = draft.teams[shipment.sellerId];
    if (!buyer || !seller) continue;
    if (shipment.good.kind === "machine" && shipment.machine) {
      buyer.machines[shipment.machine.id] = shipment.machine;
    } else if (shipment.good.kind === "item") {
      // Through the inbound flow, so a full warehouse makes the goods wait (R9).
      const id = `in-${allocateId(draft)}`;
      buyer.inbound[id] = {
        id,
        kind: "material",
        supplierId: `trade:${seller.id}`,
        item: shipment.good.item,
        quantity: shipment.good.quantity,
        arrivesOnDay: draft.time.day,
        status: "in-transit",
      };
    }
    if (shipment.escrow > 0) {
      recordCash(draft, seller, shipment.escrow, "trades", `Vente à ${companyName(buyer)}`);
    }
    logTeam(draft, buyer.id, {
      kind: "system",
      message: `Reçu de ${companyName(seller)} : ${describeGood(shipment.good)}.`,
    });
    logTeam(draft, seller.id, {
      kind: "system",
      message:
        shipment.escrow > 0
          ? `Livraison à ${companyName(buyer)} effectuée : ${credits(shipment.escrow)} encaissés.`
          : `Envoi à ${companyName(buyer)} livré.`,
    });
  }
}

/** Offers and trades visible to one company (R15: private). */
export function tradesView(state: GameState, teamId: string) {
  return {
    offers: Object.values(state.trades.offers).filter(
      (o) => o.sellerId === teamId || o.buyerId === teamId,
    ),
    shipments: Object.values(state.trades.shipments)
      .filter((s) => s.sellerId === teamId || s.buyerId === teamId)
      .map(({ machine: _machine, ...rest }) => rest),
  };
}

export const tradeSystem: GameSystem = {
  name: "trades",
  onDay: (draft) => {
    for (const offer of Object.values(draft.trades.offers)) {
      if (draft.time.day > offer.expiresOnDay) delete draft.trades.offers[offer.id];
    }
  },
  // Deliver before the purchasing system moves inbound goods into warehouses.
  onStep: (draft) => deliverTrades(draft),
  // R19: contracts still travelling are cancelled, the buyer is refunded, the goods are lost.
  onEnd: (draft) => {
    for (const shipment of Object.values(draft.trades.shipments)) {
      const buyer = draft.teams[shipment.buyerId];
      if (buyer && shipment.escrow > 0) {
        recordCash(draft, buyer, shipment.escrow, "trades", "Remboursement d'un échange annulé");
      }
    }
    draft.trades.shipments = {};
    draft.trades.offers = {};
  },
};
