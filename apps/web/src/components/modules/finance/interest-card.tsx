import { financeRules } from "@etic/content";
import { CalendarClock, CircleCheck, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { credits, dayLabel, percent, timeLeft } from "@/lib/format";
import { useGame, useView } from "@/lib/game";
import {
  availableOf,
  type Balance,
  daysUntil,
  type InterestOutlook,
  inDaysLabel,
  interestOutlook,
  unpaidInterest,
} from "./finance-math";

/** What the next interest day will cost, and whether the cash will cover it (story 107). */
function InterestDue({ balance, outlook }: { balance: Balance; outlook: InterestOutlook }) {
  if (balance.debt <= 0) {
    return (
      <p className="flex items-start gap-2 text-sm">
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
        Aucune dette : rien à payer à cette échéance.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className="text-muted-foreground">Montant prévu</span>
        <span className="tabular text-lg font-semibold">{credits(outlook.amount)}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {percent(financeRules.interestRate)} de votre dette actuelle ({credits(balance.debt)}) : le
        montant change si vous empruntez ou remboursez d'ici là.
      </p>
      {outlook.covered ? (
        <p className="flex items-start gap-2 text-sm">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          Prélevé automatiquement sur votre trésorerie disponible.
        </p>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="font-medium text-warning">Trésorerie disponible insuffisante</p>
            <p className="text-muted-foreground">
              Avec {credits(availableOf(balance))} disponibles, ces intérêts seraient ajoutés à
              votre dette et produiraient à leur tour des intérêts.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Next interest day (N12: every 30 days) and how interest works (R16, story 107). */
export function InterestCard({ balance }: { balance: Balance }) {
  const { team, clock } = useView();
  const { msPerDay } = useGame();
  const outlook = interestOutlook(
    balance,
    team.finance.nextInterestDay,
    clock.time.day,
    clock.endDay,
  );
  const { interestRate, interestEveryDays } = financeRules;
  const ended = clock.status === "ended";
  const noMoreInterest = ended || outlook.afterEnd;
  const paid = Math.max(0, -(team.finance.totals.interest ?? 0));
  const unpaid = unpaidInterest(balance);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground" role="heading" aria-level={2}>
          Intérêts
        </CardTitle>
        <CardDescription>
          {percent(interestRate)} de la dette, prélevés tous les {interestEveryDays} jours.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <p className="eyebrow text-muted-foreground">Prochaine échéance</p>
              {noMoreInterest ? (
                <p className="mt-1 text-sm">
                  {ended
                    ? "Partie terminée : plus aucun intérêt ne sera prélevé."
                    : `La partie se termine le jour ${clock.endDay}, avant l'échéance du jour ${outlook.day} : plus aucun intérêt à payer.`}
                </p>
              ) : (
                <>
                  <p className="tabular mt-1 text-2xl font-semibold">{dayLabel(outlook.day)}</p>
                  <p className="tabular text-sm text-muted-foreground">
                    {inDaysLabel(outlook.inDays)} ·{" "}
                    {timeLeft(daysUntil(outlook.day, clock.time, clock.stepsPerDay), msPerDay)}
                  </p>
                </>
              )}
            </div>
          </div>
          {noMoreInterest ? null : <InterestDue balance={balance} outlook={outlook} />}
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="eyebrow text-muted-foreground">Bon à savoir</p>
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            <li>Les intérêts sont prélevés automatiquement sur la trésorerie disponible.</li>
            <li>
              Faute de trésorerie disponible, ils s'ajoutent à la dette, même au-delà du plafond, et
              produisent à leur tour des intérêts.
            </li>
            <li>
              Un remboursement règle d'abord ces intérêts impayés, puis le capital, ce qui libère
              votre capacité d'emprunt.
            </li>
            <li>
              <span className="font-semibold">À la fin, seule la trésorerie nette compte</span>{" "}
              (trésorerie − dette) : emprunter ne l'augmente pas, les intérêts la réduisent.
            </li>
          </ul>
        </div>

        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Intérêts prélevés depuis le début</dt>
          <dd className="tabular text-right font-medium">{credits(paid)}</dd>
          <dt className="text-muted-foreground">Intérêts impayés dans la dette</dt>
          <dd className="tabular text-right font-medium">{credits(unpaid)}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}
