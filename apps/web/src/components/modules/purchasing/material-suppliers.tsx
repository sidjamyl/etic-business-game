import { type MaterialId, materials } from "@etic/content";
import type { SupplierOffer, TeamState } from "@etic/engine";
import { Lock, Search, SearchX, ShoppingCart } from "lucide-react";
import { useId, useState } from "react";
import { useSupplierCodeEgg } from "@/components/eggs/supplier-code-egg";
import { EmptyState } from "@/components/game/empty-state";
import { EthicsBadges } from "@/components/game/impact-badge";
import { InfoTip } from "@/components/game/info-tip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGameCommand } from "@/lib/commands";
import { credits, itemLabel, regionName } from "@/lib/format";
import { useView } from "@/lib/game";
import { BuyMaterialForm } from "./buy-material-form";
import { DelayCell, PriceShift, RestockCell, StockCell, SupplierCell } from "./offer-cells";
import { OrderDialog } from "./order-dialog";
import {
  eventPriceShift,
  groupOffers,
  type MaterialFilter,
  type MaterialGroup,
  productLock,
  productsUsing,
} from "./purchase-math";

const COLUMNS = 7;

/** Products made from a material; a lock marks those the company cannot make yet. */
function UsedFor({ material, team }: { material: MaterialId; team: TeamState }) {
  const productIds = productsUsing(material);
  if (productIds.length === 0) return null;
  return (
    <span className="font-normal text-muted-foreground">
      pour{" "}
      {productIds.map((productId, index) => {
        const lock = productLock(team, productId);
        return (
          <span key={productId}>
            {index > 0 ? ", " : null}
            {itemLabel(productId)}
            {lock ? (
              <span className="text-xs whitespace-nowrap">
                {" "}
                <Lock className="inline size-3 align-[-1px]" aria-hidden />{" "}
                {lock.kind === "tier" ? `palier ${lock.tier}` : "autre branche"}
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

function SupplierRow({
  offer,
  today,
  region,
  disabled,
  onOrder,
}: {
  offer: SupplierOffer;
  today: number;
  region: TeamState["region"];
  disabled: boolean;
  onOrder: (supplierId: string) => void;
}) {
  return (
    <TableRow>
      <TableCell className="pl-4">
        <SupplierCell name={offer.name} region={offer.region} />
      </TableCell>
      <TableCell className="text-right">
        <div className="tabular font-medium">{credits(offer.unitPrice)}</div>
        <PriceShift shift={eventPriceShift(offer, region)} />
      </TableCell>
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
          disabled={disabled || offer.stock === 0}
          onClick={() => onOrder(offer.id)}
          aria-label={`Commander chez ${offer.name}`}
        >
          <ShoppingCart aria-hidden />
          Commander
        </Button>
      </TableCell>
    </TableRow>
  );
}

function SupplierGroup({
  group,
  team,
  today,
  disabled,
  onOrder,
}: {
  group: MaterialGroup;
  team: TeamState;
  today: number;
  disabled: boolean;
  onOrder: (supplierId: string) => void;
}) {
  return (
    <TableBody>
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableHead scope="rowgroup" colSpan={COLUMNS} className="h-9 px-4 whitespace-normal">
          <span className="mr-2 font-semibold">{itemLabel(group.material)}</span>
          <UsedFor material={group.material} team={team} />
        </TableHead>
      </TableRow>
      {group.offers.map((offer) => (
        <SupplierRow
          key={offer.id}
          offer={offer}
          today={today}
          region={team.region}
          disabled={disabled}
          onOrder={onOrder}
        />
      ))}
    </TableBody>
  );
}

/**
 * Raw-material suppliers (R4, story 25): price, delay, ethics, shared stock and next restock,
 * filtered by material or searched by name. The search box also feeds a secret (R20).
 */
export function MaterialSuppliers() {
  const checkSecret = useSupplierCodeEgg();
  const view = useView();
  const command = useGameCommand();
  const filterId = useId();
  const searchId = useId();
  const [filter, setFilter] = useState<MaterialFilter>("all");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const { team } = view;
  const today = view.clock.time.day;
  const groups = groupOffers(Object.values(view.market.suppliers), filter, search);
  const disabled = !command.canAct || command.pending;

  const order = (supplierId: string) => {
    setTarget(supplierId);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor={filterId}>Matière</Label>
          <Select value={filter} onValueChange={(value) => setFilter(value as MaterialFilter)}>
            <SelectTrigger id={filterId} className="w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les matières</SelectItem>
              {materials.map((material) => (
                <SelectItem key={material.id} value={material.id}>
                  {material.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={searchId}>Rechercher un fournisseur</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id={searchId}
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                checkSecret(event.target.value);
              }}
              placeholder="Nom, région ou matière"
              autoComplete="off"
              spellCheck={false}
              className="w-72 pl-9"
            />
          </div>
        </div>
        <p className="ml-auto max-w-xs text-xs text-muted-foreground">
          Stocks partagés entre toutes les équipes, réapprovisionnés à date fixe : premier arrivé,
          premier servi.
        </p>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={SearchX} title="Aucun fournisseur trouvé">
          {search.trim()
            ? `Aucun résultat pour « ${search.trim()} ». Essayez un nom, une région ou une matière.`
            : "Aucun fournisseur pour cette matière."}
        </EmptyState>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableCaption className="mt-0 border-t px-4 py-3 text-left text-xs">
              Délai = préparation du fournisseur + transport jusqu'à {regionName(team.region)}. Prix
              par unité, ajustés à votre région.
            </TableCaption>
            <TableHeader className="bg-muted/60">
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Fournisseur</TableHead>
                <TableHead className="text-right">Prix unitaire</TableHead>
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
            {groups.map((group) => (
              <SupplierGroup
                key={group.material}
                group={group}
                team={team}
                today={today}
                disabled={disabled}
                onOrder={order}
              />
            ))}
          </Table>
        </Card>
      )}

      <OrderDialog open={open} onOpenChange={setOpen} locked={command.pending}>
        {target ? (
          <BuyMaterialForm
            key={target}
            supplierId={target}
            command={command}
            onDone={() => setOpen(false)}
          />
        ) : null}
      </OrderDialog>
    </div>
  );
}
