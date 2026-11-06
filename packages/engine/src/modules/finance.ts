import { financeRules } from "@etic/content";
import { z } from "zod";
import { defineCommand } from "../commands.ts";
import { refuse } from "../errors.ts";
import { logTeam } from "../log.ts";
import type { GameSystem } from "../systems.ts";
import type { TeamState } from "../types.ts";
import { actingTeam, availableCash, credits, recordCash } from "./shared.ts";

/** Principal the team can still borrow (N12). */
export function borrowingCapacity(team: TeamState): number {
  return Math.max(0, financeRules.loanCap - team.finance.principal);
}

export const financeCommands = [
  defineCommand({
    type: "finance.borrow",
    actor: "team",
    schema: z.object({
      amount: z
        .int("Le montant doit être un nombre entier.")
        .min(financeRules.minLoan, `Empruntez au moins ${credits(financeRules.minLoan)}.`),
    }),
    apply: (draft, { amount }, actor) => {
      const team = actingTeam(draft, actor);
      const capacity = borrowingCapacity(team);
      if (amount > capacity) {
        refuse(
          "LOAN_LIMIT",
          capacity === 0
            ? "Plafond d'emprunt atteint."
            : `Plafond d'emprunt : vous pouvez encore emprunter ${credits(capacity)}.`,
        );
      }
      team.finance.debt += amount;
      team.finance.principal += amount;
      recordCash(draft, team, amount, "loan", "Emprunt bancaire");
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `Emprunt de ${credits(amount)} (dette : ${credits(team.finance.debt)}).`,
      });
    },
  }),

  defineCommand({
    type: "finance.repay",
    actor: "team",
    schema: z.object({
      amount: z.number().positive("Le montant doit être positif."),
    }),
    apply: (draft, { amount: requested }, actor) => {
      const team = actingTeam(draft, actor);
      const finance = team.finance;
      if (finance.debt === 0) refuse("INVALID_STATE", "Vous n'avez aucune dette.");
      if (requested > finance.debt) {
        refuse("INVALID_PAYLOAD", `Vous ne devez que ${credits(finance.debt)}.`);
      }
      const amount = Math.round(requested);
      if (amount > availableCash(team)) {
        refuse("INSUFFICIENT_FUNDS", `Trésorerie insuffisante : il faut ${credits(amount)}.`);
      }
      recordCash(draft, team, -amount, "repayment", "Remboursement bancaire");
      // Capitalized interest is repaid first, then the principal.
      finance.debt -= amount;
      finance.principal = Math.min(finance.principal, finance.debt);
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `Remboursement de ${credits(amount)} (dette : ${credits(finance.debt)}).`,
      });
    },
  }),
];

export const financeSystem: GameSystem = {
  name: "finance",
  onDay: (draft) => {
    for (const team of Object.values(draft.teams)) {
      const finance = team.finance;
      if (draft.time.day < finance.nextInterestDay) continue;
      finance.nextInterestDay += financeRules.interestEveryDays;
      const interest = Math.round(finance.debt * financeRules.interestRate);
      if (interest === 0) continue;
      if (availableCash(team) >= interest) {
        recordCash(draft, team, -interest, "interest", "Intérêts bancaires");
        logTeam(draft, team.id, {
          kind: "system",
          message: `Intérêts payés : ${credits(interest)}.`,
        });
      } else {
        // Unpaid interest is added to the debt, even beyond the ceiling (N12).
        finance.debt += interest;
        logTeam(draft, team.id, {
          kind: "event",
          message: `Intérêts impayés (${credits(interest)}) ajoutés à la dette : ${credits(finance.debt)}.`,
        });
      }
    }
  },
};
