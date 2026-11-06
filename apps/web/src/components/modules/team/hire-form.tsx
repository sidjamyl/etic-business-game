import { hrRules, type JobId, jobIds } from "@etic/content";
import { AlertTriangle, Ban, UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useGameCommand } from "@/lib/commands";
import { credits, regionName, signedCredits } from "@/lib/format";
import { useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import {
  inDays,
  isJobId,
  jobCount,
  jobLabels,
  MAX_HIRES,
  ofPlace,
  parseHireCount,
  plural,
  wagesDueOn,
} from "./team-math";

/** Next payroll once the recruits are there, against the available cash (story 49). */
function PayrollImpact({
  dueNow,
  extra,
  payday,
  arrivalDay,
  available,
}: {
  dueNow: number;
  extra: number;
  payday: number;
  arrivalDay: number;
  available: number;
}) {
  if (arrivalDay > payday) {
    return <>Recrues payées à partir du jour {payday + hrRules.payrollEveryDays}</>;
  }
  const after = dueNow + extra;
  return (
    <>
      {credits(dueNow)} → <span className="font-semibold">{credits(after)}</span>
      {after > available ? (
        <span className="mt-0.5 flex items-center gap-1 text-xs text-warning">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          Au-delà de votre trésorerie disponible ({credits(available)})
        </span>
      ) : null}
    </>
  );
}

/** Hiring in the regional labor pool (R6, stories 43–45). */
export function HireForm({ pool, available }: { pool: number; available: number }) {
  const view = useView();
  const { send, pending, canAct } = useGameCommand();
  const [job, setJob] = useState<JobId>("operator");
  const [rawCount, setRawCount] = useState("1");
  const { team, clock } = view;
  const region = regionName(team.region);
  const wage = view.wages[job];
  const parsed = parseHireCount(rawCount, pool);
  const count = parsed.value ?? 0;
  const showError = parsed.error !== null && rawCount.trim() !== "";
  const maxCount = Math.min(MAX_HIRES, pool);
  const arrivalDay = clock.time.day + hrRules.hiringDelayDays;
  const payday = team.hr.nextPayrollDay;
  const dueNow = wagesDueOn(Object.values(team.employees), payday);
  const onStrike = team.hr.unpaidWages > 0;
  const locked = !canAct || pending;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (parsed.value === null || locked) return;
    const hired = parsed.value;
    const result = await send(
      "hr.hire",
      { job, count: hired },
      {
        success: `${jobCount(job, hired)} ${hired > 1 ? "recrutés" : "recruté"} : arrivée ${inDays(hrRules.hiringDelayDays)}.`,
      },
    );
    if (result.ok) setRawCount("1");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground">Recruter</CardTitle>
        <CardDescription>
          Salaire de base {ofPlace(region)} (événements compris), versé tous les{" "}
          {hrRules.payrollEveryDays} jours. Les recrues arrivent{" "}
          {plural(hrRules.hiringDelayDays, "jour")} après leur recrutement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {team.region === null ? (
          <p className="text-sm text-muted-foreground">
            Le recrutement ouvre une fois votre région choisie.
          </p>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-5">
            <div className="space-y-2">
              <p id="hire-job-label" className="text-sm font-medium">
                Métier
              </p>
              <RadioGroup
                aria-labelledby="hire-job-label"
                value={job}
                onValueChange={(value) => {
                  if (isJobId(value)) setJob(value);
                }}
                disabled={locked}
                className="grid gap-3 sm:grid-cols-2"
              >
                {jobIds.map((id) => (
                  <label
                    key={id}
                    htmlFor={`hire-job-${id}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40",
                      job === id && "border-primary bg-primary/5 hover:bg-primary/5",
                    )}
                  >
                    <RadioGroupItem id={`hire-job-${id}`} value={id} className="mt-0.5" />
                    <span className="grid gap-0.5">
                      <span className="font-medium">{jobLabels[id].one}</span>
                      <span className="tabular text-sm">
                        {credits(view.wages[id])}
                        <span className="text-muted-foreground">
                          {" "}
                          / {hrRules.payrollEveryDays} j
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">{jobLabels[id].role}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {pool === 0 ? (
              <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <div>
                  <p className="font-medium text-warning">Bassin d'emploi épuisé</p>
                  <p className="text-muted-foreground">
                    Plus personne à recruter à {region}. Le bassin se reconstitue quand une
                    entreprise de la région licencie ou quand des employés démissionnent.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-[auto_1fr]">
                <div className="grid content-start gap-1.5">
                  <Label htmlFor="hire-count">Nombre de recrues</Label>
                  <Input
                    id="hire-count"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={maxCount}
                    step={1}
                    value={rawCount}
                    onChange={(event) => setRawCount(event.target.value)}
                    disabled={locked}
                    aria-invalid={showError}
                    aria-describedby="hire-count-hint"
                    className="tabular w-28"
                  />
                  <p
                    id="hire-count-hint"
                    className={cn(
                      "text-xs",
                      showError ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {showError ? parsed.error : `De 1 à ${maxCount} (bassin : ${pool})`}
                  </p>
                </div>
                <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-muted-foreground">Arrivée</dt>
                  <dd className="tabular">
                    Jour {arrivalDay} ({inDays(hrRules.hiringDelayDays)})
                  </dd>
                  <dt className="text-muted-foreground">Coût</dt>
                  <dd className="tabular">
                    {signedCredits(count * wage)} par {hrRules.payrollEveryDays} jours
                  </dd>
                  <dt className="text-muted-foreground">Paie du jour {payday}</dt>
                  <dd className="tabular">
                    <PayrollImpact
                      dueNow={dueNow}
                      extra={count * wage}
                      payday={payday}
                      arrivalDay={arrivalDay}
                      available={available}
                    />
                  </dd>
                </dl>
              </div>
            )}

            {onStrike ? (
              <p className="flex items-start gap-2 text-sm text-destructive">
                <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
                Grève en cours : les recrues ne travailleront pas non plus tant que les arriérés ne
                sont pas payés.
              </p>
            ) : null}

            <Button type="submit" disabled={locked || parsed.value === null}>
              <UserPlus aria-hidden />
              {parsed.value === null ? "Recruter" : `Recruter ${jobCount(job, parsed.value)}`}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
