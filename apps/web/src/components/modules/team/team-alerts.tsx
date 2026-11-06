import { impactRules } from "@etic/content";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Ban } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { credits } from "@/lib/format";
import { cn } from "@/lib/utils";
import { inDays, type PayrollOutlook, plural, type StrikeOutlook } from "./team-math";

function FinanceLink({ children }: { children: ReactNode }) {
  return (
    <Link
      to="/play/finance"
      className="inline-flex items-center gap-1 font-medium underline underline-offset-4 hover:text-power-red"
    >
      {children}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

function Figure({
  label,
  value,
  hint,
  tone = "text-destructive",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-destructive/25 bg-card px-3 py-2">
      <dt className="eyebrow text-muted-foreground">{label}</dt>
      <dd className={cn("tabular text-lg font-semibold", tone)}>{value}</dd>
      {hint ? <dd className="text-xs text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Who resigns at the deadline (N25): the staff hired before the strike started. */
function leavingPhrase(leaving: number, staff: number): string {
  if (leaving === 0) return "la grève se terminera par une démission collective";
  const verb = leaving > 1 ? "démissionneront ensemble" : "démissionnera";
  if (leaving === staff) {
    return staff === 1 ? `votre employé ${verb}` : `vos ${staff} employés ${verb}`;
  }
  return `${plural(leaving, "employé recruté", "employés recrutés")} avant la grève ${verb}`;
}

/**
 * Strike in progress (R6, N25): what it blocks, the arrears, the cash still missing and the
 * countdown to the collective resignation.
 */
export function StrikeAlert({ strike, staff }: { strike: StrikeOutlook; staff: number }) {
  const unpaid =
    strike.startDay === null
      ? "La paie n'a pas pu être versée"
      : `La paie du jour ${strike.startDay} n'a pas pu être versée`;
  const deadline = strike.resignationDay === null ? "" : ` au jour ${strike.resignationDay}`;
  return (
    <Alert className="border-destructive/50 bg-destructive/5 text-destructive">
      <Ban aria-hidden />
      <AlertTitle className="font-display text-base font-bold uppercase">
        Vos employés sont en grève
      </AlertTitle>
      <AlertDescription className="gap-3 text-foreground">
        <p>{`${unpaid} : production et expéditions sont à l'arrêt jusqu'au paiement des arriérés.`}</p>
        <dl className="grid w-full gap-3 md:grid-cols-3">
          <Figure label="Arriérés de salaires" value={credits(strike.arrears)} />
          {strike.shortfall > 0 ? (
            <Figure
              label="Il vous manque"
              value={credits(strike.shortfall)}
              hint="de trésorerie disponible"
            />
          ) : (
            <Figure
              label="Trésorerie"
              value="Suffisante"
              tone="text-success"
              hint="Arriérés réglés au début du jour suivant"
            />
          )}
          {strike.resignationDay !== null && strike.daysLeft !== null ? (
            <Figure
              label="Démission collective"
              value={capitalize(inDays(strike.daysLeft))}
              hint={`Jour ${strike.resignationDay}, si les arriérés restent impayés`}
            />
          ) : null}
        </dl>
        <p>
          {`Les arriérés sont payés automatiquement au début du jour suivant, dès que votre trésorerie disponible le permet. Sinon${deadline}, ${leavingPhrase(strike.leaving, staff)} : arriérés annulés et −${impactRules.penalties.perMassResignation} points sur l'indicateur social. Chaque jour de grève pèse aussi sur cet indicateur.`}
        </p>
        <FinanceLink>Trouver de la trésorerie (Finance)</FinanceLink>
      </AlertDescription>
    </Alert>
  );
}

/** The next payroll is not covered by the available cash: a strike is coming (story 49). */
export function PayrollWarning({
  payroll,
  available,
}: {
  payroll: PayrollOutlook;
  available: number;
}) {
  return (
    <Alert className="border-warning/50 bg-warning/5 text-warning">
      <AlertTriangle aria-hidden />
      <AlertTitle className="font-semibold">Paie du jour {payroll.day} non couverte</AlertTitle>
      <AlertDescription className="text-foreground">
        <p>
          Paie prévue {inDays(payroll.daysLeft)} : <strong>{credits(payroll.due)}</strong> ;
          trésorerie disponible : <strong>{credits(available)}</strong>. Sans{" "}
          <strong>{credits(payroll.shortfall)}</strong> de plus d'ici là, vos employés se mettront
          en grève et la production s'arrêtera.
        </p>
        <FinanceLink>Voir la trésorerie et les prêts</FinanceLink>
      </AlertDescription>
    </Alert>
  );
}
