import { cards, startRules } from "@etic/content";
import { z } from "zod";
import { defineCommand } from "./commands.ts";
import { refuse } from "./errors.ts";
import { missingForStart } from "./lobby.ts";
import { announce, logAllTeams, logTeam } from "./log.ts";
import { recordCash } from "./modules/shared.ts";
import { shuffle } from "./rng.ts";

/** Organizer commands that drive the shared clock (P8, Q8, R19). */
export const controlCommands = [
  defineCommand({
    type: "control.start",
    actor: "organizer",
    allowedStatuses: ["lobby"],
    schema: z.object({}).optional(),
    apply: (draft) => {
      const missing = missingForStart(draft);
      if (missing.length > 0) {
        refuse(
          "NOT_READY",
          `Équipes pas prêtes (membre, nom et région requis) : ${missing.join(", ")}.`,
        );
      }
      draft.status = "running";
      announce(draft, "La partie commence.");
      logAllTeams(draft, { kind: "system", message: "La partie commence." });
      // Distinct cards dealt at random (R14), cash credited (R16).
      const deck = shuffle(
        draft.rng,
        cards.map((card) => card.id),
      );
      for (const [index, team] of Object.values(draft.teams).entries()) {
        recordCash(draft, team, startRules.startingCash, "other", "Capital de départ");
        const cardId = deck[index % deck.length];
        team.card = cardId ? { id: cardId, used: false } : null;
        logTeam(draft, team.id, {
          kind: "system",
          message: `Trésorerie initiale : ₢${startRules.startingCash.toLocaleString("fr-FR")}.`,
        });
      }
    },
  }),
  defineCommand({
    type: "control.pause",
    actor: "organizer",
    allowedStatuses: ["running"],
    schema: z.object({}).optional(),
    apply: (draft) => {
      draft.status = "paused";
      announce(draft, "Jeu en pause.");
    },
  }),
  defineCommand({
    type: "control.resume",
    actor: "organizer",
    allowedStatuses: ["paused"],
    schema: z.object({}).optional(),
    apply: (draft) => {
      draft.status = "running";
      announce(draft, "Reprise de la partie.");
    },
  }),
  defineCommand({
    type: "control.setEndDay",
    actor: "organizer",
    allowedStatuses: ["lobby", "running", "paused"],
    schema: z.object({ endDay: z.int().positive().nullable() }),
    apply: (draft, { endDay }) => {
      if (endDay !== null && endDay < draft.time.day) {
        refuse("INVALID_STATE", "Le jour de fin est déjà passé.");
      }
      draft.endDay = endDay;
    },
  }),
  defineCommand({
    type: "control.end",
    actor: "organizer",
    allowedStatuses: ["lobby", "running", "paused"],
    schema: z.object({}).optional(),
    apply: (draft, _payload, _actor, ctx) => ctx.finishGame(draft),
  }),
];
