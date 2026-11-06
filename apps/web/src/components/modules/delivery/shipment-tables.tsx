import type { Shipment } from "@etic/engine";
import { CalendarClock, Package, PackageX, Truck } from "lucide-react";
import { EmptyState } from "@/components/game/empty-state";
import { TransportImpactBadge } from "@/components/game/impact-badge";
import { InfoTip } from "@/components/game/info-tip";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { credits, dayLabel, formatNumber, itemLabel, percent, regionName } from "@/lib/format";
import { type DeliveryPlan, optionShortName, relativeDay } from "./logistics";
import { ArrivalPill, lateDiscountLabel, StatusPill } from "./status-pill";

function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <CardAction>
      <Badge variant="secondary" className="tabular">
        {formatNumber(count)}
      </Badge>
    </CardAction>
  );
}

function Goods({ shipment }: { shipment: Shipment }) {
  return (
    <>
      <span className="tabular">{formatNumber(shipment.quantity)}</span> ×{" "}
      {itemLabel(shipment.productId)}
    </>
  );
}

function Transport({ shipment }: { shipment: Shipment }) {
  return (
    <>
      <span className="flex items-center gap-2">
        {optionShortName(shipment.option)}
        <TransportImpactBadge option={shipment.option} />
      </span>
      <span className="tabular block text-xs text-muted-foreground">
        {credits(shipment.cost)} payés
      </span>
    </>
  );
}

function DayCell({ day, today }: { day: number; today: number }) {
  return (
    <>
      <span className="tabular block">{dayLabel(day)}</span>
      <span className="tabular block text-xs text-muted-foreground">{relativeDay(day, today)}</span>
    </>
  );
}

/** Shipments waiting for a logistician, in the order they are prepared (story 67). */
export function PreparationQueue({ plan }: { plan: DeliveryPlan }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <span className="eyebrow text-muted-foreground">File de préparation</span>
          <InfoTip term="logistics" />
        </CardTitle>
        <CardDescription>
          {plan.capacity > 0
            ? `Vos logisticiens préparent les expéditions dans l'ordre, jusqu'à ${formatNumber(plan.capacity)} par jour.`
            : "Aucun logisticien ne prépare d'expédition aujourd'hui."}{" "}
          Les marchandises quittent l'entrepôt au départ.
          {plan.backlog > 0
            ? ` ${formatNumber(plan.backlog)} expédition${plan.backlog > 1 ? "s partiront" : " partira"} plus tard faute de capacité.`
            : ""}
        </CardDescription>
        <CountBadge count={plan.queue.length} />
      </CardHeader>
      <CardContent>
        {plan.queue.length === 0 ? (
          <EmptyState icon={Package} title="File vide">
            Chaque expédition demandée attend ici qu'un logisticien la prépare.
          </EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-right">N°</TableHead>
                <TableHead>Commande</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Transport</TableHead>
                <TableHead>Départ estimé</TableHead>
                <TableHead>Arrivée estimée</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.queue.map((entry) => (
                <TableRow key={entry.shipment.id}>
                  <TableCell className="tabular text-right text-muted-foreground">
                    {entry.position}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Goods shipment={entry.shipment} />
                  </TableCell>
                  <TableCell>{regionName(entry.shipment.destination)}</TableCell>
                  <TableCell>
                    <Transport shipment={entry.shipment} />
                  </TableCell>
                  <TableCell>
                    {entry.departureDay === null ? (
                      <StatusPill tone="danger" icon={PackageX}>
                        Départ bloqué
                      </StatusPill>
                    ) : (
                      <DayCell day={entry.departureDay} today={plan.today} />
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-col gap-1">
                      {entry.arrivalDay === null ? null : (
                        <span className="tabular">{dayLabel(entry.arrivalDay)}</span>
                      )}
                      <ArrivalPill onTime={entry.onTime} />
                      {entry.deadlineDay === null ? null : (
                        <span className="tabular text-xs text-muted-foreground">
                          échéance {dayLabel(entry.deadlineDay).toLowerCase()}
                        </span>
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/** Shipments travelling to customers, with event delays and the payment to come (story 68). */
export function ShipmentsOnTheRoad({ plan }: { plan: DeliveryPlan }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground">En route</CardTitle>
        <CardDescription>
          Le client paie à la livraison : prix plein à l'heure, {lateDiscountLabel} en retard. Un
          événement peut ralentir une livraison déjà partie.
        </CardDescription>
        <CountBadge count={plan.onTheRoad.length} />
      </CardHeader>
      <CardContent>
        {plan.onTheRoad.length === 0 ? (
          <EmptyState icon={Truck} title="Aucune livraison en cours">
            Une expédition prend la route dès qu'un logisticien l'a préparée.
          </EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Commande</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Transport</TableHead>
                <TableHead>Trajet</TableHead>
                <TableHead>Arrivée</TableHead>
                <TableHead className="text-right">À encaisser</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.onTheRoad.map((entry) => {
                const { shipment } = entry;
                const destination = regionName(shipment.destination);
                return (
                  <TableRow key={shipment.id}>
                    <TableCell className="font-medium">
                      <Goods shipment={shipment} />
                    </TableCell>
                    <TableCell>{destination}</TableCell>
                    <TableCell>
                      <Transport shipment={shipment} />
                    </TableCell>
                    <TableCell>
                      <Progress
                        value={entry.progress * 100}
                        aria-label={`Trajet vers ${destination} : ${percent(entry.progress)}`}
                        className="h-1.5 w-28"
                      />
                      {shipment.departedDay === null ? null : (
                        <span className="tabular mt-1 block text-xs text-muted-foreground">
                          parti {dayLabel(shipment.departedDay).toLowerCase()}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-col gap-1">
                        {shipment.arrivesOnDay === null ? null : (
                          <span className="tabular">
                            {dayLabel(shipment.arrivesOnDay)}{" "}
                            <span className="text-xs text-muted-foreground">
                              · {relativeDay(shipment.arrivesOnDay, plan.today)}
                            </span>
                          </span>
                        )}
                        <ArrivalPill onTime={entry.onTime} />
                        {entry.eventDelay > 0 ? (
                          <StatusPill tone="warning" icon={CalendarClock}>
                            +{entry.eventDelay} j : événement
                          </StatusPill>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {entry.revenue === null ? "—" : credits(entry.revenue)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
