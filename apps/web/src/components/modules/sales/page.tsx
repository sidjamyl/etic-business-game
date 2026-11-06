import { Link } from "@tanstack/react-router";
import { Truck } from "lucide-react";
import { PageHeader } from "@/components/game/page-header";
import { Button } from "@/components/ui/button";
import { AttractivenessCard } from "./attractiveness-card";
import { OrderInbox } from "./order-inbox";
import { OrdersChart } from "./orders-chart";
import { PriceGrid } from "./price-grid";
import { SalesOverview } from "./sales-overview";

/**
 * Sales module (#31, R7): price grid product × region, order inbox with auto-acceptance,
 * orders over time and what drives demand (reputation, attractiveness).
 */
export function SalesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ventes"
        title="Prix et commandes"
        description="Fixez vos prix région par région, acceptez les commandes que votre stock permet d'honorer et suivez la demande."
        actions={
          <Button asChild variant="outline">
            <Link to="/play/livraisons">
              <Truck aria-hidden />
              Livraisons
            </Link>
          </Button>
        }
      />
      <SalesOverview />
      <OrderInbox />
      <PriceGrid />
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <OrdersChart />
        <AttractivenessCard />
      </div>
    </div>
  );
}
