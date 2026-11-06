import { type ProductId, productIds, productionRules } from "@etic/content";
import type { MachineState } from "@etic/engine";
import { useForm, useStore } from "@tanstack/react-form";
import {
  CircleCheck,
  CircleX,
  Info,
  ListPlus,
  Lock,
  type LucideIcon,
  TriangleAlert,
} from "lucide-react";
import { useId } from "react";
import { z } from "zod";
import { InfoTip } from "@/components/game/info-tip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGameCommand } from "@/lib/commands";
import { formatNumber, itemLabel, percent, timeLeft } from "@/lib/format";
import { useCanAct, useGame, useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import { toneText } from "./machine-status";
import {
  count,
  cyclesCovered,
  type MaterialLine,
  materialLines,
  ofItem,
  outputForecast,
  type ProductOption,
  productOptions,
  type Tone,
} from "./machines";

const DEFAULT_CYCLES = 10;
const MAX_CYCLES = productionRules.maxCyclesPerJob;

/** Same limits as the engine's production.setJob command. */
const jobSchema = z.object({
  productId: z.enum(productIds),
  cycles: z
    .int("Indiquez un nombre entier de cycles.")
    .min(1, "Programmez au moins un cycle.")
    .max(MAX_CYCLES, `${formatNumber(MAX_CYCLES)} cycles au maximum.`),
});

type JobValues = z.infer<typeof jobSchema>;

function errorText(errors: readonly unknown[]): string | undefined {
  const error = errors[0];
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return undefined;
}

/**
 * Queue editor of a machine (story 37): a product among the compatible ones and a number of
 * cycles, with a live preview of materials and output. Programming replaces the current
 * queue; the content mounts on every opening, so the form starts from the live machine.
 */
export function JobDialog({
  machine,
  name,
  open,
  onOpenChange,
}: {
  machine: MachineState;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const view = useView();
  const canAct = useCanAct();
  const options = productOptions(view.team, machine.typeId);
  const initialProduct =
    machine.job?.productId ??
    machine.cycle?.productId ??
    (options.find((option) => !option.lock) ?? options[0])?.productId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          disabled={!canAct || !initialProduct || options.every((option) => option.lock)}
        >
          <ListPlus aria-hidden />
          {machine.job ? "Modifier la file" : "Programmer"}
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display uppercase">Programmer « {name} »</DialogTitle>
          <DialogDescription>
            Choisissez un produit et un nombre de cycles : la machine les enchaîne tant qu'elle a
            des matières, des opérateurs et de la place.
          </DialogDescription>
        </DialogHeader>
        {initialProduct ? (
          <JobForm
            machine={machine}
            options={options}
            initialProduct={initialProduct}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function JobForm({
  machine,
  options,
  initialProduct,
  onDone,
}: {
  machine: MachineState;
  options: ProductOption[];
  initialProduct: ProductId;
  onDone: () => void;
}) {
  const { send, pending, canAct } = useGameCommand();
  const view = useView();
  const { msPerDay } = useGame();
  const baseId = useId();
  const defaultValues: JobValues = {
    productId: initialProduct,
    cycles: machine.job?.cyclesRemaining ?? DEFAULT_CYCLES,
  };
  const form = useForm({
    defaultValues,
    validators: { onChange: jobSchema },
    onSubmit: async ({ value }) => {
      const result = await send(
        "production.setJob",
        { machineId: machine.id, productId: value.productId, cycles: value.cycles },
        {
          success: `File programmée : ${count(value.cycles, "cycle")} ${ofItem(value.productId)}.`,
        },
      );
      if (result.ok) onDone();
    },
  });
  const values = useStore(form.store, (state) => state.values);
  const canSubmit = useStore(form.store, (state) => state.canSubmit);

  const option = options.find((candidate) => candidate.productId === values.productId);
  const cycles = Number.isInteger(values.cycles) && values.cycles > 0 ? values.cycles : 0;
  const lines = materialLines(view.team, machine, values.productId);
  const covered = Math.min(cyclesCovered(lines), MAX_CYCLES);
  const days = cycles * (option?.cycleDays ?? 0);
  const productLabelId = `${baseId}-product`;
  const cyclesId = `${baseId}-cycles`;

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="productId">
        {(field) => (
          <div className="grid gap-2">
            <Label id={productLabelId}>Produit</Label>
            <RadioGroup
              aria-labelledby={productLabelId}
              value={field.state.value}
              onValueChange={(value) => {
                const next = options.find((candidate) => candidate.productId === value);
                if (next) field.handleChange(next.productId);
              }}
              className={cn("grid gap-2", options.length > 1 && "sm:grid-cols-2")}
            >
              {options.map((candidate) => (
                <ProductChoice
                  key={candidate.productId}
                  id={`${baseId}-${candidate.productId}`}
                  option={candidate}
                  selected={candidate.productId === field.state.value}
                  disabled={!canAct || candidate.lock !== null}
                />
              ))}
            </RadioGroup>
          </div>
        )}
      </form.Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="cycles">
          {(field) => {
            const message = errorText(field.state.meta.errors);
            return (
              <div className="grid content-start gap-1.5">
                <Label htmlFor={cyclesId}>Nombre de cycles</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={cyclesId}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_CYCLES}
                    step={1}
                    className="tabular w-28"
                    value={Number.isNaN(field.state.value) ? "" : field.state.value}
                    onChange={(event) => field.handleChange(event.target.valueAsNumber)}
                    onBlur={field.handleBlur}
                    aria-invalid={Boolean(message)}
                    aria-describedby={`${cyclesId}-hint`}
                    disabled={!canAct}
                  />
                  {covered > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!canAct}
                      onClick={() => field.handleChange(covered)}
                    >
                      Selon le stock ({formatNumber(covered)})
                    </Button>
                  ) : null}
                </div>
                <p
                  id={`${cyclesId}-hint`}
                  className={cn("text-xs", message ? "text-destructive" : "text-muted-foreground")}
                >
                  {message ??
                    `Durée : ${count(days, "jour")} (${timeLeft(days, msPerDay)}) si rien ne bloque.`}
                </p>
              </div>
            );
          }}
        </form.Field>
        <OutputPreview machine={machine} productId={values.productId} cycles={cycles} />
      </div>

      <MaterialsPreview lines={lines} cycles={cycles} covered={covered} />
      <QueueNotes machine={machine} />

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Annuler
          </Button>
        </DialogClose>
        <Button
          type="submit"
          disabled={!canAct || pending || !canSubmit || !option || !!option.lock}
        >
          {machine.job ? "Remplacer la file" : "Programmer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ProductChoice({
  id,
  option,
  selected,
  disabled,
}: {
  id: string;
  option: ProductOption;
  selected: boolean;
  disabled: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
        option.lock ? "cursor-not-allowed bg-muted/40" : "cursor-pointer hover:bg-muted/40",
        selected && "border-primary ring-1 ring-primary",
      )}
    >
      <RadioGroupItem id={id} value={option.productId} disabled={disabled} className="mt-0.5" />
      <span className="grid min-w-0 gap-1">
        <span className="font-medium">
          {option.name}{" "}
          <span className="text-xs font-normal text-muted-foreground">· palier {option.tier}</span>
        </span>
        <span className="tabular text-xs text-muted-foreground">
          {count(option.outputPerCycle, "unité")} par cycle de {count(option.cycleDays, "jour")}
        </span>
        <span className="text-xs text-muted-foreground">Par unité : {option.recipe}</span>
        {option.lock ? (
          <span className="flex items-start gap-1 text-xs text-warning">
            <Lock className="mt-px size-3 shrink-0" aria-hidden />
            {option.lock.reason}
          </span>
        ) : null}
      </span>
    </label>
  );
}

/** Units per cycle from the machine and operators' efficiency (story 39). */
function OutputPreview({
  machine,
  productId,
  cycles,
}: {
  machine: MachineState;
  productId: ProductId;
  cycles: number;
}) {
  const view = useView();
  const forecast = outputForecast(view.team, machine, productId, view.clock.time.day);
  return (
    <div className="space-y-1 rounded-lg border p-3">
      <div className="flex items-center gap-1.5">
        <span className="eyebrow text-muted-foreground">Production par cycle</span>
        <InfoTip term="output" />
      </div>
      {forecast.ready ? (
        <>
          <p className="tabular text-2xl font-semibold">{count(forecast.perCycle, "unité")}</p>
          <p className="tabular text-xs text-muted-foreground">
            {formatNumber(forecast.nominal)} prévues × {percent(forecast.machineEfficiency)} machine
            × {percent(forecast.workforceEfficiency)} opérateurs
            {forecast.bonus !== 1 ? ` × ${percent(forecast.bonus)} bonus` : ""}
          </p>
          {cycles > 0 ? (
            <p className="pt-1 text-sm">
              File complète ≈{" "}
              <span className="tabular font-semibold">
                {count(cycles * forecast.perCycle, "unité")}
              </span>
              <span className="block text-xs text-muted-foreground">
                L'usure réduit un peu les cycles suivants.
              </span>
            </p>
          ) : null}
        </>
      ) : (
        <p className="flex items-start gap-1.5 pt-1 text-sm text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {forecast.present} / {forecast.required} opérateurs présents : la machine attendra d'en
            avoir {forecast.required} pour démarrer.
          </span>
        </p>
      )}
    </div>
  );
}

type StockState = "short" | "partial" | "ok";

const stockStates: Record<StockState, { tone: Tone; icon: LucideIcon; label: string }> = {
  short: { tone: "danger", icon: CircleX, label: "insuffisant pour un cycle" },
  partial: { tone: "warning", icon: TriangleAlert, label: "couvre une partie de la file" },
  ok: { tone: "success", icon: CircleCheck, label: "suffisant" },
};

function coverageOf(covered: number, cycles: number): { state: StockState; text: string } {
  if (covered === 0) {
    return {
      state: "short",
      text: "Stock insuffisant pour lancer un cycle : la machine attendra des matières.",
    };
  }
  if (covered < cycles) {
    return {
      state: "partial",
      text: `Le stock couvre ${count(covered, "cycle")} sur ${formatNumber(cycles)} : la machine attendra ensuite des matières.`,
    };
  }
  return { state: "ok", text: "Le stock couvre toute la file." };
}

/** Materials consumed at the start of each cycle, against the warehouse. */
function MaterialsPreview({
  lines,
  cycles,
  covered,
}: {
  lines: MaterialLine[];
  cycles: number;
  covered: number;
}) {
  const incoming = lines.filter((line) => line.incoming);
  const coverage = coverageOf(covered, cycles);
  const coverageState = stockStates[coverage.state];
  const CoverageIcon = coverageState.icon;

  return (
    <div className="space-y-2">
      <span className="eyebrow text-muted-foreground">Matières consommées au lancement</span>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Matière</TableHead>
            <TableHead className="text-right">Par cycle</TableHead>
            <TableHead className="text-right">Pour {count(cycles, "cycle")}</TableHead>
            <TableHead className="text-right">En stock</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => {
            const total = line.perCycle * cycles;
            const state =
              stockStates[
                line.inStock < line.perCycle ? "short" : line.inStock < total ? "partial" : "ok"
              ];
            const Icon = state.icon;
            return (
              <TableRow key={line.item}>
                <TableCell>{itemLabel(line.item)}</TableCell>
                <TableCell className="tabular text-right">{formatNumber(line.perCycle)}</TableCell>
                <TableCell className="tabular text-right">{formatNumber(total)}</TableCell>
                <TableCell className="text-right">
                  <span
                    className={cn(
                      "tabular inline-flex items-center justify-end gap-1",
                      toneText[state.tone],
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden />
                    {formatNumber(line.inStock)}
                    <span className="sr-only">, {state.label}</span>
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {cycles > 0 || covered === 0 ? (
        <p className={cn("flex items-start gap-1.5 text-sm", toneText[coverageState.tone])}>
          <CoverageIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {coverage.text}
        </p>
      ) : null}
      {incoming.length > 0 ? (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {incoming.map((line) =>
            line.incoming ? (
              <li key={line.item}>
                Livraison attendue : {formatNumber(line.incoming.quantity)} × {itemLabel(line.item)}
                {line.incoming.waitingSpace
                  ? ", arrivée mais en attente de place dans l'entrepôt."
                  : ` le jour ${line.incoming.arrivesOnDay}.`}
              </li>
            ) : null,
          )}
        </ul>
      ) : null}
    </div>
  );
}

/** What programming changes for a machine that is busy or held up. */
function QueueNotes({ machine }: { machine: MachineState }) {
  const notes: string[] = [];
  if (machine.job) {
    notes.push(
      `Remplace la file actuelle : ${count(machine.job.cyclesRemaining, "cycle")} ${ofItem(machine.job.productId)}.`,
    );
  }
  if (machine.cycle) {
    notes.push(
      `Le cycle ${ofItem(machine.cycle.productId)} en cours se termine d'abord ; sa quantité ne change pas.`,
    );
  }
  if (machine.maintenanceUntilDay !== null) {
    notes.push(
      `La file démarrera à la fin de la maintenance, le jour ${machine.maintenanceUntilDay}.`,
    );
  }
  if (machine.stoppedUntilDay !== null) {
    notes.push(`La file démarrera après l'arrêt forcé, le jour ${machine.stoppedUntilDay}.`);
  }
  if (notes.length === 0) return null;
  return (
    <ul className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
      {notes.map((note) => (
        <li key={note} className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          {note}
        </li>
      ))}
    </ul>
  );
}
