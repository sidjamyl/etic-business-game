import type { MachineOffer, TeamState } from "@etic/engine";
import { Factory, ShoppingCart, Users } from "lucide-react";
import { useId, useState } from "react";
import { EthicsBadges } from "@/components/game/impact-badge";
import { InfoTip } from "@/components/game/info-tip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGameCommand } from "@/lib/commands";
import { credits } from "@/lib/format";
import { useView } from "@/lib/game";
import { BuyMachineForm } from "./buy-machine-form";
import { CompatibleProducts } from "./compatible-products";
import { DelayCell, RestockCell, StockCell, SupplierCell } from "./offer-cells";
import { OrderDialog } from "./order-dialog";
import { groupMachineOffers, type MachineGroup, machineCounts } from "./purchase-math";

function ownedLabel(count: { owned: number; incoming: number } | undefined): string {
  const owned = count?.owned ?? 0;
  const incoming = count?.incoming ?? 0;
  const label = owned === 0 ? "Aucune dans votre atelier" : `${owned} dans votre atelier`;
  return incoming > 0 ? `${label} · ${incoming} en route` : label;
}

function MachineOfferRow({
  offer,
  typeName,
  today,
  disabled,
  onBuy,
}: {
  offer: MachineOffer;
  typeName: string;
  today: number;
  disabled: boolean;
  onBuy: (offerKey: string) => void;
}) {
  return (
    <TableRow>
      <TableCell className="pl-4">
        <SupplierCell name={offer.supplierName} region={offer.supplierRegion} />
      </TableCell>
      <TableCell className="tabular text-right font-medium">{credits(offer.price)}</TableCell>
      <TableCell className="text-right">
        <DelayCell days={offer.deliveryDays} today={today} />
      </TableCell>
      <TableCell>
        <EthicsBadges social={offer.ethics.social} environmental={offer.ethics.environmental} />
      </TableCell>
      <TableCell className="text-right">
        <StockCell stock={offer.stock} />
      </TableCell>
      <TableCell className="text-right">
        <RestockCell day={offer.nextRestockDay} today={today} />
      </TableCell>
      <TableCell className="pr-4 text-right">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || offer.stock < 1}
          onClick={() => onBuy(`${offer.supplierId}:${offer.machineTypeId}`)}
          aria-label={`Acheter « ${typeName} » chez ${offer.supplierName}`}
        >
          <ShoppingCart aria-hidden />
          Acheter
        </Button>
      </TableCell>
    </TableRow>
  );
}

function MachineCard({
  group,
  team,
  count,
  today,
  disabled,
  onBuy,
}: {
  group: MachineGroup;
  team: TeamState;
  count: { owned: number; incoming: number } | undefined;
  today: number;
  disabled: boolean;
  onBuy: (offerKey: string) => void;
}) {
  const headingId = useId();
  const { type, offers } = group;
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <section aria-labelledby={headingId}>
        <div className="border-b px-4 py-4">
          <h2 id={headingId} className="text-xl font-bold uppercase">
            {type.name}
          </h2>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" aria-hidden />
              {type.operatorsRequired} opérateur{type.operatorsRequired > 1 ? "s" : ""} requis
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Factory className="size-4" aria-hidden />
              {ownedLabel(count)}
            </span>
          </p>
        </div>
        <div className="grid xl:grid-cols-[minmax(0,2fr)_minmax(0,5fr)]">
          <CompatibleProducts
            team={team}
            type={type}
            className="border-b px-4 py-4 xl:border-r xl:border-b-0"
          />
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Fournisseur</TableHead>
                <TableHead className="text-right">Prix</TableHead>
                <TableHead className="text-right">Délai</TableHead>
                <TableHead>
                  <span className="inline-flex items-center gap-1.5">
                    Note éthique <InfoTip term="ethics" />
                  </span>
                </TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Réappro.</TableHead>
                <TableHead className="pr-4">
                  <span className="sr-only">Action</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((offer) => (
                <MachineOfferRow
                  key={offer.supplierId}
                  offer={offer}
                  typeName={type.name}
                  today={today}
                  disabled={disabled}
                  onBuy={onBuy}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </Card>
  );
}

/**
 * Equipment suppliers (R4, R5, story 30): one card per machine type with its compatible
 * products and the offers of each supplier. Buying before unlocking a tier is allowed.
 */
export function MachineShop() {
  const view = useView();
  const command = useGameCommand();
  const [target, setTarget] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const { team } = view;
  const today = view.clock.time.day;
  const counts = machineCounts(team);
  const disabled = !command.canAct || command.pending;

  const buy = (offerKey: string) => {
    setTarget(offerKey);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Une machine fabrique un seul produit à la fois parmi ses produits compatibles et ne tourne
        qu'avec ses opérateurs. Elle est livrée à l'atelier, sans occuper l'entrepôt. Vous pouvez
        l'acheter avant d'avoir débloqué ses produits.
      </p>
      {groupMachineOffers(view.market.machines).map((group) => (
        <MachineCard
          key={group.type.id}
          group={group}
          team={team}
          count={counts[group.type.id]}
          today={today}
          disabled={disabled}
          onBuy={buy}
        />
      ))}
      <OrderDialog open={open} onOpenChange={setOpen} locked={command.pending}>
        {target ? (
          <BuyMachineForm
            key={target}
            offerKey={target}
            command={command}
            onDone={() => setOpen(false)}
          />
        ) : null}
      </OrderDialog>
    </div>
  );
}
