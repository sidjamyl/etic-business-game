import {
  blackMarketRules,
  itemName,
  type MaterialId,
  materialSuppliers,
  type ProductId,
  productById,
  productIds,
} from "@etic/content";
import { z } from "zod";
import { defineCommand } from "../commands.ts";
import { refuse } from "../errors.ts";
import { allocateId, logTeam } from "../log.ts";
import { nextFloat } from "../rng.ts";
import type { GameSystem } from "../systems.ts";
import type { GameState, TeamState } from "../types.ts";
import { recordPurchase } from "./impact.ts";
import { localPrice } from "./sales.ts";
import { publishNews } from "./scenario.ts";
import { actingTeam, availableCash, availableStock, credits, recordCash, spend } from "./shared.ts";

const rules = blackMarketRules;
const blackMarketMaterials = Object.keys(rules.stock) as MaterialId[];

function companyName(team: TeamState): string {
  return team.companyName ?? team.name;
}

function accessFactor(team: TeamState): number {
  return team.region === "port-libre" ? rules.portLibreFactor : 1;
}

/** Average regular supplier price for a material. */
function regularPrice(material: MaterialId): number {
  const prices = materialSuppliers.filter((s) => s.material === material).map((s) => s.price);
  return prices.reduce((sum, price) => sum + price, 0) / Math.max(1, prices.length);
}

export function blackMarketBuyPrice(material: MaterialId): number {
  return Math.round(regularPrice(material) * (1 - rules.buyDiscount) * 100) / 100;
}

export function blackMarketSellPrice(team: TeamState, productId: ProductId): number {
  if (!team.region) return 0;
  return Math.round(localPrice(team.region, productId) * (1 + rules.sellPremium) * 100) / 100;
}

export function dailySellCap(team: TeamState, productId: ProductId): number {
  const tier = productById.get(productId)?.tier ?? 1;
  return Math.floor(rules.dailySellCap[tier] * accessFactor(team));
}

export function recentTraces(state: GameState, team: TeamState) {
  return team.blackMarket.traces.filter((t) => t.day > state.time.day - rules.traceDays);
}

function requireAccess(state: GameState, team: TeamState): void {
  const banned = team.blackMarket.bannedUntilDay;
  if (banned !== null && state.time.day <= banned) {
    refuse("BANNED", `Vous êtes exclu du marché noir jusqu'au jour ${banned}.`);
  }
}

/**
 * Charges a fine; what the available cash cannot cover is added to the bank debt (N17).
 * Fines never eliminate a company.
 */
export function chargeFine(state: GameState, team: TeamState, amount: number, label: string) {
  const paid = Math.min(amount, Math.max(0, availableCash(team)));
  recordCash(state, team, -paid, "fines", label);
  const rest = amount - paid;
  if (rest > 0) team.finance.debt += rest;
  return { paid, toDebt: rest };
}

/** Sanctions a guilty company (accusation or customs, R13). */
function convict(state: GameState, team: TeamState, by: string): void {
  const gain = recentTraces(state, team).reduce((sum, t) => sum + t.gain, 0);
  const fine = Math.max(
    rules.accusation.minFine,
    Math.round(gain * rules.accusation.fineMultiplier),
  );
  const { toDebt } = chargeFine(state, team, fine, "Amende pour marché noir");
  team.reputation = Math.max(0, team.reputation - rules.accusation.reputationPenalty);
  team.blackMarket.convictions += 1;
  team.blackMarket.bannedUntilDay = state.time.day + rules.accusation.banDays;
  team.blackMarket.traces = [];
  logTeam(state, team.id, {
    kind: "event",
    message: `Activité de marché noir démasquée (${by}) : amende de ${credits(fine)}${toDebt > 0 ? ` (dont ${credits(toDebt)} ajoutés à la dette)` : ""}, réputation en baisse, exclusion pendant ${rules.accusation.banDays} jours.`,
  });
  publishNews(
    state,
    {
      source: "tabloid",
      region: team.region,
      title: `Scandale : ${companyName(team)} pris la main dans le sac`,
      body: `${companyName(team)} trafiquait au marché noir. Démasquée par ${by}, l'entreprise écope d'une lourde amende.`,
    },
    { kind: "scenario", ref: `black-market:${team.id}:${state.time.day}` },
  );
}

/** Leaves a trace; in Port-Libre, customs may catch the deal right away (R3). */
function afterDeal(state: GameState, team: TeamState, gain: number): void {
  team.blackMarket.traces.push({ day: state.time.day, gain });
  if (team.region === "port-libre" && nextFloat(state.rng) < rules.customsChance) {
    convict(state, team, "la douane de Port-Libre");
  }
}

function requireOtherTeam(state: GameState, team: TeamState, targetTeamId: string): TeamState {
  if (targetTeamId === team.id) refuse("INVALID_PAYLOAD", "Choisissez une autre entreprise.");
  const target = state.teams[targetTeamId];
  if (!target) refuse("NOT_FOUND", "Entreprise introuvable.");
  return target;
}

export const blackMarketCommands = [
  defineCommand({
    type: "blackMarket.buy",
    actor: "team",
    schema: z.object({
      material: z.enum(blackMarketMaterials as [MaterialId, ...MaterialId[]]),
      quantity: z
        .int("La quantité doit être un nombre entier.")
        .positive("La quantité doit être positive."),
    }),
    apply: (draft, { material, quantity }, actor) => {
      const team = actingTeam(draft, actor);
      requireAccess(draft, team);
      const stock = draft.market.blackMarket.stock[material] ?? 0;
      if (stock < quantity) {
        refuse(
          "OUT_OF_STOCK",
          stock === 0 ? "Plus rien à vendre pour l'instant." : `Il ne reste que ${stock} unités.`,
        );
      }
      const price = blackMarketBuyPrice(material);
      const cost = Math.round(price * quantity);
      spend(draft, team, cost, "blackMarket", `Achat discret de ${itemName(material)}`);
      draft.market.blackMarket.stock[material] = stock - quantity;
      const id = `in-${allocateId(draft)}`;
      team.inbound[id] = {
        id,
        kind: "material",
        supplierId: "black-market",
        item: material,
        quantity,
        arrivesOnDay: draft.time.day + rules.deliveryDays,
        status: "in-transit",
      };
      team.blackMarket.purchasedUnits += quantity;
      recordPurchase(team, quantity, { social: 0, environmental: 0 });
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `Achat au marché noir : ${quantity} × ${itemName(material)} pour ${credits(cost)}.`,
      });
      afterDeal(draft, team, Math.round((regularPrice(material) - price) * quantity));
    },
  }),

  defineCommand({
    type: "blackMarket.sell",
    actor: "team",
    schema: z.object({
      productId: z.enum(productIds),
      quantity: z
        .int("La quantité doit être un nombre entier.")
        .positive("La quantité doit être positive."),
    }),
    apply: (draft, { productId, quantity }, actor) => {
      const team = actingTeam(draft, actor);
      requireAccess(draft, team);
      const cap = dailySellCap(team, productId);
      const sold = team.blackMarket.soldToday[productId] ?? 0;
      if (sold + quantity > cap) {
        refuse(
          "INVALID_STATE",
          `Les acheteurs n'en prendront plus que ${Math.max(0, cap - sold)} aujourd'hui.`,
        );
      }
      if (availableStock(team, productId) < quantity) {
        refuse("OUT_OF_STOCK", `Stock disponible insuffisant en ${itemName(productId)}.`);
      }
      const left = (team.inventory[productId] ?? 0) - quantity;
      if (left > 0) team.inventory[productId] = left;
      else delete team.inventory[productId];
      const price = blackMarketSellPrice(team, productId);
      const revenue = Math.round(price * quantity);
      recordCash(draft, team, revenue, "blackMarket", `Vente discrète de ${itemName(productId)}`);
      team.blackMarket.soldToday[productId] = sold + quantity;
      team.blackMarket.soldUnits += quantity;
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `Vente au marché noir : ${quantity} × ${itemName(productId)} pour ${credits(revenue)}.`,
      });
      const regular = team.region ? localPrice(team.region, productId) : price;
      afterDeal(draft, team, Math.round((price - regular) * quantity));
    },
  }),

  defineCommand({
    type: "blackMarket.investigate",
    actor: "team",
    schema: z.object({ targetTeamId: z.string().min(1) }),
    apply: (draft, { targetTeamId }, actor) => {
      const team = actingTeam(draft, actor);
      const target = requireOtherTeam(draft, team, targetTeamId);
      spend(
        draft,
        team,
        rules.investigation.cost,
        "investigations",
        `Enquête sur ${companyName(target)}`,
      );
      const traces = recentTraces(draft, target).length;
      const chance = Math.min(
        rules.investigation.maxChance,
        rules.investigation.baseChance + traces * rules.investigation.chancePerTrace,
      );
      // The draw always happens, so the result never depends on a hidden shortcut.
      const roll = nextFloat(draft.rng);
      const proofFound = traces > 0 && roll < chance;
      team.blackMarket.investigations.push({ targetTeamId, day: draft.time.day, proofFound });
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: proofFound
          ? `Enquête sur ${companyName(target)} : preuves de marché noir trouvées.`
          : `Enquête sur ${companyName(target)} : rien trouvé (ce qui ne prouve pas son innocence).`,
      });
    },
  }),

  defineCommand({
    type: "blackMarket.accuse",
    actor: "team",
    schema: z.object({ targetTeamId: z.string().min(1) }),
    apply: (draft, { targetTeamId }, actor) => {
      const team = actingTeam(draft, actor);
      const target = requireOtherTeam(draft, team, targetTeamId);
      const last = team.blackMarket.lastAccusations[targetTeamId];
      if (last !== undefined && draft.time.day < last + rules.accusation.cooldownDays) {
        refuse(
          "COOLDOWN",
          `Vous avez déjà accusé ${companyName(target)} récemment : attendez le jour ${last + rules.accusation.cooldownDays}.`,
        );
      }
      team.blackMarket.lastAccusations[targetTeamId] = draft.time.day;
      // An amnesty card played in advance cancels the accusation silently (N18).
      const shield = target.cardEffects.amnestyUntilDay;
      if (shield !== null && draft.time.day <= shield) {
        target.cardEffects.amnestyUntilDay = null;
        logTeam(draft, team.id, {
          kind: "event",
          message: `Accusation contre ${companyName(target)} classée sans suite.`,
        });
        logTeam(draft, target.id, {
          kind: "event",
          message: "Une accusation vous visait : votre amnistie l'a annulée.",
        });
        return;
      }
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `Accusation publique contre ${companyName(target)}.`,
      });
      if (recentTraces(draft, target).length > 0) {
        convict(draft, target, `une accusation de ${companyName(team)}`);
        return;
      }
      chargeFine(
        draft,
        team,
        rules.accusation.falseAccusationFine,
        "Amende pour accusation infondée",
      );
      team.reputation = Math.max(0, team.reputation - rules.accusation.falseAccusationReputation);
      logTeam(draft, team.id, {
        kind: "event",
        message: `Accusation infondée : amende de ${credits(rules.accusation.falseAccusationFine)} et réputation en baisse.`,
      });
      publishNews(
        draft,
        {
          source: "tabloid",
          region: null,
          title: `Accusation infondée de ${companyName(team)}`,
          body: `${companyName(team)} accusait ${companyName(target)} de trafic. L'enquête l'a blanchie : l'accusateur est sanctionné.`,
        },
        { kind: "scenario", ref: `accusation:${team.id}:${draft.time.day}` },
      );
    },
  }),
];

/** Black-market offers as one team sees them. */
export function blackMarketView(state: GameState, team: TeamState) {
  const buy: Partial<Record<MaterialId, { price: number; stock: number }>> = {};
  for (const material of blackMarketMaterials) {
    buy[material] = {
      price: blackMarketBuyPrice(material),
      stock: state.market.blackMarket.stock[material] ?? 0,
    };
  }
  const sell: Partial<Record<ProductId, { price: number; cap: number; soldToday: number }>> = {};
  for (const productId of productIds) {
    sell[productId] = {
      price: blackMarketSellPrice(team, productId),
      cap: dailySellCap(team, productId),
      soldToday: team.blackMarket.soldToday[productId] ?? 0,
    };
  }
  const banned = team.blackMarket.bannedUntilDay;
  return {
    buy,
    sell,
    nextRestockDay: state.market.blackMarket.nextRestockDay,
    recentTraces: recentTraces(state, team).length,
    bannedUntilDay: banned !== null && state.time.day <= banned ? banned : null,
  };
}

export const blackMarketSystem: GameSystem = {
  name: "black-market",
  onCreate: (draft) => {
    draft.market.blackMarket = {
      stock: { ...rules.stock },
      nextRestockDay: 1 + rules.restockEveryDays,
    };
  },
  onDay: (draft) => {
    const market = draft.market.blackMarket;
    if (draft.time.day >= market.nextRestockDay) {
      for (const material of blackMarketMaterials) {
        market.stock[material] = Math.max(
          market.stock[material] ?? 0,
          rules.stock[material as keyof typeof rules.stock],
        );
      }
      market.nextRestockDay += rules.restockEveryDays;
    }
    for (const team of Object.values(draft.teams)) {
      team.blackMarket.soldToday = {};
      team.blackMarket.traces = recentTraces(draft, team);
    }
  },
};
