import { hrRules } from "@etic/content";
import { AlertTriangle, Ban, CircleCheck, Info, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { credits } from "@/lib/format";
import { useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import { inDays, type PayrollOutlook, plural, type StrikeOutlook } from "./team-math";

interface Coverage {
  icon: LucideIcon;
  tone: string;
  text: string;
}

/** Whether the cash covers what is owed by the next payday (R6: a missed payroll = strike). */
function coverage(
  payroll: PayrollOutlook,
  strike: StrikeOutlook | null,
  available: number,
): Coverage {
  if (strike) {
    if (strike.shortfall === 0) {
      return {
        icon: CircleCheck,
        tone: "text-success",
        text: "Trésorerie suffisante : les arriérés seront réglés au début du jour suivant.",
      };
    }
    return {
      icon: Ban,
      tone: "text-destructive",
      text: `Grève en cours : il faut ${credits(strike.arrears)} disponibles pour payer les arriérés (il manque ${credits(strike.shortfall)}).`,
    };
  }
  if (payroll.due === 0) {
    return {
      icon: Info,
      tone: "text-muted-foreground",
      text: "Aucun salaire à verser pour l'instant.",
    };
  }
  if (payroll.shortfall === 0) {
    return {
      icon: CircleCheck,
      tone: "text-success",
      text: `Votre trésorerie disponible couvre la prochaine paie (${credits(available - payroll.due)} de marge).`,
    };
  }
  return {
    icon: AlertTriangle,
    tone: "text-warning",
    text: `Il manque ${credits(payroll.shortfall)} : sans rentrée d'argent d'ici le jour ${payroll.day}, vos employés se mettront en grève.`,
  };
}

/** Next payday, amount due against the available cash, arrears during a strike (stories 46, 49). */
export function PayrollCard({
  payroll,
  strike,
  available,
}: {
  payroll: PayrollOutlook;
  strike: StrikeOutlook | null;
  available: number;
}) {
  const { team } = useView();
  const elapsed = hrRules.payrollEveryDays - payroll.daysLeft;
  const progress = Math.min(100, Math.max(0, (elapsed / hrRules.payrollEveryDays) * 100));
  const status = coverage(payroll, strike, available);
  const StatusIcon = status.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground">Paie</CardTitle>
        <CardDescription>
          Versée automatiquement tous les {hrRules.payrollEveryDays} jours aux employés déjà
          arrivés.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Prochaine paie</p>
            <p className="tabular font-display text-2xl font-bold uppercase">Jour {payroll.day}</p>
          </div>
          <p className="tabular text-sm font-medium">{inDays(payroll.daysLeft)}</p>
        </div>
        <Progress
          value={progress}
          className="h-1.5"
          aria-label={`Cycle de paie : ${elapsed} jours écoulés sur ${hrRules.payrollEveryDays}`}
        />
        <dl className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-2 text-sm">
          <dt>
            Montant prévu
            <span className="block text-xs text-muted-foreground">
              {plural(payroll.paidCount, "employé payé", "employés payés")}
            </span>
          </dt>
          <dd className="tabular text-right text-base font-semibold">{credits(payroll.due)}</dd>
          {strike ? (
            <>
              <dt className="text-destructive">Arriérés de salaires</dt>
              <dd className="tabular text-right font-semibold text-destructive">
                {credits(strike.arrears)}
              </dd>
            </>
          ) : null}
          <dt>
            Trésorerie disponible
            {team.reservedCash > 0 ? (
              <span className="block text-xs text-muted-foreground">
                {credits(team.reservedCash)} bloqués par vos enchères
              </span>
            ) : null}
          </dt>
          <dd className="tabular text-right font-medium">{credits(available)}</dd>
          <dt>
            Masse salariale
            <span className="block text-xs text-muted-foreground">
              Tous les salaires, recrues en route comprises
            </span>
          </dt>
          <dd className="tabular text-right font-medium">
            {credits(payroll.monthly)}
            <span className="font-normal text-muted-foreground">
              {" "}
              / {hrRules.payrollEveryDays} j
            </span>
          </dd>
        </dl>
        <p className={cn("flex items-start gap-2 text-sm", status.tone)}>
          <StatusIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{status.text}</span>
        </p>
      </CardContent>
    </Card>
  );
}
