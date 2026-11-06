import { Link } from "@tanstack/react-router";
import { Factory, ShoppingCart, Truck, UserPlus } from "lucide-react";
import { EmptyState } from "@/components/game/empty-state";
import { PageHeader } from "@/components/game/page-header";
import { StatCard } from "@/components/game/stat-card";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { useView } from "@/lib/game";
import { MachineCard } from "./machine-card";
import {
  count,
  type IncomingMachine,
  incomingMachines,
  namedMachines,
  productionSummary,
  unassignedOperators,
} from "./machines";

/** Production module (#30): machines, operators, cycle queues, maintenance and scrapping. */
export function ProductionPage() {
  const view = useView();
  const { team } = view;
  const machines = namedMachines(team);
  const incoming = incomingMachines(view);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Production"
        title="Machines et cycles"
        description="Affectez des opérateurs, programmez des files de cycles et surveillez l'usure de vos machines."
        actions={
          <Button asChild variant="outline">
            <Link to="/play/achats">
              <ShoppingCart aria-hidden />
              Acheter une machine
            </Link>
          </Button>
        }
      />
      {machines.length === 0 ? (
        <NoMachine incoming={incoming} />
      ) : (
        <>
          <Summary />
          {incoming.length > 0 ? <IncomingMachines incoming={incoming} /> : null}
          <div className="grid gap-6 xl:grid-cols-2">
            {machines.map(({ machine, name }) => (
              <MachineCard key={machine.id} machine={machine} name={name} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Summary() {
  const view = useView();
  const { team } = view;
  const summary = productionSummary(team, view.clock.time.day);
  const capacity = team.warehouse.capacity;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Machines en marche"
        value={`${summary.running} / ${summary.machines}`}
        tone={summary.blocked > 0 ? "warning" : "default"}
        hint={
          summary.blocked > 0
            ? `${count(summary.blocked, "machine bloquée", "machines bloquées")} : voir ci-dessous`
            : "Aucune machine bloquée"
        }
      />
      <StatCard
        label="Opérateurs libres"
        value={formatNumber(summary.freeOperators)}
        tone={summary.openSeats > unassignedOperators(team) ? "warning" : "default"}
        hint={[
          count(summary.assignedOperators, "affecté", "affectés"),
          summary.enRouteOperators > 0
            ? `${formatNumber(summary.enRouteOperators)} en route`
            : null,
          summary.openSeats > 0
            ? count(summary.openSeats, "poste à pourvoir", "postes à pourvoir")
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      <StatCard
        label="Entrepôt"
        value={`${formatNumber(view.warehouseUsed)} / ${formatNumber(capacity)}`}
        info="warehouse"
        tone={view.warehouseUsed >= capacity * 0.9 ? "warning" : "default"}
        hint="Plein, il bloque la sortie des cycles (sans perte)."
      />
      <StatCard
        label="Unités fabriquées"
        value={formatNumber(summary.produced)}
        hint="Depuis le début de la partie"
      />
    </div>
  );
}

function IncomingMachines({ incoming }: { incoming: IncomingMachine[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-card px-4 py-3 text-sm">
      <span className="eyebrow flex items-center gap-1.5 text-muted-foreground">
        <Truck className="size-4" aria-hidden />
        En route
      </span>
      <ul className="flex flex-wrap gap-x-6 gap-y-1">
        {incoming.map((machine) => (
          <li key={machine.id}>
            <span className="font-medium">{machine.name}</span>{" "}
            <span className="tabular text-muted-foreground">
              · livraison le jour {machine.arrivesOnDay}
              {machine.viaTrade ? " (échange)" : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** No machine yet: where to get one, and what is already on its way. */
function NoMachine({ incoming }: { incoming: IncomingMachine[] }) {
  const first = incoming[0];
  return (
    <EmptyState icon={Factory} title="Aucune machine pour l'instant">
      <p>
        {first
          ? `Votre première machine, « ${first.name} », arrive le jour ${first.arrivesOnDay}. D'ici là, recrutez des opérateurs et commandez les matières de vos premiers cycles.`
          : "Achetez une machine dans Achats › Machines, recrutez des opérateurs dans Équipe, puis programmez ici vos premiers cycles."}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button asChild size="sm">
          <Link to="/play/achats">
            <ShoppingCart aria-hidden />
            Aller aux achats
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="text-foreground">
          <Link to="/play/equipe">
            <UserPlus aria-hidden />
            Recruter des opérateurs
          </Link>
        </Button>
      </div>
    </EmptyState>
  );
}
