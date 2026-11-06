import type { SupplierOffer } from "@etic/engine";
import { Ban } from "lucide-react";
import { useId, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dayLabel, formatNumber, regionName } from "@/lib/format";
import { useView } from "@/lib/game";
import { materialLabel, relativeDay, supplierGroups } from "./card-math";
import { Fact } from "./fact";
import { PlayCardAction } from "./play-card-action";
import { usePlayCard } from "./use-play-card";

/** What the chosen supplier offers now and when its next restock comes. */
function SupplierFacts({
  supplier,
  material,
  today,
}: {
  supplier: SupplierOffer;
  material: string;
  today: number;
}) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <Fact label="Matière" value={material} hint={regionName(supplier.region)} />
      <Fact
        label="Stock actuel"
        value={
          supplier.stock > 0 ? (
            formatNumber(supplier.stock)
          ) : (
            <span className="inline-flex items-center gap-1.5 text-destructive">
              <Ban className="size-4" aria-hidden />
              Rupture
            </span>
          )
        }
        hint="Partagé par toutes les entreprises"
      />
      <Fact
        label="Réapprovisionnement"
        value={dayLabel(supplier.nextRestockDay)}
        hint={`${relativeDay(supplier.nextRestockDay, today)} : votre jour d'exclusivité`}
      />
      <Fact
        label="Délai de livraison"
        value={supplier.deliveryDays === null ? "—" : `${supplier.deliveryDays} j`}
        hint="Jusqu'à votre région"
      />
    </dl>
  );
}

/**
 * Supplier priority (story 94): choose a material supplier; on its next restock day it sells
 * to this company only.
 */
export function SupplierPriorityForm() {
  const view = useView();
  const { play, locked } = usePlayCard();
  const selectId = useId();
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const groups = supplierGroups(view.market.suppliers);
  const supplier = supplierId ? (view.market.suppliers[supplierId] ?? null) : null;
  const today = view.clock.time.day;
  const name = supplier?.name ?? "ce fournisseur";
  const day = supplier?.nextRestockDay ?? today;

  return (
    <form onSubmit={(event) => event.preventDefault()} noValidate className="space-y-5">
      <div className="grid gap-1.5">
        <Label htmlFor={selectId}>Fournisseur de matières premières</Label>
        <Select value={supplier?.id ?? ""} onValueChange={setSupplierId} disabled={locked}>
          <SelectTrigger id={selectId} className="w-full max-w-md">
            <SelectValue placeholder="Choisir un fournisseur" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((group) => (
              <SelectGroup key={group.material}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.suppliers.map((offer) => (
                  <SelectItem key={offer.id} value={offer.id}>
                    {offer.name} · {regionName(offer.region)}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {supplier ? (
        <div className="space-y-3">
          <SupplierFacts
            supplier={supplier}
            material={materialLabel(supplier.material)}
            today={today}
          />
          <p className="text-sm text-pretty">
            Le <span className="tabular font-medium">jour {day}</span>, {name} ne vendra qu'à vous :
            son stock tout juste réapprovisionné vous est réservé toute la journée.
          </p>
        </div>
      ) : null}

      <PlayCardAction
        locked={locked}
        ready={supplier !== null}
        hint={
          supplier
            ? `Exclusivité le jour ${day} (${relativeDay(day, today)}) : pensez à commander ce jour-là.`
            : "Choisissez un fournisseur pour continuer."
        }
        title={`Priorité chez ${name} ?`}
        description={`Le jour ${day}, jour de son prochain réapprovisionnement, ${name} ne vendra qu'à vous.`}
        consequences={[
          "Ce jour-là, les autres entreprises sont refusées chez lui : elles sauront seulement qu'un client prioritaire est servi.",
          `Passez commande le jour ${day} : l'exclusivité ne dure que cette journée.`,
        ]}
        confirmLabel="Obtenir la priorité"
        onConfirm={() =>
          supplier
            ? play(
                { kind: "supplier-priority", supplierId: supplier.id },
                `Priorité obtenue : le jour ${day}, ${name} ne vendra qu'à vous. Notez-le !`,
              )
            : Promise.resolve(false)
        }
      />
    </form>
  );
}
