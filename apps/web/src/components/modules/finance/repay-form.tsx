import { borrowingCapacity } from "@etic/engine";
import { CircleCheck, Undo2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { useGameCommand } from "@/lib/commands";
import { credits } from "@/lib/format";
import { useView } from "@/lib/game";
import { AmountField } from "./amount-field";
import {
  afterRepay,
  availableOf,
  type Balance,
  blockedReason,
  capacityWith,
  interestOn,
  isValidAmount,
  maxRepayment,
  netCashOf,
  readAmount,
  repayError,
  unpaidInterest,
} from "./finance-math";
import { LoanPreview, type PreviewRow } from "./loan-preview";

/** Rule shown under the amount: up to the debt, within the available cash. */
function repayHint(balance: Balance, max: number): string {
  if (max <= 0) return "Aucune trésorerie disponible pour rembourser pour l'instant.";
  if (max === balance.debt) return `Jusqu'à ${credits(max)}, toute votre dette.`;
  return `Jusqu'à ${credits(max)} : votre trésorerie disponible (dette : ${credits(balance.debt)}).`;
}

/** Repaying any amount at any time (R16, story 107): unpaid interest first, then principal. */
export function RepayForm({ balance }: { balance: Balance }) {
  const { team, clock } = useView();
  const { send, pending, canAct } = useGameCommand();
  const [raw, setRaw] = useState("");

  if (balance.debt <= 0) {
    return (
      <div className="flex items-start gap-2 rounded-lg border p-3 text-sm">
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
        <div>
          <p className="font-medium">Aucune dette</p>
          <p className="text-muted-foreground">Rien à rembourser : vous ne payez aucun intérêt.</p>
        </div>
      </div>
    );
  }

  const input = readAmount(raw, (amount) => repayError(amount, balance));
  const valid = isValidAmount(input);
  const amount = input.amount ?? 0;
  const after = valid ? afterRepay(balance, amount) : null;
  const max = maxRepayment(balance);
  const unpaid = unpaidInterest(balance);
  const dueDay = team.finance.nextInterestDay;
  const interestAhead = clock.endDay === null || dueDay <= clock.endDay;
  const locked = !canAct || pending;
  const reason = blockedReason(clock.status);

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
      now: credits(borrowingCapacity(team)),
      after: after && credits(capacityWith(team, after.principal)),
    },
  ];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || locked) return;
    const repaid = amount;
    const settled = repaid === balance.debt;
    const result = await send(
      "finance.repay",
      { amount: repaid },
      { success: settled ? "Dette entièrement remboursée." : `${credits(repaid)} remboursés.` },
    );
    if (result.ok) setRaw("");
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <AmountField
        label="Montant à rembourser"
        value={raw}
        onChange={setRaw}
        disabled={locked || max <= 0}
        error={input.error}
        hint={repayHint(balance, max)}
        min={1}
        max={Math.max(1, max)}
        quickFill={{ label: max === balance.debt ? "Tout rembourser" : "Maximum", amount: max }}
      />
      {unpaid > 0 ? (
        <p className="text-xs text-muted-foreground">
          Les {credits(unpaid)} d'intérêts impayés sont remboursés en premier, puis le capital, ce
          qui libère votre capacité d'emprunt.
        </p>
      ) : null}
      <LoanPreview
        caption="Effet du remboursement sur vos finances"
        rows={rows}
        note={`Votre trésorerie nette ne bouge pas (${credits(netCashOf(balance))}), mais rembourser tôt vous évite des intérêts.`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={locked || !valid}>
          <Undo2 aria-hidden />
          {valid ? `Rembourser ${credits(amount)}` : "Rembourser"}
        </Button>
        {reason ? <p className="text-xs text-muted-foreground">{reason}</p> : null}
      </div>
    </form>
  );
}
