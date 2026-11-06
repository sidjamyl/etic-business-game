import { financeRules } from "@etic/content";
import { borrowingCapacity } from "@etic/engine";
import { HandCoins, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/game/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useGameCommand } from "@/lib/commands";
import { credits, percent } from "@/lib/format";
import { useView } from "@/lib/game";
import { AmountField } from "./amount-field";
import {
  afterBorrow,
  availableOf,
  type Balance,
  blockedReason,
  borrowError,
  canBorrow,
  capacityWith,
  interestOn,
  isValidAmount,
  netCashOf,
  readAmount,
  unpaidInterest,
} from "./finance-math";
import { LoanPreview, type PreviewRow } from "./loan-preview";

/** Why no loan is possible: the ceiling is reached (R16, N12). */
function CeilingReached({ balance, capacity }: { balance: Balance; capacity: number }) {
  const unpaid = unpaidInterest(balance);
  const situation =
    capacity > 0
      ? `Il reste ${credits(capacity)} sous le plafond, moins que l'emprunt minimum de ${credits(financeRules.minLoan)}.`
      : `Vous avez emprunté ${credits(balance.principal)}, le maximum autorisé.`;
  const advice =
    unpaid > 0
      ? `Remboursez une partie du capital pour emprunter de nouveau : les ${credits(unpaid)} d'intérêts impayés sont remboursés en premier.`
      : "Remboursez une partie du capital pour emprunter de nouveau.";
  return (
    <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium text-warning">Aucun nouvel emprunt possible</p>
        <p className="text-muted-foreground">
          {situation} {advice}
        </p>
      </div>
    </div>
  );
}

/** Borrowing up to the ceiling (R16, story 106). Binding, so it is confirmed before sending. */
export function BorrowForm({ balance }: { balance: Balance }) {
  const { team, clock } = useView();
  const { send, pending, canAct } = useGameCommand();
  const [raw, setRaw] = useState("");
  const capacity = borrowingCapacity(team);

  if (!canBorrow(capacity)) return <CeilingReached balance={balance} capacity={capacity} />;

  const { minLoan, interestRate, interestEveryDays } = financeRules;
  const input = readAmount(raw, (amount) => borrowError(amount, capacity));
  const valid = isValidAmount(input);
  // The typed amount stays the same while the confirmation is open (the field is behind it).
  const amount = input.amount ?? 0;
  const after = valid ? afterBorrow(balance, amount) : null;
  const dueDay = team.finance.nextInterestDay;
  const interestAhead = clock.endDay === null || dueDay <= clock.endDay;
  const locked = !canAct || pending;
  const reason = blockedReason(clock.status);
  const debtAfter = balance.debt + amount;

  const rows: PreviewRow[] = [
    {
      label: "Trésorerie disponible",
      now: credits(availableOf(balance)),
      after: after && credits(availableOf(after)),
    },
    { label: "Dette", now: credits(balance.debt), after: after && credits(after.debt) },
    ...(interestAhead
      ? [
          {
            label: `Intérêts du jour ${dueDay}`,
            now: credits(interestOn(balance.debt)),
            after: after && credits(interestOn(after.debt)),
          },
        ]
      : []),
    {
      label: "Capacité d'emprunt",
      now: credits(capacity),
      after: after && credits(capacityWith(team, after.principal)),
    },
  ];

  return (
    <form onSubmit={(event) => event.preventDefault()} noValidate className="space-y-4">
      <AmountField
        label="Montant à emprunter"
        value={raw}
        onChange={setRaw}
        disabled={locked}
        error={input.error}
        hint={`De ${credits(minLoan)} à ${credits(capacity)}.`}
        min={minLoan}
        max={capacity}
        quickFill={{ label: "Maximum", amount: capacity }}
      />
      <LoanPreview
        caption="Effet de l'emprunt sur vos finances"
        rows={rows}
        note={`Votre trésorerie nette ne bouge pas (${credits(netCashOf(balance))}) : l'emprunt s'ajoute autant à la trésorerie qu'à la dette.`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <ConfirmDialog
          trigger={
            <Button type="submit" disabled={locked || !valid}>
              <HandCoins aria-hidden />
              {valid ? `Emprunter ${credits(amount)}` : "Emprunter"}
            </Button>
          }
          title={`Emprunter ${credits(amount)} ?`}
          description="Vous pourrez rembourser à tout moment, en une ou plusieurs fois."
          consequences={[
            `${credits(amount)} versés tout de suite sur votre trésorerie.`,
            `Dette portée de ${credits(balance.debt)} à ${credits(debtAfter)}.`,
            interestAhead
              ? `Intérêts de ${percent(interestRate)} de la dette tous les ${interestEveryDays} jours : environ ${credits(interestOn(debtAfter))} le jour ${dueDay}.`
              : "Plus aucun intérêt à payer d'ici la fin de la partie.",
            "À la fin, la dette restante est déduite de votre trésorerie : seule la trésorerie nette compte.",
          ]}
          confirmLabel={`Emprunter ${credits(amount)}`}
          onConfirm={async () => {
            const result = await send(
              "finance.borrow",
              { amount },
              { success: `Emprunt de ${credits(amount)} versé sur votre trésorerie.` },
            );
            if (result.ok) setRaw("");
            return result.ok;
          }}
        />
        {reason ? <p className="text-xs text-muted-foreground">{reason}</p> : null}
      </div>
    </form>
  );
}
