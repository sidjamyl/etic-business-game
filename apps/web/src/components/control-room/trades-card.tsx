import { ArrowRight, FileSignature, Gift, type LucideIcon } from "lucide-react";
import { useId } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { credits } from "@/lib/format";
import { EmptyLine, Pill, SectionTitle, SubTitle } from "./bits";
import {
  type AdminCompanies,
  type AdminTradeOffer,
  type AdminTradeShipment,
  type AdminTrades,
  companyNameOf,
  goodLabel,
  transportLabel,
} from "./control-room-helpers";

/** "Seller → Buyer", readable aloud as "de … à …". */
function Parties({
  sellerId,
  buyerId,
  companies,
}: {
  sellerId: string;
  buyerId: string;
  companies: AdminCompanies;
}) {
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 font-medium">
      <span className="sr-only">De </span>
      <span>{companyNameOf(companies, sellerId)}</span>
      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="sr-only"> à </span>
      <span>{companyNameOf(companies, buyerId)}</span>
    </p>
  );
}

function OfferItem({ offer, companies }: { offer: AdminTradeOffer; companies: AdminCompanies }) {
  return (
    <li className="space-y-0.5 py-2">
      <Parties sellerId={offer.sellerId} buyerId={offer.buyerId} companies={companies} />
      <p className="text-sm">
        {goodLabel(offer.good)} pour <span className="tabular">{credits(offer.price)}</span>
      </p>
      <p className="tabular text-xs text-muted-foreground">
        {transportLabel(offer.option)} · transport payé par{" "}
        {offer.shippingPaidBy === "seller" ? "le vendeur" : "l'acheteur"} · expire à la fin du jour{" "}
        {offer.expiresOnDay}
      </p>
    </li>
  );
}

const shipmentKind: Record<AdminTradeShipment["kind"], { label: string; icon: LucideIcon }> = {
  contract: { label: "Contrat", icon: FileSignature },
  gift: { label: "Don", icon: Gift },
};

function ShipmentItem({
  shipment,
  companies,
}: {
  shipment: AdminTradeShipment;
  companies: AdminCompanies;
}) {
  const kind = shipmentKind[shipment.kind];
  return (
    <li className="space-y-0.5 py-2">
      <div className="flex items-start justify-between gap-3">
        <Parties sellerId={shipment.sellerId} buyerId={shipment.buyerId} companies={companies} />
        <Pill tone="neutral" icon={kind.icon}>
          {kind.label}
        </Pill>
      </div>
      <p className="text-sm">
        {goodLabel(shipment.good)}
        {shipment.kind === "contract" ? (
          <>
            {" "}
            · <span className="tabular">{credits(shipment.escrow)}</span> bloqués jusqu'à l'arrivée
          </>
        ) : null}
      </p>
      <p className="tabular text-xs text-muted-foreground">
        Arrivée au jour {shipment.arrivesOnDay}
      </p>
    </li>
  );
}

/** Trades in progress (R15): private between two companies, the organizer sees them all. */
export function TradesCard({
  trades,
  companies,
}: {
  trades: AdminTrades;
  companies: AdminCompanies;
}) {
  const offersId = useId();
  const shipmentsId = useId();
  const offers = [...trades.offers].sort((a, b) => b.createdDay - a.createdDay);
  const shipments = [...trades.shipments].sort((a, b) => a.arrivesOnDay - b.arrivesOnDay);

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <SectionTitle>Échanges entre entreprises</SectionTitle>
        <CardDescription>
          Privés entre les deux entreprises concernées : vous seul voyez tous les accords.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 px-5">
        <section aria-labelledby={offersId} className="space-y-1">
          <SubTitle id={offersId}>Offres en attente · {trades.offers.length}</SubTitle>
          {offers.length === 0 ? (
            <EmptyLine>Aucune offre en attente de réponse.</EmptyLine>
          ) : (
            <ul className="divide-y">
              {offers.map((offer) => (
                <OfferItem key={offer.id} offer={offer} companies={companies} />
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby={shipmentsId} className="space-y-1">
          <SubTitle id={shipmentsId}>En route · {trades.shipments.length}</SubTitle>
          {shipments.length === 0 ? (
            <EmptyLine>Aucune marchandise en route entre entreprises.</EmptyLine>
          ) : (
            <ul className="divide-y">
              {shipments.map((shipment) => (
                <ShipmentItem key={shipment.id} shipment={shipment} companies={companies} />
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
