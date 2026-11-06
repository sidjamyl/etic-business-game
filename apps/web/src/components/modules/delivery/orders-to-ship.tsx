import { deliveryRules } from "@etic/content";
import { Link } from "@tanstack/react-router";
import { PackageCheck } from "lucide-react";
import { EmptyState } from "@/components/game/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { credits, dayLabel, formatNumber, itemLabel, regionName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type DeliveryPlan, deliveryRevenue, relativeDay } from "./logistics";
import { ShipDialog } from "./ship-dialog";
import { OutlookPill } from "./status-pill";

/** Accepted orders waiting for a transport choice (stories 62, 65), most urgent first. */
export function OrdersToShip({ plan }: { plan: DeliveryPlan }) {
  const slot = {
    nextDeparture: plan.nextDeparture,
    ahead: plan.queue.length,
    capacity: plan.capacity,
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground">À expédier</CardTitle>
        <CardDescription>
          Commandes acceptées, leur stock est réservé. Sans expédition, une commande est annulée{" "}
          {deliveryRules.failureGraceDays} jours après son échéance, sans paiement.
        </CardDescription>
        {plan.toShip.length > 0 ? (
          <CardAction>
            <Badge variant="secondary" className="tabular">
              {formatNumber(plan.toShip.length)}
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {plan.toShip.length === 0 ? (
          <EmptyState icon={PackageCheck} title="Aucune commande à expédier">
            <PendingOrdersNote count={plan.pendingOrders} />
          </EmptyState>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Commande</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Situation</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Action</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.toShip.map((entry) => {
                  const { order } = entry;
                  const passed = plan.today > order.deadlineDay;
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        <span className="tabular">{formatNumber(order.quantity)}</span> ×{" "}
                        {itemLabel(order.productId)}
                      </TableCell>
                      <TableCell>{regionName(order.region)}</TableCell>
                      <TableCell className="text-right">
                        <span className="tabular block">
                          {credits(deliveryRevenue(order, true))}
                        </span>
                        <span className="tabular block text-xs text-muted-foreground">
                          {credits(order.unitPrice)} / unité
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="tabular block">{dayLabel(order.deadlineDay)}</span>
                        <span
                          className={cn(
                            "tabular block text-xs",
                            passed ? "font-medium text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {passed
                            ? `dépassée de ${plan.today - order.deadlineDay} j`
                            : relativeDay(order.deadlineDay, plan.today)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <OutlookPill outlook={entry.outlook} />
                      </TableCell>
                      <TableCell className="text-right">
                        <ShipDialog entry={entry} slot={slot} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {plan.pendingOrders > 0 ? (
              <p className="text-sm text-muted-foreground">
                <PendingOrdersNote count={plan.pendingOrders} />
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PendingOrdersNote({ count }: { count: number }) {
  if (count === 0) {
    return (
      <>
        Les commandes acceptées dans{" "}
        <Link
          to="/play/ventes"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Ventes
        </Link>{" "}
        arrivent ici. L'acceptation automatique vous évite de les surveiller.
      </>
    );
  }
  return (
    <>
      {formatNumber(count)} commande{count > 1 ? "s attendent" : " attend"} votre acceptation dans{" "}
      <Link to="/play/ventes" className="font-medium text-foreground underline underline-offset-4">
        Ventes
      </Link>
      .
    </>
  );
}
