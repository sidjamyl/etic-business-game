import { hrRules, impactRules } from "@etic/content";
import { availableCash, type Employee } from "@etic/engine";
import { UserMinus } from "lucide-react";
import { ConfirmDialog } from "@/components/game/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useGameCommand } from "@/lib/commands";
import { credits, percent, regionName, signedCredits } from "@/lib/format";
import { useView } from "@/lib/game";
import {
  formatScore,
  groupWageChanges,
  jobCount,
  type LayoffPreview,
  layoffPreview,
  machineNames,
  ofPlace,
  plural,
  wagesDueOn,
} from "./team-math";

function layoffConsequences({
  preview,
  social,
  payday,
  dueNow,
  machines,
  region,
}: {
  preview: LayoffPreview;
  social: number;
  payday: number;
  dueNow: number;
  machines: string[];
  region: string;
}): string[] {
  const lines = [
    `Indemnités : ${credits(preview.severance)}, payées tout de suite (${percent(hrRules.severanceMonths)} du salaire mensuel par personne).`,
    `Indicateur social : ${formatScore(social)} → ${formatScore(preview.socialAfter)} (−${impactRules.penalties.perLayoff} points par licenciement).`,
    preview.nextPayrollSaving > 0
      ? `Masse salariale : ${signedCredits(-preview.monthlySaving)} par ${hrRules.payrollEveryDays} jours ; paie du jour ${payday} : ${credits(dueNow)} → ${credits(dueNow - preview.nextPayrollSaving)}.`
      : `Masse salariale : ${signedCredits(-preview.monthlySaving)} par ${hrRules.payrollEveryDays} jours.`,
  ];
  if (machines.length > 0) {
    lines.push(
      `${machines.length > 1 ? "Ces machines perdent des opérateurs et peuvent" : "Cette machine perd des opérateurs et peut"} s'arrêter : ${machines.join(", ")}.`,
    );
  }
  lines.push(`Les personnes licenciées retournent au bassin d'emploi ${ofPlace(region)}.`);
  return lines;
}

/** Who leaves, grouped by job and wage, with the severance each person receives. */
function LaidOffList({ employees }: { employees: Employee[] }) {
  const groups = groupWageChanges(employees, (wage) => wage * hrRules.severanceMonths);
  return (
    <div className="rounded-lg border">
      <p className="eyebrow border-b px-3 py-2 text-muted-foreground">Personnes licenciées</p>
      <ul className="divide-y text-sm">
        {groups.map((group) => (
          <li
            key={`${group.job}:${group.before}`}
            className="flex items-center justify-between gap-4 px-3 py-1.5"
          >
            <span>
              {jobCount(group.job, group.count)}{" "}
              <span className="tabular text-muted-foreground">
                à {credits(group.before)} / {hrRules.payrollEveryDays} j
              </span>
            </span>
            <span className="tabular">
              {credits(group.after)} d'indemnité{group.count > 1 ? " chacun" : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Layoff of the selected employees (R6, story 50): severance and social cost, then confirmed. */
export function LayoffAction({ employees }: { employees: Employee[] }) {
  const view = useView();
  const { send, pending, canAct } = useGameCommand();
  const { team, impact } = view;
  const payday = team.hr.nextPayrollDay;
  const preview = layoffPreview(employees, payday, impact.social);
  const available = availableCash(team);
  const affordable = preview.severance <= available;
  const locked = !canAct || pending;
  const names = machineNames(team.machines);
  const count = employees.length;
  const people = plural(count, "employé");

  async function confirm(): Promise<boolean> {
    if (count === 0) return false;
    const result = await send(
      "hr.layoff",
      { employeeIds: employees.map((employee) => employee.id) },
      {
        success: `${plural(count, "employé licencié", "employés licenciés")} : ${credits(preview.severance)} d'indemnités.`,
      },
    );
    return result.ok;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ConfirmDialog
        tone="danger"
        trigger={
          <Button
            size="sm"
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={locked || count === 0 || !affordable}
          >
            <UserMinus aria-hidden />
            Licencier…
          </Button>
        }
        title={`Licencier ${people}`}
        description="Décision irréversible : les personnes licenciées quittent l'entreprise immédiatement."
        consequences={layoffConsequences({
          preview,
          social: impact.social,
          payday,
          dueNow: wagesDueOn(Object.values(team.employees), payday),
          machines: preview.machineIds.map((id) => names.get(id) ?? "machine"),
          region: regionName(team.region),
        })}
        confirmLabel={`Licencier et payer ${credits(preview.severance)}`}
        onConfirm={confirm}
      >
        <LaidOffList employees={employees} />
      </ConfirmDialog>
      {count > 0 && !affordable ? (
        <p className="text-xs text-destructive">
          Indemnités de {credits(preview.severance)} : trésorerie disponible insuffisante (
          {credits(available)}).
        </p>
      ) : null}
    </div>
  );
}
