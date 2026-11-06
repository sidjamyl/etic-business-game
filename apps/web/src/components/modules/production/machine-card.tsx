import type { MachineState } from "@etic/engine";
import { Link } from "@tanstack/react-router";
import {
  Banknote,
  Handshake,
  ListPlus,
  type LucideIcon,
  Milestone,
  ShoppingCart,
  UserPlus,
  Users,
  Warehouse,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCanAct, useView } from "@/lib/game";
import { JobDialog } from "./job-dialog";
import { MaintenanceButton, ScrapButton, StopButton } from "./machine-actions";
import {
  CompatibleProducts,
  CrewSection,
  EfficiencySection,
  ProductionSection,
} from "./machine-sections";
import { SituationNote, StatusBadge } from "./machine-status";
import {
  canProgram,
  count,
  lockNote,
  type MaintenanceBlocker,
  machineCrew,
  machineSituation,
  machineTypeOf,
  maintenancePlan,
  type Situation,
  unassignedOperators,
} from "./machines";
import { OperatorsDialog } from "./operators-dialog";

/**
 * One machine (acceptance criteria of #30): status and what blocks it, efficiency and wear,
 * operators, cycle and queue, compatible products, then the decisions it allows.
 */
export function MachineCard({ machine, name }: { machine: MachineState; name: string }) {
  const view = useView();
  const canAct = useCanAct();
  const [jobOpen, setJobOpen] = useState(false);
  const [crewOpen, setCrewOpen] = useState(false);
  const { team } = view;
  const day = view.clock.time.day;
  const situation = machineSituation(team, machine, day);
  const note = lockNote(machine) ?? fundsNote(maintenancePlan(team, machine, day).blocker);
  const crew = machineCrew(team, machine, day);
  const onSale = view.trades.offers.some(
    (offer) =>
      offer.sellerId === team.id &&
      offer.good.kind === "machine" &&
      offer.good.machineId === machine.id,
  );

  return (
    <Card className="gap-5">
      <CardHeader>
        <CardTitle className="min-w-0">
          <h2 className="truncate text-xl font-bold uppercase">{name}</h2>
        </CardTitle>
        <CardDescription>
          {count(
            machineTypeOf(machine.typeId).operatorsRequired,
            "opérateur requis",
            "opérateurs requis",
          )}
        </CardDescription>
        <CardAction className="flex flex-col items-end gap-1.5">
          <StatusBadge situation={situation} />
          {onSale ? (
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
              <Handshake className="size-3" aria-hidden />
              Proposée à la vente
            </span>
          ) : null}
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-5">
        {situation.kind === "running" ? null : (
          <SituationNote situation={situation}>
            {situationFix(situation, {
              canAct,
              canProgram: canProgram(team, machine.typeId),
              canAssign: unassignedOperators(team) > 0,
              crewComing: crew.present.length + crew.enRoute.length >= crew.required,
              onProgram: () => setJobOpen(true),
              onAssign: () => setCrewOpen(true),
            })}
          </SituationNote>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <EfficiencySection machine={machine} />
          <CrewSection machine={machine} />
        </div>
        <ProductionSection machine={machine} />
        <CompatibleProducts machine={machine} />
      </CardContent>

      <CardFooter className="mt-auto flex-wrap gap-2 border-t">
        <JobDialog machine={machine} name={name} open={jobOpen} onOpenChange={setJobOpen} />
        <OperatorsDialog machine={machine} name={name} open={crewOpen} onOpenChange={setCrewOpen} />
        {machine.job ? <StopButton machine={machine} /> : null}
        <div className="ml-auto flex gap-2">
          <MaintenanceButton machine={machine} />
          <ScrapButton machine={machine} name={name} />
        </div>
        {note ? <p className="w-full text-xs text-pretty text-muted-foreground">{note}</p> : null}
      </CardFooter>
    </Card>
  );
}

function fundsNote(blocker: MaintenanceBlocker | null): string | null {
  return blocker?.reason === "funds" ? blocker.message : null;
}

/** The shortest way to unblock the machine, shown under the explanation (null if none). */
function situationFix(
  situation: Situation,
  actions: {
    canAct: boolean;
    /** At least one compatible product is unlocked. */
    canProgram: boolean;
    /** Some operators work on no machine. */
    canAssign: boolean;
    /** Assigned operators on their way will complete the crew. */
    crewComing: boolean;
    onProgram: () => void;
    onAssign: () => void;
  },
): ReactNode {
  switch (situation.kind) {
    case "idle":
      return actions.canProgram ? (
        <Button type="button" size="xs" disabled={!actions.canAct} onClick={actions.onProgram}>
          <ListPlus aria-hidden />
          Programmer la production
        </Button>
      ) : (
        <FixLink to="/play/progression" icon={Milestone} label="Voir la progression" />
      );
    case "waiting-operators":
      if (actions.crewComing) return null;
      return actions.canAssign ? (
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={!actions.canAct}
          onClick={actions.onAssign}
        >
          <Users aria-hidden />
          Affecter des opérateurs
        </Button>
      ) : (
        <FixLink to="/play/equipe" icon={UserPlus} label="Recruter dans Équipe" />
      );
    case "waiting-materials":
      return <FixLink to="/play/achats" icon={ShoppingCart} label="Acheter des matières" />;
    case "waiting-space":
      return <FixLink to="/play/entrepot" icon={Warehouse} label="Voir l'entrepôt" />;
    case "strike":
      return <FixLink to="/play/finance" icon={Banknote} label="Voir la trésorerie" />;
    default:
      return null;
  }
}

function FixLink({
  to,
  icon: Icon,
  label,
}: {
  to: "/play/equipe" | "/play/achats" | "/play/entrepot" | "/play/finance" | "/play/progression";
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Button asChild size="xs" variant="outline">
      <Link to={to}>
        <Icon aria-hidden />
        {label}
      </Link>
    </Button>
  );
}
