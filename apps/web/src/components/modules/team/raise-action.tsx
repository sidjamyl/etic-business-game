import { hrRules } from "@etic/content";
import type { Employee } from "@etic/engine";
import { TrendingUp } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/game/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGameCommand } from "@/lib/commands";
import { credits, signedCredits } from "@/lib/format";
import { useView } from "@/lib/game";
import {
  jobCount,
  parseRaisePercent,
  percentValue,
  plural,
  type RaisePreview,
  raisePreview,
  type WageChange,
  wagesDueOn,
} from "./team-math";

/** Old and new wages, one line per job and wage. */
function WageChanges({ title, changes }: { title: string; changes: WageChange[] }) {
  return (
    <div className="rounded-lg border">
      <p className="eyebrow border-b px-3 py-2 text-muted-foreground">{title}</p>
      <ul className="divide-y text-sm">
        {changes.map((change) => (
          <li
            key={`${change.job}:${change.before}`}
            className="flex items-center justify-between gap-4 px-3 py-1.5"
          >
            <span>{jobCount(change.job, change.count)}</span>
            <span className="tabular">
              {credits(change.before)} →{" "}
              <span className="font-semibold">{credits(change.after)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function raiseConsequences(preview: RaisePreview, payday: number, dueNow: number): string[] {
  const lines = [
    `Masse salariale : ${signedCredits(preview.monthlyIncrease)} par ${hrRules.payrollEveryDays} jours.`,
  ];
  if (preview.nextPayrollIncrease > 0) {
    lines.push(
      `Paie du jour ${payday} : ${credits(dueNow)} → ${credits(dueNow + preview.nextPayrollIncrease)}.`,
    );
  }
  lines.push(
    `Le délai de ${hrRules.raiseGraceDays} jours sans augmentation repart de zéro ; le rendement remonte progressivement jusqu'à 100 %.`,
    "Un salaire au-dessus de la base régionale améliore votre indicateur social.",
  );
  return lines;
}

/** Raise for the selected employees (R6, story 48): previewed, then confirmed. */
export function RaiseAction({ employees, onDone }: { employees: Employee[]; onDone: () => void }) {
  const view = useView();
  const { send, pending, canAct } = useGameCommand();
  const [raw, setRaw] = useState("10");
  const parsed = parseRaisePercent(raw);
  const { team } = view;
  const payday = team.hr.nextPayrollDay;
  const locked = !canAct || pending;
  const preview = parsed.value === null ? null : raisePreview(employees, parsed.value, payday);
  const dueNow = wagesDueOn(Object.values(team.employees), payday);
  const showError = parsed.error !== null && raw.trim() !== "";
  const label = parsed.value === null ? "" : percentValue(parsed.value);
  const people = plural(employees.length, "employé");

  async function confirm(): Promise<boolean> {
    if (parsed.value === null || employees.length === 0) return false;
    const result = await send(
      "hr.raise",
      { employeeIds: employees.map((employee) => employee.id), percent: parsed.value },
      { success: `Augmentation de ${label} accordée à ${people}.` },
    );
    if (!result.ok) return false;
    onDone();
    return true;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor="raise-percent">
        Augmentation<span className="sr-only"> en pourcentage</span>
      </Label>
      <div className="flex items-center gap-1.5">
        <Input
          id="raise-percent"
          type="number"
          inputMode="decimal"
          min={hrRules.minRaisePercent}
          max={hrRules.maxRaisePercent}
          step={1}
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          disabled={locked}
          aria-invalid={showError}
          aria-describedby={showError ? "raise-percent-error" : undefined}
          className="tabular h-8 w-20"
        />
        <span className="text-sm text-muted-foreground">%</span>
      </div>
      <ConfirmDialog
        trigger={
          <Button size="sm" disabled={locked || preview === null || employees.length === 0}>
            <TrendingUp aria-hidden />
            Augmenter…
          </Button>
        }
        title={`Augmenter ${people} de ${label}`}
        description="Une augmentation est définitive : un salaire ne baisse jamais."
        consequences={preview ? raiseConsequences(preview, payday, dueNow) : []}
        confirmLabel={`Augmenter de ${label}`}
        onConfirm={confirm}
      >
        {preview ? (
          <WageChanges
            title={`Nouveaux salaires, par ${hrRules.payrollEveryDays} jours`}
            changes={preview.changes}
          />
        ) : null}
      </ConfirmDialog>
      {showError ? (
        <p id="raise-percent-error" className="w-full text-xs text-destructive">
          {parsed.error}
        </p>
      ) : null}
    </div>
  );
}
