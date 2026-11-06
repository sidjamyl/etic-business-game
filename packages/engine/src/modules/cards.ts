import { cardById, cardRules, materialSupplierById, regionIds } from "@etic/content";
import { z } from "zod";
import { defineCommand } from "../commands.ts";
import { refuse } from "../errors.ts";
import { logTeam } from "../log.ts";
import { nextInt } from "../rng.ts";
import type { GameState, SpyReport, TeamState } from "../types.ts";
import { recentTraces } from "./black-market.ts";
import { publishNews } from "./scenario.ts";
import { actingTeam } from "./shared.ts";

const target = z.object({ targetTeamId: z.string().min(1) });

/** Card-specific payloads (N18). `kind` must match the card the team holds. */
const playSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("fake-news"),
    source: z.enum(["serious", "tabloid"]),
    region: z.enum(regionIds).nullable(),
    title: z
      .string()
      .trim()
      .min(1, "Le titre est obligatoire.")
      .max(cardRules.fakeNewsTitleMax, `Titre limité à ${cardRules.fakeNewsTitleMax} caractères.`),
    body: z
      .string()
      .trim()
      .min(1, "Le texte est obligatoire.")
      .max(cardRules.fakeNewsBodyMax, `Texte limité à ${cardRules.fakeNewsBodyMax} caractères.`),
  }),
  target.extend({ kind: z.literal("spying") }),
  target.extend({ kind: z.literal("sabotage") }),
  z.object({ kind: z.literal("supplier-priority"), supplierId: z.string().min(1) }),
  z.object({ kind: z.literal("social-peace") }),
  z.object({ kind: z.literal("amnesty") }),
]);

function otherTeam(state: GameState, team: TeamState, targetTeamId: string): TeamState {
  if (targetTeamId === team.id) refuse("INVALID_PAYLOAD", "Choisissez une autre entreprise.");
  const found = state.teams[targetTeamId];
  if (!found) refuse("NOT_FOUND", "Entreprise introuvable.");
  return found;
}

function spyReport(state: GameState, spied: TeamState): SpyReport {
  const employees = Object.values(spied.employees).filter((e) => e.arrivesOnDay <= state.time.day);
  return {
    targetTeamId: spied.id,
    companyName: spied.companyName ?? spied.name,
    day: state.time.day,
    cash: spied.cash,
    debt: spied.finance.debt,
    reputation: spied.reputation,
    tier: spied.progression.unlockedTier,
    branch: spied.progression.branch,
    inventory: { ...spied.inventory },
    machines: Object.values(spied.machines).map((m) => ({
      typeId: m.typeId,
      efficiency: m.efficiency,
      status: m.status,
    })),
    employees: {
      operators: employees.filter((e) => e.job === "operator").length,
      logisticians: employees.filter((e) => e.job === "logistician").length,
      averageEfficiency:
        employees.length === 0
          ? 0
          : Math.round((employees.reduce((s, e) => s + e.efficiency, 0) / employees.length) * 100) /
            100,
    },
    pendingOrders: Object.values(spied.orders).filter((o) => o.status === "pending").length,
    acceptedOrders: Object.values(spied.orders).filter((o) => o.status !== "pending").length,
    prices: structuredClone(spied.prices),
    recentBlackMarketTraces: recentTraces(state, spied).length,
  };
}

export const cardCommands = [
  defineCommand({
    type: "card.play",
    actor: "team",
    schema: playSchema,
    apply: (draft, payload, actor) => {
      const team = actingTeam(draft, actor);
      const card = team.card;
      if (!card) refuse("NOT_FOUND", "Vous n'avez pas de carte secrète.");
      if (card.used) refuse("INVALID_STATE", "Votre carte secrète a déjà été utilisée.");
      if (card.id !== payload.kind) refuse("INVALID_PAYLOAD", "Ce n'est pas votre carte.");
      const day = draft.time.day;
      const name = cardById.get(card.id)?.name ?? card.id;

      switch (payload.kind) {
        case "fake-news":
          publishNews(
            draft,
            {
              source: payload.source,
              region: payload.region,
              title: payload.title,
              body: payload.body,
            },
            { kind: "card", teamId: team.id },
          );
          break;
        case "spying":
          team.cardEffects.spyReport = spyReport(
            draft,
            otherTeam(draft, team, payload.targetTeamId),
          );
          break;
        case "sabotage": {
          const victim = otherTeam(draft, team, payload.targetTeamId);
          const machines = Object.values(victim.machines);
          if (machines.length === 0)
            refuse("INVALID_STATE", "Cette entreprise n'a encore aucune machine.");
          const machine = machines[nextInt(draft.rng, 0, machines.length - 1)];
          if (!machine) refuse("INVALID_STATE", "Cette entreprise n'a encore aucune machine.");
          machine.stoppedUntilDay = Math.max(
            machine.stoppedUntilDay ?? 0,
            day + cardRules.sabotageDays,
          );
          logTeam(draft, victim.id, {
            kind: "event",
            message: `Votre entreprise a été la cible d'une carte secrète (sabotage) : une machine est arrêtée ${cardRules.sabotageDays} jours.`,
          });
          break;
        }
        case "supplier-priority": {
          const supplier = materialSupplierById.get(payload.supplierId);
          const market = draft.market.suppliers[payload.supplierId];
          if (!supplier || !market) refuse("NOT_FOUND", "Fournisseur introuvable.");
          draft.market.supplierPriority[payload.supplierId] = {
            teamId: team.id,
            day: market.nextRestockDay,
          };
          break;
        }
        case "social-peace":
          for (const employee of Object.values(team.employees)) {
            employee.efficiency = 1;
            employee.lastRaiseDay = day;
          }
          break;
        case "amnesty":
          team.blackMarket.traces = [];
          team.cardEffects.amnestyUntilDay = day + cardRules.amnestyShieldDays;
          break;
      }
      card.used = true;
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `Carte secrète « ${name} » jouée.`,
      });
    },
  }),

  defineCommand({
    type: "admin.deleteNews",
    actor: "organizer",
    allowedStatuses: ["running", "paused", "ended"],
    schema: z.object({ newsId: z.int() }),
    apply: (draft, { newsId }) => {
      const index = draft.news.findIndex((n) => n.id === newsId);
      const news = draft.news[index];
      if (!news) refuse("NOT_FOUND", "News introuvable.");
      if (news.origin.kind !== "card") {
        refuse("FORBIDDEN", "Seules les fausses news des cartes peuvent être supprimées.");
      }
      draft.news.splice(index, 1);
    },
  }),
];

export const cardSystem = {
  name: "cards",
  onDay: (draft: GameState) => {
    for (const [supplierId, priority] of Object.entries(draft.market.supplierPriority)) {
      if (draft.time.day > priority.day) delete draft.market.supplierPriority[supplierId];
    }
  },
};
