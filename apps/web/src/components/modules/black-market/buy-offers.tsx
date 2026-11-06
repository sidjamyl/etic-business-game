import { blackMarketRules, type MaterialId } from "@etic/content";
import { availableCash } from "@etic/engine";
import { PackageOpen, ShoppingCart, Truck } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGameCommand } from "@/lib/commands";
import { credits, dayLabel, formatNumber, itemLabel, percent, signedCredits } from "@/lib/format";
import { useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import {
  blackMarketDeliveries,
  blackMarketMaterialIds,
  blockedReason,
  buyGain,
  buyLimit,
  buyMessages,
  cheapestLegalPrice,
  convictionFine,
  dealAmount,
  formatDecimal,
  hasError,
  impactAfterPurchase,
  parseQuantity,
  priceGap,
  relativeDay,
  roomOnArrival,
  traceSummary,
  unitsLabel,
  weeklyStock,
} from "./black-market-math";
import {
  DealDialog,
  DealForm,
  DealMessages,
  DealSummary,
  type GameCommand,
  SummaryItem,
  TraceNotice,
} from "./deal-dialog";

const rules = blackMarketRules;

/**
 * Materials sold off the books (R13, story 82): price against the cheapest regular supplier,
 * shared stock and its restock day, deliveries on their way.
 */
export function BuyOffers() {
  const view = useView();
  const { blackMarket, team } = view;
  const today = view.clock.time.day;
  const deliveries = blackMarketDeliveries(team);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground" role="heading" aria-level={2}>
          Acheter des matières
        </CardTitle>
        <CardDescription>
          Environ {percent(rules.buyDiscount)} sous le prix moyen des fournisseurs, payé comptant et
          livré {relativeDay(today + rules.deliveryDays, today)}. Stock limité et partagé entre
          toutes les entreprises : réassort le jour {blackMarket.nextRestockDay}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Matière</TableHead>
              <TableHead className="text-right">Prix unitaire</TableHead>
              <TableHead className="text-right">Officiel</TableHead>
              <TableHead className="text-right">Stock restant</TableHead>
              <TableHead className="w-0">
                <span className="sr-only">Action</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {blackMarketMaterialIds(blackMarket.buy).map((material) => (
              <BuyRow key={material} material={material} />
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          Officiel : le fournisseur le moins cher pour vous aujourd'hui, région et événements
          compris, livré plus lentement.
        </p>
        {deliveries.length > 0 ? (
          <div className="rounded-lg border px-4 py-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Truck className="size-4 text-muted-foreground" aria-hidden />
              Livraisons du marché noir attendues
            </p>
            <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
              {deliveries.map((delivery) => (
                <li key={delivery.id} className="tabular">
                  {formatNumber(delivery.quantity)} × {itemLabel(delivery.item)} ·{" "}
                  {delivery.status === "waiting-space"
                    ? "arrivée, en attente de place dans l'entrepôt"
                    : `${dayLabel(delivery.arrivesOnDay)} (${relativeDay(delivery.arrivesOnDay, today)})`}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Black-market price and its gap to the regular price: sign and words, never colour alone. */
function PriceGap({ price, legal }: { price: number; legal: number }) {
  const gap = priceGap(price, legal);
  if (Math.abs(gap) < 0.005)
    return <span className="text-xs text-muted-foreground">même prix</span>;
  const cheaper = gap < 0;
  return (
    <span
      className={cn(
        "tabular rounded-full px-1.5 py-0.5 text-xs font-medium",
        cheaper ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
      )}
    >
      <span className="sr-only">
        {cheaper ? "moins cher que l'officiel : " : "plus cher que l'officiel : "}
      </span>
      {cheaper ? "−" : "+"}
      {percent(Math.abs(gap))}
    </span>
  );
}

function BuyRow({ material }: { material: MaterialId }) {
  const view = useView();
  const command = useGameCommand();
  const [open, setOpen] = useState(false);
  const offer = view.blackMarket.buy[material];
  if (!offer) return null;
  const legal = cheapestLegalPrice(view.market.suppliers, material);
  const weekly = weeklyStock(material);
  const banned = view.blackMarket.bannedUntilDay !== null;
  const soldOut = offer.stock <= 0;
  const name = itemLabel(material);
  return (
    <TableRow>
      <TableHead scope="row" className="font-medium">
        {name}
      </TableHead>
      <TableCell className="text-right">
        <span className="inline-flex items-center gap-2">
          {legal !== null ? <PriceGap price={offer.price} legal={legal} /> : null}
          <span className="tabular font-semibold">{credits(offer.price)}</span>
        </span>
      </TableCell>
      <TableCell className="tabular text-right text-muted-foreground">
        {legal === null ? "—" : credits(legal)}
      </TableCell>
      <TableCell className="text-right">
        {soldOut ? (
          <span className="inline-flex items-center gap-1 font-medium text-warning">
            <PackageOpen className="size-3.5" aria-hidden />
            Épuisé
          </span>
        ) : (
          <span className="tabular">
            {formatNumber(offer.stock)}
            {weekly !== null ? (
              <span className="text-muted-foreground"> / {formatNumber(weekly)}</span>
            ) : null}
          </span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <DealDialog
          open={open}
          onOpenChange={setOpen}
          locked={command.pending}
          trigger={
            <Button
              size="sm"
              variant="outline"
              disabled={!command.canAct || command.pending || banned || soldOut}
            >
              <ShoppingCart aria-hidden />
              Acheter…<span className="sr-only"> {name}</span>
            </Button>
          }
        >
          <BuyForm material={material} command={command} onDone={() => setOpen(false)} />
        </DealDialog>
      </TableCell>
    </TableRow>
  );
}

/**
 * A purchase: quantity within the shared stock and the available cash, total paid now,
 * delivery day and warehouse room, fine at stake and impact (0/100 on both indicators, R17).
 */
function BuyForm({
  material,
  command,
  onDone,
}: {
  material: MaterialId;
  command: GameCommand;
  onDone: () => void;
}) {
  const view = useView();
  const inputId = useId();
  const helpId = useId();
  const [text, setText] = useState("");
  const offer = view.blackMarket.buy[material];
  if (!offer) return null;

  const { team, clock, impact } = view;
  const today = clock.time.day;
  const arrival = today + rules.deliveryDays;
  const cash = availableCash(team);
  const input = parseQuantity(text);
  const quantity = input.kind === "valid" ? input.quantity : null;
  const cost = quantity === null ? 0 : dealAmount(offer.price, quantity);
  const limit = buyLimit(offer.stock, offer.price, cash);
  const room = roomOnArrival(team, view.warehouseUsed, arrival);
  const messages = buyMessages({
    input,
    stock: offer.stock,
    nextRestockDay: view.blackMarket.nextRestockDay,
    cost,
    cash,
    room,
  });
  const bannedUntil = view.blackMarket.bannedUntilDay;
  const blocked =
    bannedUntil !== null
      ? `Votre entreprise est exclue du marché noir jusqu'au jour ${bannedUntil}.`
      : command.canAct
        ? null
        : blockedReason(clock.status);
  const traces = traceSummary(team.blackMarket.traces, today);
  const gain = quantity === null ? 0 : buyGain(material, offer.price, quantity);
  const after = quantity === null ? null : impactAfterPurchase(team, quantity);
  const name = itemLabel(material);

  const confirm = async () => {
    if (quantity === null) return;
    const result = await command.send(
      "blackMarket.buy",
      { material, quantity },
      {
        success: `Achat discret : ${formatNumber(quantity)} × ${name}, livraison le jour ${arrival}.`,
      },
    );
    if (result.ok) onDone();
  };

  return (
    <DealForm
      eyebrow="Marché noir · achat"
      title={name}
      description={`${credits(offer.price)} l'unité · stock partagé entre toutes les entreprises : ${unitsLabel(offer.stock)}.`}
      confirmLabel={quantity === null ? "Acheter" : `Acheter · ${credits(cost)}`}
      canConfirm={
        quantity !== null && !hasError(messages) && command.canAct && bannedUntil === null
      }
      busy={command.pending}
      blocked={blocked}
      onConfirm={confirm}
    >
      <div className="grid gap-2">
        <Label htmlFor={inputId}>Quantité (unités)</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={1}
            max={Math.max(1, offer.stock)}
            step={1}
            placeholder="Ex. 50"
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-invalid={hasError(messages)}
            aria-describedby={helpId}
            className="tabular w-36"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={limit.max === 0}
            onClick={() => setText(String(limit.max))}
          >
            Maximum : {formatNumber(limit.max)}
          </Button>
        </div>
        <p id={helpId} className="text-xs text-muted-foreground">
          {limit.limitedBy === "stock"
            ? "Maximum : tout le stock restant."
            : "Maximum selon votre trésorerie disponible."}
        </p>
      </div>

      <div>
        <DealSummary>
          <SummaryItem
            label="Total payé maintenant"
            value={quantity === null ? "—" : credits(cost)}
            hint={
              quantity === null
                ? `${credits(offer.price)} l'unité`
                : `${formatNumber(quantity)} × ${credits(offer.price)}`
            }
            emphasis
          />
          <SummaryItem
            label="Livraison"
            value={dayLabel(arrival)}
            hint={`${relativeDay(arrival, today)} · place prévue : ${unitsLabel(Math.max(0, room))}`}
          />
          <SummaryItem
            label="Trésorerie disponible après"
            value={quantity === null ? "—" : credits(cash - cost)}
            hint={`actuellement ${credits(cash)}`}
          />
          <SummaryItem
            label="Amende si démasqué"
            value={
              quantity === null
                ? traces.count > 0
                  ? credits(traces.fine)
                  : "—"
                : credits(convictionFine(traces.gain + gain))
            }
            hint={
              quantity === null
                ? "selon vos traces actuelles"
                : `gain illicite de l'affaire : ${signedCredits(gain)}`
            }
          />
          <SummaryItem
            label="Environnement"
            value={
              after === null
                ? `${formatDecimal(impact.environmental)} / 100`
                : `${formatDecimal(impact.environmental)} → ${formatDecimal(after.environmental)}`
            }
            hint="achat noté 0/100"
          />
          <SummaryItem
            label="Social"
            value={
              after === null
                ? `${formatDecimal(impact.social)} / 100`
                : `${formatDecimal(impact.social)} → ${formatDecimal(after.social)}`
            }
            hint="achat noté 0/100"
          />
        </DealSummary>
        <DealMessages messages={messages} />
      </div>

      <TraceNotice portLibre={team.region === "port-libre"} traceDays={rules.traceDays} />
    </DealForm>
  );
}
