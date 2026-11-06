import type { MachineState } from "@etic/engine";
import { Link } from "@tanstack/react-router";
import { CircleCheck, Sparkles, TriangleAlert, UserPlus, Users } from "lucide-react";
import { useId, useState } from "react";
import { InfoTip } from "@/components/game/info-tip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useGameCommand } from "@/lib/commands";
import { formatNumber, percent } from "@/lib/format";
import { useCanAct, useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import {
  autoFill,
  count,
  machineCrew,
  machineNames,
  machineTypeOf,
  type OperatorChoice,
  ofItem,
  operatorChoices,
  outputForecast,
  productOptions,
  transfers,
  withOperators,
} from "./machines";

/**
 * Assigns operators to a machine (story 36): the full crew is sent at once, operators taken
 * from another machine leave it, unticked ones become free. During a cycle only additions are allowed.
 */
export function OperatorsDialog({
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
  const canAct = useCanAct();
  const required = machineTypeOf(machine.typeId).operatorsRequired;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={!canAct}>
          <Users aria-hidden />
          Opérateurs
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display uppercase">Opérateurs de « {name} »</DialogTitle>
          <DialogDescription>
            {count(required, "opérateur présent est requis", "opérateurs présents sont requis")}{" "}
            pour lancer un cycle. Cochez l'équipe de cette machine ; les opérateurs décochés
            redeviennent libres, sauf pendant un cycle où seuls les ajouts sont autorisés.
          </DialogDescription>
        </DialogHeader>
        <OperatorsForm machine={machine} name={name} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function whereabouts(choice: OperatorChoice): string {
  const arrival = choice.present ? "" : ` · arrive le jour ${choice.arrivesOnDay}`;
  if (choice.locked) return choice.locked;
  if (choice.onThisMachine) return `Sur cette machine${arrival}`;
  if (choice.elsewhere) return `Sur « ${choice.elsewhere.name} »${arrival}`;
  return `Libre${arrival}`;
}

function OperatorsForm({
  machine,
  name,
  onDone,
}: {
  machine: MachineState;
  name: string;
  onDone: () => void;
}) {
  const view = useView();
  const { send, pending, canAct } = useGameCommand();
  const baseId = useId();
  const { team } = view;
  const day = view.clock.time.day;
  const names = machineNames(team);
  const choices = operatorChoices(team, machine.id, day, names);
  const current = choices.filter((choice) => choice.onThisMachine).map((choice) => choice.id);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(current));

  // Operators who left the company since the dialog opened are dropped.
  const crewIds = new Set(
    [...selected, ...(machine.cycle || machine.pendingOutput ? current : [])].filter(
      (id) => team.employees[id] !== undefined,
    ),
  );
  const unchanged = crewIds.size === current.length && current.every((id) => crewIds.has(id));
  const required = machineTypeOf(machine.typeId).operatorsRequired;
  const addingOnly = machine.cycle !== null || machine.pendingOutput !== null;
  const preview = withOperators(team, machine.id, crewIds);
  const crewAfter = machineCrew(preview, machine, day);
  const moves = transfers(team, machine.id, crewIds, day, names);
  const productId =
    machine.job?.productId ??
    machine.cycle?.productId ??
    productOptions(team, machine.typeId).find((option) => !option.lock)?.productId;
  const before = productId ? outputForecast(team, machine, productId, day) : null;
  const after = productId ? outputForecast(preview, machine, productId, day) : null;
  const canFill = choices.some(
    (choice) => !choice.onThisMachine && !choice.elsewhere && !crewIds.has(choice.id),
  );
  const editable = canAct;

  function toggle(id: string, checked: boolean) {
    const next = new Set(crewIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  }

  async function save() {
    const result = await send(
      "production.assignOperators",
      { machineId: machine.id, employeeIds: [...crewIds] },
      {
        success:
          crewIds.size === 0
            ? `Plus aucun opérateur sur « ${name} ».`
            : `${count(crewIds.size, "opérateur affecté", "opérateurs affectés")} à « ${name} ».`,
      },
    );
    if (result.ok) onDone();
  }

  if (choices.length === 0) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Votre entreprise n'a encore aucun opérateur. Recrutez-en dans Équipe : ils arrivent après
          un court délai et peuvent être affectés dès l'embauche.
        </p>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Fermer
            </Button>
          </DialogClose>
          <Button asChild>
            <Link to="/play/equipe">
              <UserPlus aria-hidden />
              Recruter des opérateurs
            </Link>
          </Button>
        </DialogFooter>
      </div>
    );
  }

  const short = crewAfter.present.length < required;

  return (
    <div className="grid gap-4">
      {addingOnly ? (
        <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Cycle en cours : vous pouvez ajouter des opérateurs pour le débloquer. Les opérateurs déjà
          affectés restent sur cette machine.
        </p>
      ) : null}

      <fieldset className="grid gap-2">
        <legend className="sr-only">Opérateurs de l'entreprise</legend>
        <div className="flex justify-between px-3 text-xs text-muted-foreground" aria-hidden>
          <span>Opérateur</span>
          <span>Rendement</span>
        </div>
        <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {choices.map((choice) => {
            const id = `${baseId}-${choice.id}`;
            const checked = crewIds.has(choice.id);
            const disabled =
              !editable || choice.locked !== null || (addingOnly && choice.onThisMachine);
            return (
              <li key={choice.id}>
                <label
                  htmlFor={id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors",
                    disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-muted/40",
                    checked && "border-primary bg-primary/5",
                  )}
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(value) => toggle(choice.id, value === true)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{choice.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {whereabouts(choice)}
                    </span>
                  </span>
                  <span className="tabular text-sm">
                    <span className="sr-only">Rendement </span>
                    {percent(choice.efficiency)}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div aria-live="polite" className="space-y-1.5 rounded-lg bg-muted/50 p-3 text-sm">
        <p className={cn("flex items-start gap-2 font-medium", short && "text-warning")}>
          {short ? (
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          ) : (
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          )}
          <span>
            {count(crewIds.size, "opérateur choisi", "opérateurs choisis")} :{" "}
            {count(crewAfter.present.length, "présent", "présents")} sur {required} requis
            {crewAfter.enRoute.length > 0
              ? `, ${formatNumber(crewAfter.enRoute.length)} en route (jour ${crewAfter.nextArrivalDay})`
              : ""}
            .
          </span>
        </p>
        {productId && before && after ? (
          <p className="flex flex-wrap items-center gap-1">
            Production par cycle {ofItem(productId)} :{" "}
            <span className="tabular">{before.ready ? formatNumber(before.perCycle) : "—"}</span>
            {" → "}
            <span className="tabular font-semibold">
              {after.ready ? formatNumber(after.perCycle) : "—"}
            </span>
            <InfoTip term="output" />
          </p>
        ) : null}
        {crewAfter.present.length > 0 ? (
          <p className="text-muted-foreground">
            Rendement moyen des opérateurs présents : {percent(crewAfter.efficiency)}.
          </p>
        ) : null}
        {crewIds.size > required ? (
          <p className="text-muted-foreground">
            Au-delà de {required}, des opérateurs en plus n'augmentent pas la quantité : seul leur
            rendement moyen compte.
          </p>
        ) : null}
        {moves.map((move) => (
          <p
            key={move.machineId}
            className={cn(
              "flex items-start gap-2",
              move.remaining < move.required ? "text-warning" : "text-muted-foreground",
            )}
          >
            {move.remaining < move.required ? (
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            ) : null}
            <span>
              « {move.name} » cède {count(move.moving, "opérateur", "opérateurs")} et garde{" "}
              {count(move.remaining, "présent", "présents")} sur {move.required} requis
              {move.remaining < move.required
                ? " : cette machine ne pourra plus lancer de cycle."
                : "."}
            </span>
          </p>
        ))}
      </div>

      <DialogFooter className="sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          disabled={!editable || crewIds.size >= required || !canFill}
          onClick={() => setSelected(autoFill(choices, crewIds, required))}
        >
          <Sparkles aria-hidden />
          Compléter avec des opérateurs libres
        </Button>
        <div className="flex gap-2">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Annuler
            </Button>
          </DialogClose>
          <Button type="button" disabled={!editable || pending || unchanged} onClick={save}>
            Enregistrer
          </Button>
        </div>
      </DialogFooter>
    </div>
  );
}
