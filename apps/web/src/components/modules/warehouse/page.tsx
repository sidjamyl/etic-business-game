import { Link } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/game/page-header";
import { Button } from "@/components/ui/button";
import { WarehouseGauge } from "./capacity-gauge";
import { WarehouseExpansion } from "./expansion-card";
import { InboundCard } from "./inbound-shipments";
import { InventoryTables } from "./inventory-tables";

/**
 * Warehouse (#28, R9): occupation gauge, stock of materials and products, inbound shipments
 * and the paid extension (stories 29, 32–34).
 */
export function WarehousePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Entrepôt"
        title="Stock et capacité"
        description="Une seule capacité pour toutes les marchandises. Plein, l'entrepôt fait attendre les livraisons et la production, sans rien perdre."
        actions={
          <Button asChild variant="outline">
            <Link to="/play/achats">
              <ShoppingCart aria-hidden />
              Acheter des matières
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <WarehouseGauge />
        <WarehouseExpansion />
      </div>
      <InventoryTables />
      <InboundCard />
    </div>
  );
}
