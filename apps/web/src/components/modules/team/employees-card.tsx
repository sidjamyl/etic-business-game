import { hrRules, type JobId, jobIds } from "@etic/content";
import { BellRing, Users } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/game/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useView } from "@/lib/game";
import { type EmployeeGroup, EmployeesTable } from "./employees-table";
import { LayoffAction } from "./layoff-action";
import { RaiseAction } from "./raise-action";
import { isJobId, jobLabels, percentValue, plural, raiseOutlook, sortEmployees } from "./team-math";

type JobFilter = "all" | JobId;

function FilterCount({ value }: { value: number }) {
  return <span className="tabular opacity-70">{value}</span>;
}

/** The staff list with its job filter, selection and the raise / layoff actions (stories 47–50). */
export function EmployeesCard() {
  const view = useView();
  const day = view.clock.time.day;
  const [filter, setFilter] = useState<JobFilter>("all");
  const [selection, setSelection] = useState<ReadonlySet<string>>(() => new Set());

  const employees = sortEmployees(Object.values(view.team.employees));
  const visible = filter === "all" ? employees : employees.filter((e) => e.job === filter);
  // Ids of employees who left (layoff, resignation) simply drop out of the selection.
  const selected = visible.filter((employee) => selection.has(employee.id));
  const toRaise = visible.filter(
    (employee) => raiseOutlook(employee.lastRaiseDay, day).level !== "ok",
  );
  const toRaiseSelected =
    toRaise.length === selected.length && toRaise.every((employee) => selection.has(employee.id));
  const groups: EmployeeGroup[] = jobIds
    .map((job) => ({ job, employees: visible.filter((employee) => employee.job === job) }))
    .filter((group) => group.employees.length > 0);

  function select(ids: readonly string[], on: boolean) {
    setSelection((previous) => {
      const next = new Set(previous);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function clear() {
    setSelection(new Set());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground">Employés</CardTitle>
        <CardDescription>
          Sans augmentation pendant {hrRules.raiseGraceDays} jours, le rendement baisse par paliers.
          Une augmentation d'au moins {percentValue(hrRules.minRaisePercent)} relance le délai.
        </CardDescription>
        {employees.length > 0 ? (
          <CardAction>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={filter}
              onValueChange={(value) => {
                if (value === "all" || isJobId(value)) setFilter(value);
              }}
              aria-label="Filtrer par métier"
            >
              <ToggleGroupItem value="all">
                Tous <FilterCount value={employees.length} />
              </ToggleGroupItem>
              {jobIds.map((job) => (
                <ToggleGroupItem key={job} value={job}>
                  {jobLabels[job].many}{" "}
                  <FilterCount value={employees.filter((e) => e.job === job).length} />
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {employees.length === 0 ? (
          <EmptyState icon={Users} title="Aucun employé pour l'instant">
            Recrutez des opérateurs pour faire tourner vos machines et des logisticiens pour
            préparer vos expéditions.
          </EmptyState>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/40 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {selected.length > 0 ? (
                  <>
                    <span className="tabular font-medium">
                      {plural(selected.length, "employé sélectionné", "employés sélectionnés")}
                    </span>
                    <Button variant="ghost" size="xs" onClick={clear}>
                      Tout désélectionner
                    </Button>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    Cochez des employés pour les augmenter ou les licencier.
                  </span>
                )}
                {toRaise.length > 0 && !toRaiseSelected ? (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => setSelection(new Set(toRaise.map((employee) => employee.id)))}
                  >
                    <BellRing aria-hidden />
                    {toRaise.length === 1
                      ? "Sélectionner l'employé à augmenter"
                      : `Sélectionner les ${toRaise.length} employés à augmenter`}
                  </Button>
                ) : null}
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-3">
                <RaiseAction employees={selected} onDone={clear} />
                <Separator orientation="vertical" className="data-[orientation=vertical]:h-6" />
                <LayoffAction employees={selected} />
              </div>
            </div>
            <EmployeesTable groups={groups} selection={selection} onSelect={select} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
