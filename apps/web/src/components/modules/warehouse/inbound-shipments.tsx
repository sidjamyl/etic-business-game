import { machineTypeById } from "@etic/content";
import type { CompanySummary, InboundShipment } from "@etic/engine";
import { Factory, Package, TriangleAlert, Truck } from "lucide-react";
import { EmptyState } from "@/components/game/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dayLabel, formatNumber, itemLabel } from "@/lib/format";
import { useView } from "@/lib/game";
import { relativeDay, shipmentOrigin, sortShipments, unitsLabel } from "./warehouse-math";

function StatusBadge({ shipment }: { shipment: InboundShipment }) {
  if (shipment.status === "waiting-space") {
    return (
      <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
        <TriangleAlert aria-hidden />
        En attente de place
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <Truck aria-hidden />
      En route
    </Badge>
  );
}

function ShipmentRow({
  shipment,
  today,
  competitors,
}: {
  shipment: InboundShipment;
  today: number;
  competitors: Record<string, CompanySummary>;
}) {
  const machine = shipment.kind === "machine";
  const Icon = machine ? Factory : Package;
  const name = machine
    ? (machineTypeById.get(shipment.machineTypeId)?.name ?? shipment.machineTypeId)
    : itemLabel(shipment.item);
  const waiting = shipment.status === "waiting-space";
  return (
    <TableRow>
      <TableCell>
        <span className="flex items-center gap-2 font-medium">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          {name}
        </span>
      </TableCell>
      <TableCell className="text-right">
        {machine ? (
          <>
            <div>1 machine</div>
            <div className="text-xs text-muted-foreground">hors entrepôt</div>
          </>
        ) : (
          <span className="tabular font-medium">{formatNumber(shipment.quantity)}</span>
        )}
      </TableCell>
      <TableCell>{shipmentOrigin(shipment.supplierId, competitors)}</TableCell>
      <TableCell>
        <div className="tabular">{dayLabel(shipment.arrivesOnDay)}</div>
        <div className="tabular text-xs text-muted-foreground">
          {waiting
            ? `arrivée ${relativeDay(shipment.arrivesOnDay, today)}`
            : relativeDay(shipment.arrivesOnDay, today)}
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge shipment={shipment} />
      </TableCell>
    </TableRow>
  );
}

/** Arrived goods held back by a full warehouse: what it means and how to unblock (R9). */
function WaitingNotice({ shipments, units }: { shipments: number; units: number }) {
  const several = shipments > 1;
  return (
    <div className="mx-2 flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <p>
        <strong className="font-semibold">
          {several
            ? `${shipments} livraisons attendent de la place`
            : "Une livraison attend de la place"}{" "}
          ({unitsLabel(units)}).
        </strong>{" "}
        {several
          ? "Elles sont arrivées, mais l'entrepôt est plein : elles entreront automatiquement"
          : "Elle est arrivée, mais l'entrepôt est plein : elle entrera automatiquement"}{" "}
        dès qu'il y aura assez de place, sans aucune perte. Libérez de l'espace (production, ventes)
        ou agrandissez l'entrepôt.
      </p>
    </div>
  );
}

/**
 * Supplier orders, trades and secret rewards on their way, with their arrival day
 * (stories 29 and 33). Orders cannot be cancelled, so there is no action here.
 */
export function InboundShipments() {
  const view = useView();
  const today = view.clock.time.day;
  const shipments = sortShipments(Object.values(view.team.inbound));
  if (shipments.length === 0) {
    return (
      <div className="px-2">
        <EmptyState icon={Truck} title="Aucune livraison attendue">
          Vos commandes aux fournisseurs apparaîtront ici jusqu'à leur arrivée dans l'entrepôt.
        </EmptyState>
      </div>
    );
  }
  let waitingShipments = 0;
  let waitingUnits = 0;
  for (const shipment of shipments) {
    if (shipment.kind === "material" && shipment.status === "waiting-space") {
      waitingShipments += 1;
      waitingUnits += shipment.quantity;
    }
  }
  return (
    <div className="space-y-4">
      {waitingShipments > 0 ? (
        <WaitingNotice shipments={waitingShipments} units={waitingUnits} />
      ) : null}
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Marchandise</TableHead>
            <TableHead className="text-right">Quantité</TableHead>
            <TableHead>Provenance</TableHead>
            <TableHead>Arrivée</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shipments.map((shipment) => (
            <ShipmentRow
              key={shipment.id}
              shipment={shipment}
              today={today}
              competitors={view.competitors}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** The inbound list in its card, shared by the Warehouse and Purchasing pages. */
export function InboundCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground">Livraisons attendues</CardTitle>
        <CardDescription>
          Commandes fournisseurs, échanges et récompenses en route vers votre entreprise. Une
          commande passée ne peut pas être annulée.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <InboundShipments />
      </CardContent>
    </Card>
  );
}
