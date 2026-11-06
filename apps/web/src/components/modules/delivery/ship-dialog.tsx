import { deliveryRules, salesRules, type TransportOption, transportOptions } from "@etic/content";
import { PackageX, Timer, Truck } from "lucide-react";
import { useId, useState } from "react";
import { TransportImpactBadge } from "@/components/game/impact-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useGameCommand } from "@/lib/commands";
import { credits, dayLabel, formatNumber, itemLabel, percent, regionName } from "@/lib/format";
import { useCanAct, useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import {
  deliveryRevenue,
  type OrderToShip,
  optionMode,
  optionShortName,
  relativeDay,
  type ShippingQuote,
} from "./logistics";
import { ArrivalPill } from "./status-pill";

/** Where a new shipment would stand in the preparation queue. */
export interface QueueSlot {
  /** Day a shipment requested now should leave; null when nobody can prepare it. */
  nextDeparture: number | null;
  /** Shipments already waiting before it. */
  ahead: number;
  /** Shipments the logisticians prepare per day. */
  capacity: number;
}

function isTransportOption(value: string): value is TransportOption {
  return (transportOptions as readonly string[]).includes(value);
}

/** "Expédier" button of an accepted order, opening the comparison of the three options (R8). */
export function ShipDialog({ entry, slot }: { entry: OrderToShip; slot: QueueSlot }) {
  const [open, setOpen] = useState(false);
  const canAct = useCanAct();
  const { order } = entry;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          disabled={!canAct}
          aria-label={`Expédier ${formatNumber(order.quantity)} × ${itemLabel(order.productId)} vers ${regionName(order.region)}`}
        >
          <Truck aria-hidden />
          Expédier
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        {/* Mounted only while open: the chosen option resets at each opening. */}
        <ShipForm entry={entry} slot={slot} onShipped={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ShipForm({
  entry,
  slot,
  onShipped,
}: {
  entry: OrderToShip;
  slot: QueueSlot;
  onShipped: () => void;
}) {
  const { order, quotes } = entry;
  const { team, clock } = useView();
  const { send, pending, canAct } = useGameCommand();
  const [option, setOption] = useState<TransportOption>("standard");
  const groupId = useId();
  const today = clock.time.day;
  const selected = quotes.find((quote) => quote.option === option) ?? quotes[0];
  if (!selected) return null;
  const available = team.cash - team.reservedCash;
  const affordable = selected.cost <= available;
  const goods = `${formatNumber(order.quantity)} × ${itemLabel(order.productId)}`;
  const deadlinePassed = today > order.deadlineDay;
  const anyLate = quotes.some((quote) => quote.onTime === false);

  async function ship() {
    const result = await send(
      "delivery.ship",
      { orderId: order.id, option },
      { success: `Expédition programmée : ${goods} vers ${regionName(order.region)}.` },
    );
    if (result.ok) onShipped();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-xl uppercase">Expédier la commande</DialogTitle>
        <DialogDescription>
          {goods} pour {regionName(order.region)} · {credits(deliveryRevenue(order, true))} payés à
          la livraison · échéance {dayLabel(order.deadlineDay).toLowerCase()} (
          {deadlinePassed
            ? `dépassée de ${today - order.deadlineDay} j`
            : relativeDay(order.deadlineDay, today)}
          )
        </DialogDescription>
      </DialogHeader>

      <RadioGroup
        value={option}
        onValueChange={(value) => {
          if (isTransportOption(value)) setOption(value);
        }}
        aria-label="Option de transport"
        className="grid gap-4 sm:grid-cols-3"
      >
        {quotes.map((quote) => (
          <OptionCard
            key={quote.option}
            id={`${groupId}-${quote.option}`}
            quote={quote}
            selected={quote.option === option}
          />
        ))}
      </RadioGroup>

      <DepartureNote slot={slot} today={today} />

      {anyLate ? (
        <p className="text-sm text-muted-foreground">
          En retard, le client paie {percent(deliveryRules.lateDiscount)} de moins et votre
          réputation baisse de {Math.abs(salesRules.reputation.late)} points.
        </p>
      ) : null}

      <DialogFooter className="items-center gap-3 sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Délais hors retards d'événements. Le transport est payé à l'expédition, sans annulation.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {affordable ? null : (
            <span className="text-sm text-destructive" role="status">
              Trésorerie disponible insuffisante ({credits(available)})
            </span>
          )}
          <DialogClose asChild>
            <Button variant="outline">Annuler</Button>
          </DialogClose>
          <Button onClick={ship} disabled={!canAct || pending || !affordable}>
            <Truck aria-hidden />
            Expédier · {credits(selected.cost)}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

function OptionCard({
  id,
  quote,
  selected,
}: {
  id: string;
  quote: ShippingQuote;
  selected: boolean;
}) {
  const mode = optionMode(quote.option);
  return (
    // The dotted shadow sits on a wrapper so the card's background hides it (DESIGN.md §5).
    <div className={cn("rounded-xl", selected && "shadow-dotted")}>
      <label
        htmlFor={id}
        className={cn(
          "flex h-full cursor-pointer flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/40",
          selected && "border-primary ring-1 ring-primary hover:border-primary",
        )}
      >
        <span className="flex items-start justify-between gap-2">
          <span className="flex items-center gap-2">
            <RadioGroupItem id={id} value={quote.option} />
            <span className="font-medium">{optionShortName(quote.option)}</span>
          </span>
          <TransportImpactBadge option={quote.option} />
        </span>
        {mode ? <span className="-mt-2 pl-6 text-xs text-muted-foreground">{mode}</span> : null}
        <span className="tabular text-2xl font-semibold">{credits(quote.cost)}</span>
        <span className="grid gap-1 text-sm">
          <Figure label="Trajet" value={`${quote.travelDays} j`} />
          <Figure
            label="Arrivée"
            value={quote.arrivalDay === null ? "—" : dayLabel(quote.arrivalDay)}
          />
          <Figure label="Net après transport" value={credits(quote.revenue - quote.cost)} />
        </span>
        <ArrivalPill onTime={quote.onTime} />
      </label>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular font-medium">{value}</span>
    </span>
  );
}

function DepartureNote({ slot, today }: { slot: QueueSlot; today: number }) {
  if (slot.nextDeparture === null) {
    return (
      <p className="flex items-start gap-2 text-sm text-destructive">
        <PackageX className="mt-0.5 size-4 shrink-0" aria-hidden />
        Aucun logisticien ne peut préparer cette expédition pour l'instant : elle attendra dans la
        file, et l'échéance continue de courir.
      </p>
    );
  }
  const parts = [
    `Départ estimé ${dayLabel(slot.nextDeparture).toLowerCase()} (${relativeDay(slot.nextDeparture, today)})`,
  ];
  if (slot.ahead > 0) {
    parts.push(
      `${formatNumber(slot.ahead)} expédition${slot.ahead > 1 ? "s" : ""} avant elle dans la file`,
    );
  }
  parts.push(
    slot.capacity > 0
      ? `capacité de ${formatNumber(slot.capacity)} par jour`
      : "à l'arrivée de vos logisticiens",
  );
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <Timer className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{parts.join(" · ")}.</span>
    </p>
  );
}
