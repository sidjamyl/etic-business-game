import { machineTypeById } from "@etic/content";
import { availableCash } from "@etic/engine";
import { Factory } from "lucide-react";
import { EthicsBadges } from "@/components/game/impact-badge";
import { relativeDay } from "@/components/modules/warehouse/warehouse-math";
import { credits, dayLabel, formatNumber, regionName } from "@/lib/format";
import { useView } from "@/lib/game";
import { CompatibleProducts } from "./compatible-products";
import {
  type GameCommand,
  OrderForm,
  OrderMessages,
  OrderSummary,
  SummaryItem,
} from "./order-dialog";
import {
  blockedReason,
  compatibleProducts,
  hasError,
  machineOrderMessages,
  productLock,
} from "./purchase-math";

/**
 * Machine order (R4, R5, story 30): price, arrival, operators and compatible products.
 * Buying a machine before unlocking its products is allowed: the form only warns.
 */
export function BuyMachineForm({
  offerKey,
  command,
  onDone,
}: {
  offerKey: string;
  command: GameCommand;
  onDone: () => void;
}) {
  const view = useView();
  const offer = view.market.machines[offerKey];
  const type = offer ? machineTypeById.get(offer.machineTypeId) : undefined;
  if (!offer || !type) return null;

  const { team, clock } = view;
  const today = clock.time.day;
  const cash = availableCash(team);
  const arrivalDay = offer.deliveryDays === null ? null : today + offer.deliveryDays;
  const messages = machineOrderMessages({
    supplierName: offer.supplierName,
    typeName: type.name,
    stock: offer.stock,
    nextRestockDay: offer.nextRestockDay,
    price: offer.price,
    cash,
    locks: compatibleProducts(type).map(({ productId }) => ({
      productId,
      lock: productLock(team, productId),
    })),
  });

  const confirm = async () => {
    const arrival = arrivalDay === null ? "" : `, livraison prévue jour ${arrivalDay}`;
    const result = await command.send(
      "purchase.buyMachine",
      { supplierId: offer.supplierId, machineTypeId: offer.machineTypeId },
      { success: `Machine commandée : ${type.name}${arrival}.` },
    );
    if (result.ok) onDone();
  };

  return (
    <OrderForm
      eyebrow={`Commande · ${offer.supplierName}`}
      title={type.name}
      description={
        <>
          <span>
            {offer.supplierName} · {regionName(offer.supplierRegion)}
          </span>
          <EthicsBadges social={offer.ethics.social} environmental={offer.ethics.environmental} />
          <span className="tabular">Stock : {formatNumber(offer.stock)}</span>
        </>
      }
      confirmLabel={`Acheter · ${credits(offer.price)}`}
      canConfirm={!hasError(messages) && command.canAct}
      busy={command.pending}
      blocked={command.canAct ? null : blockedReason(clock.status)}
      onConfirm={confirm}
    >
      <OrderSummary>
        <SummaryItem
          label="Prix payé maintenant"
          value={credits(offer.price)}
          hint="prix ajusté à votre région"
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
          value={credits(cash - offer.price)}
          hint={`actuellement ${credits(cash)}`}
        />
        <SummaryItem
          label="Opérateurs requis"
          value={formatNumber(type.operatorsRequired)}
          hint="à affecter dans Production"
        />
      </OrderSummary>
      <CompatibleProducts team={team} type={type} className="mt-4" />
      <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <Factory className="mt-px size-3.5 shrink-0" aria-hidden />
        Livrée directement à l'atelier : elle n'occupe pas de place dans l'entrepôt.
      </p>
      <OrderMessages messages={messages} />
    </OrderForm>
  );
}
