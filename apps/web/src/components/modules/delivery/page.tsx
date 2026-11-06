import { MapPin } from "lucide-react";
import { EmptyState } from "@/components/game/empty-state";
import { PageHeader } from "@/components/game/page-header";
import { useView } from "@/lib/game";
import { DeliveryAlerts } from "./delivery-alerts";
import { DeliveryStats } from "./delivery-stats";
import { deliveryPlan } from "./logistics";
import { OrdersToShip } from "./orders-to-ship";
import { RouteRates } from "./route-rates";
import { PreparationQueue, ShipmentsOnTheRoad } from "./shipment-tables";

/**
 * Livraisons (#32, R8, N11): ship accepted orders with the standard, express or green option,
 * then follow the preparation queue and the deliveries on the road. Everything is computed
 * from the live team view; the server applies the rules.
 */
export function DeliveryPage() {
  const view = useView();
  const header = (
    <PageHeader
      eyebrow="Livraisons"
      title="Expéditions"
      description="Choisissez le transport de chaque commande acceptée puis suivez-la jusqu'au client : il paie à la livraison."
    />
  );
  const region = view.team.region;
  if (!region) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState icon={MapPin} title="Aucune région d'implantation">
          Les coûts et délais de transport partent de votre région, choisie dans le lobby.
        </EmptyState>
      </div>
    );
  }
  const plan = deliveryPlan(view, region);
  return (
    <div className="space-y-6">
      {header}
      <DeliveryAlerts plan={plan} />
      <DeliveryStats plan={plan} />
      <OrdersToShip plan={plan} />
      <PreparationQueue plan={plan} />
      <ShipmentsOnTheRoad plan={plan} />
      <RouteRates from={region} />
    </div>
  );
}
