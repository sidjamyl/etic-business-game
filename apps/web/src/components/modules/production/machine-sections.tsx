import { productionRules } from "@etic/content";
import type { MachineState } from "@etic/engine";
import { Lock, TriangleAlert, Warehouse } from "lucide-react";
import { InfoTip } from "@/components/game/info-tip";
import { Progress } from "@/components/ui/progress";
import { formatNumber, itemLabel, percent, timeLeft } from "@/lib/format";
import { useGame, useView } from "@/lib/game";
import type { GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";
import { toneBar, toneText } from "./machine-status";
import {
  count,
  cycleProgress,
  efficiencyTone,
  machineCrew,
  ofItem,
  outputForecast,
  productOptions,
} from "./machines";

const wearPoints = formatNumber(productionRules.wearPerDay * 100);

/** Small uppercase heading of a card section, with its glossary tooltip. */
export function SectionTitle({ label, term }: { label: string; term?: GlossaryKey }) {
  return (
    <div className="flex items-center gap-1.5">
      <h3 className="eyebrow font-sans text-muted-foreground">{label}</h3>
      {term ? <InfoTip term={term} /> : null}
    </div>
  );
}

function Marker({ at }: { at: number }) {
  return (
    <span
      className="absolute -top-0.5 h-3 w-0.5 rounded-full bg-night/60"
      style={{ left: `calc(${at * 100}% - 1px)` }}
    />
  );
}

/** Current efficiency and its wear (stories 35, 40). */
export function EfficiencySection({ machine }: { machine: MachineState }) {
  const tone = efficiencyTone(machine.efficiency);
  const floor = productionRules.minEfficiency;
  return (
    <div className="space-y-2">
      <SectionTitle label="Rendement" term="machineEfficiency" />
      <p className={cn("tabular text-2xl font-semibold", toneText[tone])}>
        {percent(machine.efficiency)}
      </p>
      {/* Decorative: the percentage above carries the value; marks show floor and maintenance. */}
      <div aria-hidden className="relative h-2 rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width]", toneBar[tone])}
          style={{ width: `${machine.efficiency * 100}%` }}
        />
        <Marker at={floor} />
        <Marker at={productionRules.efficiencyAfterMaintenance} />
      </div>
      <p className="text-xs text-pretty text-muted-foreground">
        Usure : −{wearPoints} point par jour de marche, jusqu'à {percent(floor)}. Maintenance :
        retour à {percent(productionRules.efficiencyAfterMaintenance)}.
      </p>
      {machine.ranToday && machine.efficiency > floor ? (
        <p className="text-xs text-muted-foreground">
          A tourné aujourd'hui : −{wearPoints} point demain.
        </p>
      ) : null}
    </div>
  );
}

/** Operators at work against the minimum crew (story 36). */
export function CrewSection({ machine }: { machine: MachineState }) {
  const view = useView();
  const crew = machineCrew(view.team, machine, view.clock.time.day);
  const present = crew.present.length;
  const short = present < crew.required;
  return (
    <div className="space-y-2">
      <SectionTitle label="Opérateurs" term="workforceEfficiency" />
      <p
        className={cn(
          "tabular flex items-baseline gap-1.5 text-2xl font-semibold",
          short && "text-warning",
        )}
      >
        {short ? <TriangleAlert className="size-4 self-center" aria-hidden /> : null}
        {present} / {crew.required}
        <span className="text-sm font-normal text-muted-foreground">
          {present > 1 ? "présents" : "présent"}
          {short ? <span className="sr-only"> : il en manque</span> : null}
        </span>
      </p>
      <p className="text-xs text-muted-foreground">
        {present > 0
          ? `Rendement moyen : ${percent(crew.efficiency)}`
          : "Aucun opérateur au poste."}
      </p>
      {crew.enRoute.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {count(crew.enRoute.length, "autre en route", "autres en route")}, arrivée le jour{" "}
          {crew.nextArrivalDay}.
        </p>
      ) : null}
      {present > crew.required ? (
        <p className="text-xs text-muted-foreground">
          {count(present - crew.required, "opérateur", "opérateurs")} au-delà du minimum.
        </p>
      ) : null}
    </div>
  );
}

/** Cycle in progress with its fixed output, finished goods waiting, and the queue (37, 39). */
export function ProductionSection({ machine }: { machine: MachineState }) {
  const view = useView();
  const { msPerDay } = useGame();
  const progress = cycleProgress(machine, view.clock.stepsPerDay);
  const { job, pendingOutput } = machine;
  const next = job ? outputForecast(view.team, machine, job.productId, view.clock.time.day) : null;

  return (
    <div className="space-y-3 rounded-lg border bg-background/60 p-3">
      <SectionTitle label="Production" />
      {progress ? (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0">
              Cycle en cours : <span className="font-medium">{itemLabel(progress.productId)}</span>
            </span>
            <span className="tabular shrink-0 font-semibold">
              {count(progress.output, "unité")}
            </span>
          </div>
          <Progress
            value={progress.ratio * 100}
            className="h-1.5"
            aria-label={`Avancement du cycle ${ofItem(progress.productId)}`}
          />
          <p className="text-xs text-muted-foreground">
            {progress.paused
              ? "Cycle suspendu tant que la machine est bloquée."
              : `Fin dans ${timeLeft(progress.daysLeft, msPerDay)}.`}{" "}
            Quantité fixée au lancement du cycle.
          </p>
        </div>
      ) : null}

      {pendingOutput ? (
        <p className="flex items-start gap-2 text-sm">
          <Warehouse className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            <span className="tabular font-medium">
              {formatNumber(pendingOutput.quantity)} × {itemLabel(pendingOutput.productId)}
            </span>{" "}
            terminés, en attente de place dans l'entrepôt.
          </span>
        </p>
      ) : null}

      {job && next ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
          <span>
            File :{" "}
            <span className="font-medium">
              {count(job.cyclesRemaining, "cycle")} {ofItem(job.productId)}
            </span>{" "}
            à lancer
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {next.ready ? (
              <>
                ≈{" "}
                <span className="tabular text-sm font-semibold text-foreground">
                  {formatNumber(next.perCycle)}
                </span>{" "}
                par cycle au rendement actuel
              </>
            ) : (
              "Quantité connue dès que les opérateurs sont au complet"
            )}
            <InfoTip term="output" />
          </span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {progress || pendingOutput
            ? "File vide : la machine s'arrêtera après ce cycle."
            : "Aucune production programmée."}
        </p>
      )}
    </div>
  );
}

/** What the machine can make, how long a cycle lasts and its nominal output (story 35). */
export function CompatibleProducts({ machine }: { machine: MachineState }) {
  const view = useView();
  const options = productOptions(view.team, machine.typeId);
  if (options.length === 0) return null;
  return (
    <div className="space-y-1">
      <SectionTitle label="Produits compatibles" />
      <ul className="divide-y text-sm">
        {options.map((option) => (
          <li key={option.productId} className="flex items-center justify-between gap-3 py-1.5">
            <span
              className={cn(
                "flex min-w-0 items-center gap-1.5",
                option.lock && "text-muted-foreground",
              )}
            >
              {option.lock ? <Lock className="size-3.5 shrink-0" aria-hidden /> : null}
              <span className="truncate">{option.name}</span>
              {option.lock ? (
                <span className="shrink-0 text-xs">
                  <span className="sr-only">verrouillé, </span>({option.lock.short})
                </span>
              ) : null}
            </span>
            <span className="tabular shrink-0 text-xs text-muted-foreground">
              {count(option.outputPerCycle, "unité")} par cycle de {count(option.cycleDays, "jour")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
