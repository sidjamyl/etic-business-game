import { productionRules } from "@etic/content";
import type { MachineState } from "@etic/engine";
import { Square, Trash2, Wrench } from "lucide-react";
import { ConfirmDialog } from "@/components/game/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useGameCommand } from "@/lib/commands";
import { credits, percent } from "@/lib/format";
import { useView } from "@/lib/game";
import { count, cycleLock, maintenancePlan, ofItem } from "./machines";

/** Empties the queue; a cycle already started still finishes (production.stop). */
export function StopButton({ machine }: { machine: MachineState }) {
  const { send, pending, canAct } = useGameCommand();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-label="Arrêter la file"
      disabled={!canAct || pending}
      onClick={() =>
        send(
          "production.stop",
          { machineId: machine.id },
          {
            success: machine.cycle
              ? "File arrêtée : le cycle en cours va jusqu'au bout."
              : "File arrêtée.",
          },
        )
      }
    >
      <Square aria-hidden />
      Arrêter
    </Button>
  );
}

/** Paid maintenance with its cost, downtime and efficiency gain (story 41). */
export function MaintenanceButton({ machine }: { machine: MachineState }) {
  const view = useView();
  const { send, pending, canAct } = useGameCommand();
  const plan = maintenancePlan(view.team, machine, view.clock.time.day);
  return (
    <ConfirmDialog
      trigger={
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canAct || pending || plan.blocker !== null}
        >
          <Wrench aria-hidden />
          Maintenance
        </Button>
      }
      title="Lancer la maintenance ?"
      description={`La machine sera immobilisée ${count(plan.days, "jour")} et reprendra le jour ${plan.returnDay}.`}
      consequences={[
        `Coût : ${credits(plan.cost)}, soit ${percent(productionRules.maintenanceCostShare)} du prix de base de la machine.`,
        `Rendement : ${percent(machine.efficiency)} → ${percent(plan.efficiencyAfter)}.`,
        machine.job
          ? "La file programmée reprendra à la fin de la maintenance."
          : "Les opérateurs restent affectés à la machine.",
      ]}
      confirmLabel={`Payer ${credits(plan.cost)}`}
      onConfirm={async () => {
        const result = await send(
          "production.maintain",
          { machineId: machine.id },
          { success: `Maintenance lancée : reprise le jour ${plan.returnDay}.` },
        );
        return result.ok;
      }}
    />
  );
}

/** Scrapping: definitive, no refund, operators freed (story 42). */
export function ScrapButton({ machine, name }: { machine: MachineState; name: string }) {
  const view = useView();
  const { send, pending, canAct } = useGameCommand();
  const { team } = view;
  const crew = Object.values(team.employees).filter(
    (employee) => employee.machineId === machine.id,
  ).length;
  const onSale = view.trades.offers.some(
    (offer) =>
      offer.sellerId === team.id &&
      offer.good.kind === "machine" &&
      offer.good.machineId === machine.id,
  );
  const consequences = ["Aucun remboursement : les fournisseurs ne rachètent pas les machines."];
  if (crew > 0) {
    consequences.push(
      `${count(crew, "opérateur affecté redevient libre", "opérateurs affectés redeviennent libres")}.`,
    );
  }
  if (machine.job) {
    consequences.push(
      `La file programmée (${count(machine.job.cyclesRemaining, "cycle")} ${ofItem(machine.job.productId)}) est abandonnée.`,
    );
  }
  if (onSale) consequences.push("Votre offre de vente de cette machine ne pourra plus aboutir.");

  return (
    <ConfirmDialog
      trigger={
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="Mettre au rebut"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={!canAct || pending || cycleLock(machine) !== null}
        >
          <Trash2 aria-hidden />
          Rebut
        </Button>
      }
      title={`Mettre « ${name} » au rebut ?`}
      description="La machine quitte définitivement votre entreprise. Pour en tirer un prix, proposez-la plutôt à une autre équipe dans Échanges."
      consequences={consequences}
      confirmLabel="Mettre au rebut"
      tone="danger"
      onConfirm={async () => {
        const result = await send(
          "production.scrap",
          { machineId: machine.id },
          { success: `Machine « ${name} » mise au rebut.` },
        );
        return result.ok;
      }}
    />
  );
}
