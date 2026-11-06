import { blackMarketRules, type ProductId, productById } from "@etic/content";
import { availableStock, localPrice } from "@etic/engine";
import { HandCoins } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGameCommand } from "@/lib/commands";
import { credits, formatNumber, itemLabel, percent, signedCredits } from "@/lib/format";
import { useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import {
  blockedReason,
  convictionFine,
  dealAmount,
  formatDecimal,
  hasError,
  parseQuantity,
  plural,
  sellableProducts,
  sellGain,
  sellLimit,
  sellMessages,
  traceSummary,
  unitsLabel,
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
 * Finished products sold off the books (R13, stories 83–84): price above the local price,
 * paid now, within a daily volume per product (wider in Port-Libre).
 */
export function SellOffers() {
  const view = useView();
  const { team } = view;
  const productIds = sellableProducts(team);
  const anyStock = productIds.some((id) => availableStock(team, id) > 0);
  // Port-Libre's wider access: more buyers, so higher daily caps (R3, story 84).
  const caps =
    team.region === "port-libre"
      ? `À Port-Libre, les acheteurs sont plus nombreux : plafonds ×${formatDecimal(rules.portLibreFactor)}.`
      : "";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground" role="heading" aria-level={2}>
          Écouler des produits
        </CardTitle>
        <CardDescription>
          {`${percent(rules.sellPremium)} au-dessus du prix local de votre région, payé comptant, sans livraison ni effet sur votre réputation. Les acheteurs ne prennent qu'un volume limité par jour et par produit. ${caps}`.trim()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Produit</TableHead>
              <TableHead className="text-right">Prix unitaire</TableHead>
              <TableHead>Vendus aujourd'hui</TableHead>
              <TableHead className="w-0">
                <span className="sr-only">Action</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productIds.map((productId) => (
              <SellRow key={productId} productId={productId} />
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          {anyStock
            ? "Seul le stock disponible se vend ici : les produits réservés à vos commandes acceptées restent à l'entrepôt. Plafonds remis à zéro chaque jour."
            : "Aucun produit fini disponible pour l'instant : produisez ou recevez un stock pour l'écouler ici. Les produits réservés à vos commandes ne se vendent pas."}
        </p>
      </CardContent>
    </Card>
  );
}

/** Units sold today against the daily cap: figures first, the bar only illustrates. */
function CapMeter({ cap, sold }: { cap: number; sold: number }) {
  const left = Math.max(0, cap - sold);
  const ratio = cap > 0 ? Math.min(1, sold / cap) : 1;
  return (
    <div className="min-w-36 space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="tabular font-medium">
          {formatNumber(sold)} / {formatNumber(cap)}
        </span>
        <span className={cn("text-xs", left === 0 ? "text-warning" : "text-muted-foreground")}>
          {left === 0 ? "plafond atteint" : `encore ${formatNumber(left)}`}
        </span>
      </div>
      <Progress
        value={ratio * 100}
        aria-label={`${formatNumber(sold)} vendus sur ${formatNumber(cap)} autorisés aujourd'hui`}
        className="h-1.5"
      />
    </div>
  );
}

function SellRow({ productId }: { productId: ProductId }) {
  const view = useView();
  const command = useGameCommand();
  const [open, setOpen] = useState(false);
  const offer = view.blackMarket.sell[productId];
  if (!offer) return null;
  const { team } = view;
  const available = Math.max(0, availableStock(team, productId));
  const reserved = team.reserved[productId] ?? 0;
  const limit = sellLimit(offer.cap, offer.soldToday, available);
  const local = team.region ? (view.market.pricing[team.region]?.[productId]?.local ?? null) : null;
  const banned = view.blackMarket.bannedUntilDay !== null;
  const tier = productById.get(productId)?.tier ?? 1;
  const name = itemLabel(productId);
  return (
    <TableRow>
      <TableHead scope="row" className="h-auto py-2.5 font-normal">
        <span className="block font-medium">{name}</span>
        <span className="tabular block text-xs text-muted-foreground">
          Palier {tier} · {plural(available, "disponible")}
          {reserved > 0 ? ` · ${plural(reserved, "réservé")}` : ""}
        </span>
      </TableHead>
      <TableCell className="text-right">
        <span className="tabular block font-semibold">
          {offer.price > 0 ? credits(offer.price) : "—"}
        </span>
        {local !== null ? (
          <span className="tabular block text-xs text-muted-foreground">
            local {credits(local)}
          </span>
        ) : null}
      </TableCell>
      <TableCell>
        <CapMeter cap={offer.cap} sold={offer.soldToday} />
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
              disabled={
                !command.canAct || command.pending || banned || limit.max === 0 || offer.price <= 0
              }
            >
              <HandCoins aria-hidden />
              Vendre…<span className="sr-only"> {name}</span>
            </Button>
          }
        >
          <SellForm productId={productId} command={command} onDone={() => setOpen(false)} />
        </DealDialog>
      </TableCell>
    </TableRow>
  );
}

/**
 * A sale: quantity within today's cap and the available stock (reserved goods excluded),
 * cash received now, comparison with the local price and the fine at stake.
 */
function SellForm({
  productId,
  command,
  onDone,
}: {
  productId: ProductId;
  command: GameCommand;
  onDone: () => void;
}) {
  const view = useView();
  const inputId = useId();
  const helpId = useId();
  const [text, setText] = useState("");
  const offer = view.blackMarket.sell[productId];
  if (!offer) return null;

  const { team, clock } = view;
  const today = clock.time.day;
  const available = availableStock(team, productId);
  const limit = sellLimit(offer.cap, offer.soldToday, available);
  const input = parseQuantity(text);
  const quantity = input.kind === "valid" ? input.quantity : null;
  const sold = quantity ?? 0;
  const revenue = dealAmount(offer.price, sold);
  const local = team.region ? localPrice(team.region, productId) : null;
  const regular = local === null ? null : dealAmount(local, sold);
  const messages = sellMessages({ input, limit });
  const bannedUntil = view.blackMarket.bannedUntilDay;
  const blocked =
    bannedUntil !== null
      ? `Votre entreprise est exclue du marché noir jusqu'au jour ${bannedUntil}.`
      : command.canAct
        ? null
        : blockedReason(clock.status);
  const traces = traceSummary(team.blackMarket.traces, today);
  const gain = sellGain(team.region, productId, offer.price, sold);
  const name = itemLabel(productId);

  const confirm = async () => {
    if (quantity === null) return;
    const result = await command.send(
      "blackMarket.sell",
      { productId, quantity },
      {
        success: `Vente discrète : ${formatNumber(quantity)} × ${name}, ${credits(revenue)} encaissés.`,
      },
    );
    if (result.ok) onDone();
  };

  return (
    <DealForm
      eyebrow="Marché noir · vente"
      title={name}
      description={`${credits(offer.price)} l'unité, payé comptant · les acheteurs en prennent encore ${unitsLabel(limit.left)} aujourd'hui.`}
      confirmLabel={quantity === null ? "Vendre" : `Vendre · ${credits(revenue)}`}
      canConfirm={
        quantity !== null &&
        !hasError(messages) &&
        offer.price > 0 &&
        command.canAct &&
        bannedUntil === null
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
            max={Math.max(1, limit.max)}
            step={1}
            placeholder="Ex. 10"
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
          {limit.limitedBy === "cap"
            ? "Maximum : ce que les acheteurs prennent encore aujourd'hui."
            : "Maximum : votre stock disponible, hors produits réservés à vos commandes."}
        </p>
      </div>

      <div>
        <DealSummary>
          <SummaryItem
            label="Encaissé maintenant"
            value={quantity === null ? "—" : credits(revenue)}
            hint={
              quantity === null
                ? `${credits(offer.price)} l'unité`
                : `${formatNumber(quantity)} × ${credits(offer.price)}`
            }
            emphasis
          />
          <SummaryItem
            label="Au prix local"
            value={quantity === null || regular === null ? "—" : credits(regular)}
            hint={
              quantity === null || regular === null
                ? local === null
                  ? undefined
                  : `${credits(local)} l'unité, avec livraison`
                : `soit ${signedCredits(revenue - regular)} ici`
            }
          />
          <SummaryItem
            label="Plafond du jour"
            value={`encore ${formatNumber(Math.max(0, limit.left - sold))}`}
            hint={`${formatNumber(offer.soldToday + sold)} / ${formatNumber(offer.cap)} vendus aujourd'hui`}
          />
          <SummaryItem
            label="Stock disponible après"
            value={unitsLabel(Math.max(0, available - sold))}
            hint={`actuellement ${unitsLabel(Math.max(0, available))}`}
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
            label="Réputation et impact"
            value="Inchangés"
            hint="ni client ni livraison"
          />
        </DealSummary>
        <DealMessages messages={messages} />
      </div>

      <TraceNotice portLibre={team.region === "port-libre"} traceDays={rules.traceDays} />
    </DealForm>
  );
}
