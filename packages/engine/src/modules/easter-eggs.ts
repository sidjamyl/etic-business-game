import { easterEggById, easterEggIds, itemName, secretHash } from "@etic/content";
import { z } from "zod";
import { defineCommand } from "../commands.ts";
import { refuse } from "../errors.ts";
import { allocateId, announce, logTeam } from "../log.ts";
import { actingTeam, credits, recordCash } from "./shared.ts";

export const easterEggCommands = [
  defineCommand({
    type: "egg.claim",
    actor: "team",
    schema: z.object({ eggId: z.enum(easterEggIds), answer: z.string().max(100).optional() }),
    apply: (draft, { eggId, answer }, actor) => {
      const team = actingTeam(draft, actor);
      const egg = easterEggById.get(eggId);
      if (!egg) refuse("NOT_FOUND", "Secret introuvable.");
      if (team.badges.includes(eggId))
        refuse("ALREADY_IN_PROGRESS", "Vous avez déjà découvert ce secret.");
      if (
        egg.answerHash !== null &&
        (answer === undefined || secretHash(answer) !== egg.answerHash)
      ) {
        refuse("INVALID_PAYLOAD", "Ce n'est pas la bonne réponse.");
      }
      const finders = draft.easterEggs[eggId] ?? [];
      const first = finders.length === 0;
      draft.easterEggs[eggId] = [...finders, team.id];
      team.badges.push(eggId);
      // Small rewards for the first finder only, so secrets never decide the winner (R20).
      if (first && egg.reward.kind === "cash") {
        recordCash(draft, team, egg.reward.amount, "bonus", `Secret découvert : ${egg.name}`);
      }
      if (first && egg.reward.kind === "item") {
        const id = `in-${allocateId(draft)}`;
        team.inbound[id] = {
          id,
          kind: "material",
          supplierId: "secret",
          item: egg.reward.item,
          quantity: egg.reward.quantity,
          arrivesOnDay: draft.time.day,
          status: "in-transit",
        };
      }
      const reward = !first
        ? "un badge"
        : egg.reward.kind === "cash"
          ? `${credits(egg.reward.amount)} et un badge`
          : `${egg.reward.quantity} × ${itemName(egg.reward.item)} et un badge`;
      logTeam(draft, team.id, {
        kind: "event",
        actor: actor.name,
        message: `Secret découvert : « ${egg.name} » ! Vous gagnez ${reward}.`,
      });
      announce(draft, "Une équipe a découvert un secret…");
    },
  }),
];
