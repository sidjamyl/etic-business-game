import type { MaterialId } from "@etic/content";
import { availableCash } from "@etic/engine";
import { useId, useState } from "react";
import { EthicsBadges } from "@/components/game/impact-badge";
import {
  relativeDay,
  roomAtArrival,
  unitsLabel,
} from "@/components/modules/warehouse/warehouse-math";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { credits, dayLabel, formatNumber, itemLabel, percent, regionName } from "@/lib/format";
import { useView } from "@/lib/game";
import {
  type GameCommand,
  OrderForm,
  OrderMessages,
  OrderSummary,
  SummaryItem,
} from "./order-dialog";
import {
  blockedReason,
  eventPriceShift,
  exactUnitPrice,
  hasError,
  MAX_ORDER_QUANTITY,
  materialOrderMessages,
  maxOrderQuantity,
  orderTotal,
  parseQuantity,
  unitPriceLabel,
} from "./purchase-math";

/**
 * Raw-material order (R4, stories 26–28 and 31): quantity, total paid now, arrival day and
 * warehouse space, with explicit refusals before anything is sent. Values follow the live view.
 */
export function BuyMaterialForm({
  supplierId,
  command,
  onDone,
}: {
  supplierId: string;
  command: GameCommand;
  onDone: () => void;
}) {
  const view = useView();
  const inputId = useId();
  const helpId = useId();
  const [text, setText] = useState("");
  const offer = view.market.suppliers[supplierId];
  if (!offer) return null;

  const { team, clock } = view;
  const today = clock.time.day;
  const material = offer.material as MaterialId;
  const unitPrice = exactUnitPrice(offer, team.region);
  const shift = eventPriceShift(offer, team.region);
  const cash = availableCash(team);
  const quantity = parseQuantity(text);
  const total = quantity === null ? 0 : orderTotal(unitPrice, quantity);
  const arrivalDay = offer.deliveryDays === null ? null : today + offer.deliveryDays;
  const space = roomAtArrival({ team, used: view.warehouseUsed, arrivalDay });
  const max = maxOrderQuantity(offer.stock, unitPrice, cash);
  const fill = Math.min(space.room, max);

  const messages = materialOrderMessages({
    text,
    quantity,
    supplierName: offer.name,
    stock: offer.stock,
    nextRestockDay: offer.nextRestockDay,
    total,
    cash,
    room: space.room,
  });
  const valid = quantity !== null && !hasError(messages);

  const priceHint = [
    quantity === null ? null : `${formatNumber(quantity)} ×`,
    `${unitPriceLabel(unitPrice)} l'unité`,
    shift === 0 ? null : `(${shift > 0 ? "+" : "−"}${percent(Math.abs(shift))}, événement)`,
  ]
    .filter(Boolean)
    .join(" ");
  const spaceHint = [
    `${unitsLabel(space.free, "libre")} aujourd'hui`,
    space.incoming > 0 ? `− ${formatNumber(space.incoming)} déjà en route` : null,
    space.extension > 0 ? `+ ${formatNumber(space.extension)} d'extension` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const confirm = async () => {
    if (quantity === null) return;
    const arrival = arrivalDay === null ? "" : `, arrivée prévue jour ${arrivalDay}`;
    const result = await command.send(
      "purchase.buyMaterial",
      { supplierId, quantity },
      {
        success: `Commande passée : ${formatNumber(quantity)} × ${itemLabel(material)}${arrival}.`,
      },
    );
    if (result.ok) onDone();
  };

  return (
    <OrderForm
      eyebrow={`Commande · ${itemLabel(material)}`}
      title={offer.name}
      description={
        <>
          <span>{regionName(offer.region)}</span>
          <EthicsBadges social={offer.ethics.social} environmental={offer.ethics.environmental} />
          <span className="tabular">Stock : {unitsLabel(offer.stock)}</span>
        </>
      }
      confirmLabel={quantity === null ? "Commander" : `Commander · ${credits(total)}`}
      canConfirm={valid && command.canAct}
      busy={command.pending}
      blocked={command.canAct ? null : blockedReason(clock.status)}
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
            max={Math.max(1, Math.min(offer.stock, MAX_ORDER_QUANTITY))}
            step={1}
            placeholder="Ex. 200"
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
            disabled={max === 0}
            onClick={() => setText(String(max))}
          >
            Maximum : {formatNumber(max)}
          </Button>
          {fill < max ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={fill === 0}
              onClick={() => setText(String(fill))}
            >
              Place libre : {formatNumber(fill)}
            </Button>
          ) : null}
        </div>
        <p id={helpId} className="text-xs text-muted-foreground">
          Maximum selon le stock du fournisseur et votre trésorerie disponible.
        </p>
      </div>

      <div className="mt-4">
        <OrderSummary>
          <SummaryItem
            label="Total payé maintenant"
            value={quantity === null ? "—" : credits(total)}
            hint={priceHint}
            emphasis
          />
          <SummaryItem
            label="Arrivée prévue"
            value={arrivalDay === null ? "—" : dayLabel(arrivalDay)}
            hint={
              arrivalDay === null
                ? undefined
                : `${relativeDay(arrivalDay, today)} · délai ${offer.deliveryDays} j`
            }
          />
          <SummaryItem
            label="Trésorerie disponible après"
            value={quantity === null ? "—" : credits(cash - total)}
            hint={`actuellement ${credits(cash)}`}
          />
          <SummaryItem
            label="Place à l'arrivée"
            value={unitsLabel(space.room, "libre")}
            hint={spaceHint}
          />
        </OrderSummary>
        <OrderMessages messages={messages} />
      </div>
    </OrderForm>
  );
}
