import { StatCard, type Tone } from "@/components/game/stat-card";
import { credits, dayLabel, formatNumber } from "@/lib/format";
import { useView } from "@/lib/game";
import type { DeliveryPlan } from "./logistics";

/** Key logistics figures: daily capacity, queue, deliveries on the road, reputation. */
export function DeliveryStats({ plan }: { plan: DeliveryPlan }) {
  const { team } = useView();
  const strike = team.hr.unpaidWages > 0;
  const waiting = plan.queue.length + plan.toShip.length > 0;

  let capacityHint = `préparées aujourd'hui · ${formatNumber(plan.logisticiansAtWork)} logisticien${plan.logisticiansAtWork > 1 ? "s" : ""}`;
  if (strike) capacityHint = "Grève : préparation à l'arrêt";
  else if (plan.capacity === 0 && plan.logisticiansArriveOn !== null) {
    capacityHint = `Logisticiens attendus ${dayLabel(plan.logisticiansArriveOn).toLowerCase()}`;
  } else if (plan.capacity === 0) capacityHint = "Aucun logisticien au travail";
  let capacityTone: Tone = plan.backlog > 0 ? "warning" : "default";
  if (plan.capacity === 0 && waiting) {
    // Logisticians on their way only delay shipments; a strike or nobody at all blocks them.
    capacityTone = !strike && plan.logisticiansArriveOn !== null ? "warning" : "danger";
  }

  let queueHint = "Départ à la prochaine préparation";
  if (plan.queue.length === 0) queueHint = "Aucune expédition en attente";
  else if (plan.backlog > 0) {
    queueHint = `${formatNumber(plan.backlog)} ${plan.backlog > 1 ? "partiront" : "partira"} plus tard, faute de capacité`;
  }

  const units = plan.onTheRoad.reduce((sum, entry) => sum + entry.shipment.quantity, 0);
  const expected = plan.onTheRoad.reduce((sum, entry) => sum + (entry.revenue ?? 0), 0);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Capacité logistique"
        info="logistics"
        value={`${formatNumber(plan.preparedToday)} / ${formatNumber(plan.capacity)}`}
        hint={capacityHint}
        tone={capacityTone}
      />
      <StatCard
        label="File de préparation"
        value={formatNumber(plan.queue.length)}
        hint={queueHint}
        tone={plan.backlog > 0 ? "warning" : "default"}
      />
      <StatCard
        label="En route"
        value={formatNumber(plan.onTheRoad.length)}
        hint={
          plan.onTheRoad.length === 0
            ? "Aucune livraison en cours"
            : `${formatNumber(units)} unités · ${credits(expected)} à encaisser`
        }
      />
      <StatCard
        label="Réputation"
        info="reputation"
        value={`${team.reputation} / 100`}
        hint={`${formatNumber(team.stats.lateDeliveries)} retard${team.stats.lateDeliveries > 1 ? "s" : ""} · ${formatNumber(team.stats.failedOrders)} échec${team.stats.failedOrders > 1 ? "s" : ""}`}
        tone={team.reputation < 40 ? "warning" : "default"}
      />
    </div>
  );
}
