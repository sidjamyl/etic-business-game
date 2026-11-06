import { products, salesRules } from "@etic/content";
import { availableStock, type CustomerOrder, type Shipment } from "@etic/engine";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  Clock,
  Hourglass,
  Inbox,
  Package,
  PackageCheck,
  TriangleAlert,
  Truck,
  Zap,
} from "lucide-react";
import { type ReactNode, useId } from "react";
import { EmptyState } from "@/components/game/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGameCommand } from "@/lib/commands";
import { credits, dayLabel, formatNumber, itemLabel, regionName, timeLeft } from "@/lib/format";
import { useGame, useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import {
  type DeadlineState,
  daysUntilEndOf,
  deadlineLabel,
  deadlineState,
  expiryLabel,
  orderBook,
  orderValue,
  plural,
  sellsAnywhere,
} from "./sales";

/** Customer orders (R7, stories 56–59): accept, decline or let expire; orders to deliver. */
export function OrderInbox() {
  const { team, clock } = useView();
  const book = orderBook(team.orders, clock.time.day);
  const shipments = new Map(
    Object.values(team.shipments).map((shipment) => [shipment.orderId, shipment]),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground" role="heading" aria-level={2}>
          Boîte de réception
        </CardTitle>
        <CardDescription>
          Accepter réserve le stock et vous engage à livrer avant l'échéance ; le client paie à la
          livraison. Une commande non acceptée expire au bout de {salesRules.orderExpiryDays} jours,
          sans pénalité.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              En attente <Count value={book.pending.length} />
            </TabsTrigger>
            <TabsTrigger value="accepted">
              Acceptées <Count value={book.toDeliver.length} />
            </TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-2 space-y-3">
            <AutoAcceptSummary />
            {book.pending.length === 0 ? (
              <PendingEmpty />
            ) : (
              <ScrollBox>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Commande</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>À livrer avant</TableHead>
                      <TableHead>Expiration</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>
                        <span className="sr-only">Décision</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {book.pending.map((order) => (
                      <PendingOrderRow key={order.id} order={order} />
                    ))}
                  </TableBody>
                </Table>
              </ScrollBox>
            )}
          </TabsContent>
          <TabsContent value="accepted" className="mt-2">
            {book.toDeliver.length === 0 ? (
              <EmptyState icon={PackageCheck} title="Aucune commande à livrer">
                Acceptez une commande pour réserver son stock, puis expédiez-la depuis le module
                Livraisons.
              </EmptyState>
            ) : (
              <ScrollBox>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Commande</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Échéance</TableHead>
                      <TableHead>Suivi</TableHead>
                      <TableHead>
                        <span className="sr-only">Expédition</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {book.toDeliver.map((order) => (
                      <DeliveryRow
                        key={order.id}
                        order={order}
                        shipment={shipments.get(order.id)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </ScrollBox>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function Count({ value }: { value: number }) {
  return (
    <span className="tabular rounded-full bg-foreground/10 px-1.5 text-xs font-semibold">
      {formatNumber(value)}
    </span>
  );
}

/** Long inboxes scroll inside the card instead of pushing the price grid away. */
function ScrollBox({ children }: { children: ReactNode }) {
  return <div className="max-h-[30rem] overflow-y-auto">{children}</div>;
}

function AutoAcceptSummary() {
  const { team } = useView();
  const names = products
    .filter((product) => team.autoAccept[product.id] === true)
    .map((product) => product.name);
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Zap className="size-3.5 shrink-0" aria-hidden />
      {names.length === 0
        ? "Acceptation automatique désactivée : activez-la par produit dans la grille de prix."
        : `Acceptation automatique : ${names.join(", ")}.`}
    </p>
  );
}

function PendingEmpty() {
  const { team } = useView();
  return sellsAnywhere(team.prices) ? (
    <EmptyState icon={Inbox} title="Aucune commande en attente">
      Les commandes arrivent au fil de la journée, selon vos prix et ceux de vos concurrents.
    </EmptyState>
  ) : (
    <EmptyState icon={Inbox} title="Vous ne vendez encore nulle part">
      Fixez un prix dans la grille ci-dessous pour recevoir vos premières commandes.
    </EmptyState>
  );
}

function OrderCell({ order }: { order: CustomerOrder }) {
  return (
    <TableCell>
      <p className="tabular font-medium">
        {formatNumber(order.quantity)} × {itemLabel(order.productId)}
      </p>
      <p className="tabular text-xs text-muted-foreground">
        {credits(order.unitPrice)} / unité · {credits(orderValue(order))}
      </p>
    </TableCell>
  );
}

function PendingOrderRow({ order }: { order: CustomerOrder }) {
  const { team, clock } = useView();
  const { msPerDay } = useGame();
  const { send, pending, canAct } = useGameCommand();
  const stockId = useId();
  const today = clock.time.day;
  const stock = Math.max(0, availableStock(team, order.productId));
  const enough = stock >= order.quantity;
  const auto = team.autoAccept[order.productId] === true;
  const lastDay = order.expiresOnDay <= today;
  const left = daysUntilEndOf(order.expiresOnDay, clock.time, clock.stepsPerDay);
  const name = itemLabel(order.productId);
  const label = `${formatNumber(order.quantity)} × ${name} pour ${regionName(order.region)}`;

  return (
    <TableRow>
      <OrderCell order={order} />
      <TableCell>{regionName(order.region)}</TableCell>
      <TableCell>
        <p className="tabular">{dayLabel(order.deadlineDay)}</p>
        <p className="text-xs text-muted-foreground">
          {deadlineLabel(deadlineState(order.deadlineDay, today))}
        </p>
      </TableCell>
      <TableCell>
        <p className={cn("flex items-center gap-1", lastDay && "font-medium text-warning")}>
          {lastDay ? <Hourglass className="size-3.5 shrink-0" aria-hidden /> : null}
          {expiryLabel(order.expiresOnDay, today)}
        </p>
        <p className="tabular text-xs text-muted-foreground">{timeLeft(left, msPerDay)}</p>
      </TableCell>
      <TableCell>
        <div id={stockId}>
          {enough ? (
            <p className="tabular flex items-center gap-1 text-success">
              <Check className="size-3.5 shrink-0" aria-hidden />
              {plural(stock, "disponible", "disponibles")}
            </p>
          ) : (
            <p className="flex items-center gap-1 font-medium text-warning">
              <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
              Stock insuffisant
            </p>
          )}
          <p className="tabular text-xs text-muted-foreground">
            {enough
              ? auto
                ? "Acceptation auto imminente"
                : plural(order.quantity, "demandé", "demandés")
              : `${plural(stock, "disponible", "disponibles")} sur ${formatNumber(order.quantity)}`}
          </p>
          {auto && !enough ? (
            <p className="text-xs text-muted-foreground">Acceptation auto dès que possible</p>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            disabled={!canAct || pending || !enough}
            aria-label={`Accepter : ${label}`}
            aria-describedby={stockId}
            onClick={async () => {
              await send(
                "sales.acceptOrder",
                { orderId: order.id },
                {
                  success: `Commande acceptée : ${formatNumber(order.quantity)} × ${name} réservés.`,
                },
              );
            }}
          >
            Accepter
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!canAct || pending}
            aria-label={`Refuser : ${label}`}
            onClick={async () => {
              await send("sales.declineOrder", { orderId: order.id });
            }}
          >
            Refuser
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

/** An accepted order on its way to the customer: deadline and shipment progress (R8). */
function DeliveryRow({
  order,
  shipment,
}: {
  order: CustomerOrder;
  shipment: Shipment | undefined;
}) {
  const { clock } = useView();
  const deadline = deadlineState(order.deadlineDay, clock.time.day);
  const label = `${formatNumber(order.quantity)} × ${itemLabel(order.productId)} pour ${regionName(order.region)}`;
  return (
    <TableRow>
      <OrderCell order={order} />
      <TableCell>{regionName(order.region)}</TableCell>
      <TableCell>
        <p className="tabular">{dayLabel(order.deadlineDay)}</p>
        <p
          className={cn(
            "flex items-center gap-1 text-xs",
            deadline.kind === "late" ? "font-medium text-destructive" : "text-muted-foreground",
          )}
        >
          {deadline.kind === "late" ? (
            <TriangleAlert className="size-3 shrink-0" aria-hidden />
          ) : null}
          {deadlineLabel(deadline)}
        </p>
      </TableCell>
      <TableCell>
        <DeliveryStatus order={order} shipment={shipment} deadline={deadline} />
      </TableCell>
      <TableCell className="text-right">
        {order.status === "accepted" ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/play/livraisons" aria-label={`Expédier depuis Livraisons : ${label}`}>
              Expédier
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function DeliveryStatus({
  order,
  shipment,
  deadline,
}: {
  order: CustomerOrder;
  shipment: Shipment | undefined;
  deadline: DeadlineState;
}) {
  if (order.status === "accepted") {
    return (
      <>
        <p className="flex items-center gap-1">
          <Package className="size-3.5 shrink-0" aria-hidden />À expédier
        </p>
        <p
          className={cn(
            "text-xs",
            deadline.kind === "late" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {deadline.kind === "late"
            ? `Annulée après le ${dayLabel(deadline.cancelAfterDay).toLowerCase()} sans expédition`
            : "Stock réservé"}
        </p>
      </>
    );
  }
  if (shipment?.status === "in-transit" && shipment.arrivesOnDay !== null) {
    const late = shipment.arrivesOnDay > order.deadlineDay;
    return (
      <>
        <p className="flex items-center gap-1">
          <Truck className="size-3.5 shrink-0" aria-hidden />
          En route
        </p>
        <p className={cn("tabular text-xs", late ? "text-warning" : "text-muted-foreground")}>
          Arrivée {dayLabel(shipment.arrivesOnDay).toLowerCase()}
          {late ? " · en retard" : " · à l'heure"}
        </p>
      </>
    );
  }
  return (
    <>
      <p className="flex items-center gap-1">
        <Clock className="size-3.5 shrink-0" aria-hidden />
        En préparation
      </p>
      <p className="text-xs text-muted-foreground">Part dès qu'un logisticien est libre</p>
    </>
  );
}
