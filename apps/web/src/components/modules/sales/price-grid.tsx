import {
  type ProductId,
  productById,
  products,
  type RegionId,
  regions,
  travelDays,
} from "@etic/content";
import { availableStock, campaignBoost } from "@etic/engine";
import { Lock, MapPin, Megaphone, TriangleAlert, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { InfoTip } from "@/components/game/info-tip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useGameCommand } from "@/lib/commands";
import { credits, itemLabel, percent, regionName } from "@/lib/format";
import { useCanAct, useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import {
  formatPriceInput,
  type PricePosition,
  parsePriceInput,
  plural,
  pricePosition,
  productLock,
} from "./sales";

/** Price grid product × region (R7, stories 55 and 64), with auto-acceptance per product. */
export function PriceGrid() {
  const { team } = useView();
  const canAct = useCanAct();
  const home = team.region;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground" role="heading" aria-level={2}>
          Grille de prix
        </CardTitle>
        <CardDescription>
          Un prix par produit et par région : sans prix, vous ne vendez pas dans la région. Validez
          avec Entrée ; les commandes déjà reçues gardent le prix auquel elles ont été passées.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          Sous chaque prix : le prix local <InfoTip term="localPrice" /> et le prix maximal{" "}
          <InfoTip term="maxPrice" /> de la région.
        </p>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-56">Produit</TableHead>
              {regions.map((region) => {
                const isHome = region.id === home;
                return (
                  <TableHead key={region.id} className={cn("h-auto py-2", isHome && "bg-muted/60")}>
                    <span className="block font-semibold">{region.name}</span>
                    <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                      {isHome ? (
                        <>
                          <MapPin className="size-3" aria-hidden />
                          Votre région
                        </>
                      ) : home ? (
                        `Livraison : ${travelDays(home, region.id)} j`
                      ) : null}
                    </span>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id} className="hover:bg-transparent">
                <TableHead scope="row" className="h-auto py-3 align-top whitespace-normal">
                  <ProductCell productId={product.id} />
                </TableHead>
                {regions.map((region) => (
                  <TableCell
                    key={region.id}
                    className={cn(
                      "py-3 align-top whitespace-normal",
                      region.id === home && "bg-muted/40",
                    )}
                  >
                    {/* A pause or the end discards a price being typed (no stale edit on resume). */}
                    <PriceCell key={String(canAct)} region={region.id} productId={product.id} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          Acceptation auto : les nouvelles commandes du produit sont acceptées dès que votre stock
          disponible le permet. La demande des paliers 2 et 3 apparaît progressivement avec la
          reprise économique.
        </p>
      </CardContent>
    </Card>
  );
}

/** Row header: product, tier (locked tiers can still be sold after a trade), stock, auto-accept. */
function ProductCell({ productId }: { productId: ProductId }) {
  const { team } = useView();
  const tier = productById.get(productId)?.tier ?? 1;
  const lock = productLock(productId, team.progression);
  const stock = Math.max(0, availableStock(team, productId));
  const reserved = team.reserved[productId] ?? 0;
  return (
    <div className="space-y-1.5 font-normal">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={cn("font-medium", lock && "text-muted-foreground")}>
          {itemLabel(productId)}
        </span>
        <Badge variant="outline" className="tabular">
          Palier {tier}
        </Badge>
        {lock ? (
          <Tooltip>
            <TooltipTrigger
              type="button"
              aria-label={`${lock} : production impossible`}
              className="inline-flex text-muted-foreground hover:text-foreground"
            >
              <Lock className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-pretty">
              {lock} : vous ne pouvez pas encore le produire, mais vous pouvez vendre un stock reçu
              par échange.
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <p className="tabular text-xs text-muted-foreground">
        Stock : {plural(stock, "disponible", "disponibles")}
        {reserved > 0 ? ` · ${plural(reserved, "réservé", "réservés")}` : null}
      </p>
      <AutoAcceptSwitch productId={productId} />
    </div>
  );
}

function AutoAcceptSwitch({ productId }: { productId: ProductId }) {
  const { team } = useView();
  const { send, pending, canAct } = useGameCommand();
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={id}
        size="sm"
        checked={team.autoAccept[productId] === true}
        disabled={!canAct || pending}
        onCheckedChange={async (enabled) => {
          await send("sales.setAutoAccept", { productId, enabled });
        }}
      />
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        Acceptation auto<span className="sr-only"> : {itemLabel(productId)}</span>
      </Label>
    </div>
  );
}

/**
 * One editable price. The typed text stays local until Enter or leaving the field, then
 * sales.setPrice is sent; the live view shows the price the server kept.
 */
function PriceCell({ region, productId }: { region: RegionId; productId: ProductId }) {
  const { team, market } = useView();
  const { send, pending, canAct } = useGameCommand();
  const [draft, setDraft] = useState<string | null>(null);
  const saving = useRef(false);
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const price = team.prices[region]?.[productId];
  const hint = market.pricing[region]?.[productId];
  const input = draft === null ? null : parsePriceInput(draft);
  const error = input?.kind === "invalid" ? input.message : null;
  // What the hints describe: the price being typed when valid, else the live price.
  const preview =
    input === null || input.kind === "invalid"
      ? price
      : input.kind === "price"
        ? input.value
        : undefined;
  const disabled = !canAct || pending;
  const product = itemLabel(productId);
  const where = regionName(region);

  async function commit() {
    if (draft === null || saving.current) return;
    const parsed = parsePriceInput(draft);
    if (parsed.kind === "invalid") return;
    const next = parsed.kind === "price" ? parsed.value : null;
    if (next === (price ?? null)) {
      setDraft(null);
      return;
    }
    saving.current = true;
    await send("sales.setPrice", { region, productId, price: next });
    saving.current = false;
    setDraft(null);
  }

  async function remove() {
    setDraft(null);
    await send("sales.setPrice", { region, productId, price: null });
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <label htmlFor={id} className="sr-only">
          Prix : {product} à {where}
        </label>
        <div className="relative w-28">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground"
          >
            ₢
          </span>
          <Input
            id={id}
            value={draft ?? (price === undefined ? "" : formatPriceInput(price))}
            placeholder="Non vendu"
            inputMode="decimal"
            autoComplete="off"
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${errorId} ${hintId}` : hintId}
            className={cn(
              "tabular h-8 pr-2 pl-6 text-right",
              draft !== null && !error && "border-foreground/50",
            )}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              else if (event.key === "Escape") setDraft(null);
            }}
          />
        </div>
        {price !== undefined ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Retirer du marché : ${product} à ${where}`}
                disabled={disabled}
                // Keeps the field from saving its draft first: removing wins.
                onMouseDown={(event) => event.preventDefault()}
                onClick={remove}
              >
                <X />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Retirer du marché</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <div id={hintId} className="space-y-0.5 text-xs text-muted-foreground">
        {hint ? (
          <p className="tabular">
            Local {credits(hint.local)} · Max {credits(hint.max)}
          </p>
        ) : null}
        {preview !== undefined && hint ? (
          <PositionText position={pricePosition(preview, hint)} />
        ) : null}
        {preview !== undefined && campaignBoost(team, region, productId) > 1 ? (
          <p className="flex items-center gap-1">
            <Megaphone className="size-3 shrink-0" aria-hidden />
            Campagne en cours
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** How the price compares with the local price; above the maximum, nobody buys (story 64). */
function PositionText({ position }: { position: PricePosition }) {
  if (position.kind === "no-demand") {
    return (
      <p className="flex items-center gap-1 font-medium text-warning">
        <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
        Trop cher : aucune demande
      </p>
    );
  }
  if (position.kind === "local") return <p>Au prix local</p>;
  return (
    <p className="tabular">
      {percent(position.ratio)} {position.kind === "below" ? "moins cher" : "plus cher"}
      <span className="sr-only"> que le prix local</span>
    </p>
  );
}
