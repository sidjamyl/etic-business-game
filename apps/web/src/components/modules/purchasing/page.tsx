import { availableCash } from "@etic/engine";
import { Link } from "@tanstack/react-router";
import { Boxes, Factory, Package, Truck } from "lucide-react";
import { PageHeader } from "@/components/game/page-header";
import { StatCard } from "@/components/game/stat-card";
import { InboundCard } from "@/components/modules/warehouse/inbound-shipments";
import { fillLevel, freeUnits, unitsLabel } from "@/components/modules/warehouse/warehouse-math";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { credits, formatNumber } from "@/lib/format";
import { useView } from "@/lib/game";
import { MachineShop } from "./machine-shop";
import { MaterialSuppliers } from "./material-suppliers";
import { FirmOrderNotice } from "./order-dialog";

const FILL_TONE = { ok: "default", high: "warning", full: "danger" } as const;

/**
 * Purchasing (#28, R4): raw-material suppliers, equipment suppliers and orders on their way
 * (stories 25–31). Prices include the team's region and running events.
 */
export function PurchasingPage() {
  const view = useView();
  const { team } = view;
  const cash = availableCash(team);
  const capacity = team.warehouse.capacity;
  const free = freeUnits(view.warehouseUsed, capacity);
  const level = fillLevel(view.warehouseUsed, capacity);
  const shipments = Object.values(team.inbound);
  const nextArrival = shipments.length
    ? Math.min(...shipments.map((shipment) => shipment.arrivesOnDay))
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Achats"
        title="Fournisseurs et machines"
        description="Prix ajustés à votre région et aux événements en cours. Les stocks des fournisseurs sont partagés entre toutes les équipes."
        actions={
          <Button asChild variant="outline">
            <Link to="/play/entrepot">
              <Boxes aria-hidden />
              Voir l'entrepôt
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Trésorerie disponible"
          value={credits(cash)}
          info="availableCash"
          hint={
            team.reservedCash > 0
              ? `${credits(team.reservedCash)} bloqués par vos enchères`
              : "Paiement à la commande"
          }
        />
        <StatCard
          label="Entrepôt"
          value={`${formatNumber(view.warehouseUsed)} / ${formatNumber(capacity)}`}
          info="warehouse"
          tone={FILL_TONE[level]}
          hint={
            level === "full"
              ? "Plein : les livraisons attendront de la place"
              : unitsLabel(free, "libre")
          }
        />
        <StatCard
          label="Livraisons attendues"
          value={formatNumber(shipments.length)}
          hint={
            nextArrival === null ? "Aucune commande en cours" : `Prochaine : jour ${nextArrival}`
          }
        />
      </div>

      <FirmOrderNotice />

      <Tabs defaultValue="materials" className="gap-4">
        <TabsList>
          <TabsTrigger value="materials" className="px-3">
            <Package aria-hidden />
            Matières premières
          </TabsTrigger>
          <TabsTrigger value="machines" className="px-3">
            <Factory aria-hidden />
            Machines
          </TabsTrigger>
          <TabsTrigger value="orders" className="px-3">
            <Truck aria-hidden />
            Commandes en cours
            <span className="tabular rounded-full bg-muted px-1.5 text-xs">{shipments.length}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="materials">
          <MaterialSuppliers />
        </TabsContent>
        <TabsContent value="machines">
          <MachineShop />
        </TabsContent>
        <TabsContent value="orders">
          <InboundCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
