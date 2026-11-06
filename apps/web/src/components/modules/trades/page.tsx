import type { TradeOffer } from "@etic/engine";
import { ConfirmDialog } from "@/components/game/confirm-dialog";
import { PageHeader } from "@/components/game/page-header";
import { StatCard } from "@/components/game/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGameCommand } from "@/lib/commands";
import { credits } from "@/lib/format";
import { useView } from "@/lib/game";
import { TradeComposer } from "./composer";
import { tradeHistory } from "./history";
import {
  acceptConsequences,
  goodLabel,
  optionShortName,
  partnerName,
  partnersOf,
  receivedOfferPlan,
  shipmentLines,
  tradeOverview,
} from "./trade-math";
import { MessageList } from "./trade-ui";

function Offer({ offer, received }: { offer: TradeOffer; received: boolean }) {
  const view = useView();
  const { send, pending, canAct } = useGameCommand();
  const plan = receivedOfferPlan(view, offer);
  return (
    <li className="space-y-3 border-b py-5 last:border-0">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <h3 className="font-semibold">{goodLabel(offer.good)}</h3>
          <p className="text-sm text-muted-foreground">
            {received ? "De" : "Pour"}{" "}
            {partnerName(view.competitors, received ? offer.sellerId : offer.buyerId)} · expire jour{" "}
            {offer.expiresOnDay}
          </p>
        </div>
        <span className="tabular text-xl font-semibold">{credits(offer.price)}</span>
      </div>
      <p className="text-sm">
        {optionShortName(offer.option)} · transport payé par{" "}
        {offer.shippingPaidBy === "seller" ? "le vendeur" : "l'acheteur"}
      </p>
      {received ? <MessageList messages={plan.messages} /> : null}
      <div className="flex gap-2">
        {received ? (
          <>
            <ConfirmDialog
              title="Accepter cet échange ?"
              description={`${goodLabel(offer.good)} de ${plan.seller}. ${credits(plan.dueNow)} à mobiliser maintenant.`}
              consequences={acceptConsequences(plan)}
              confirmLabel="Accepter l'offre"
              trigger={<Button disabled={!canAct || pending || !plan.canAccept}>Accepter</Button>}
              onConfirm={async () =>
                (
                  await send(
                    "trade.accept",
                    { offerId: offer.id },
                    { success: "Échange accepté, marchandises en route." },
                  )
                ).ok
                  ? undefined
                  : false
              }
            />
            <Button
              variant="outline"
              disabled={!canAct || pending}
              onClick={() =>
                void send("trade.decline", { offerId: offer.id }, { success: "Offre refusée." })
              }
            >
              Refuser
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            disabled={!canAct || pending}
            onClick={() =>
              void send("trade.withdraw", { offerId: offer.id }, { success: "Offre retirée." })
            }
          >
            Retirer l'offre
          </Button>
        )}
      </div>
    </li>
  );
}

export function TradesPage() {
  const view = useView();
  const overview = tradeOverview(view.trades, view.team.id);
  const shipments = shipmentLines(view);
  const history = tradeHistory(
    view.team.log,
    partnersOf(view.competitors).map((partner) => partner.name),
  );
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Échanges"
        title="Les affaires se négocient ensemble."
        description="Convenez d'un accord en personne, puis formalisez-le ici. Seules les deux entreprises concernées et l'organisateur voient vos échanges."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Offres reçues" value={overview.received.length} />
        <StatCard
          label="Votre argent sous séquestre"
          value={credits(overview.inEscrow)}
          hint="Versé au vendeur à l'arrivée"
        />
        <StatCard
          label="À encaisser"
          value={credits(overview.toCollect)}
          hint="Contrats en cours de livraison"
        />
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Offres reçues</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.received.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune offre reçue. Négociez avec une autre équipe pour qu'elle vous en propose une.
              </p>
            ) : (
              <ul>
                {overview.received.map((offer) => (
                  <Offer key={offer.id} offer={offer} received />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Vos offres en attente</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.sent.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Vos propositions apparaîtront ici jusqu'à leur acceptation, refus ou expiration.
              </p>
            ) : (
              <ul>
                {overview.sent.map((offer) => (
                  <Offer key={offer.id} offer={offer} received={false} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Un nouvel accord</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="offer">
            <TabsList>
              <TabsTrigger value="offer">Proposer une vente</TabsTrigger>
              <TabsTrigger value="goods">Donner des marchandises</TabsTrigger>
              <TabsTrigger value="money">Virer de l'argent</TabsTrigger>
            </TabsList>
            <TabsContent value="offer" className="pt-5">
              <TradeComposer mode="offer" />
            </TabsContent>
            <TabsContent value="goods" className="pt-5">
              <TradeComposer mode="goods" />
            </TabsContent>
            <TabsContent value="money" className="pt-5">
              <TradeComposer mode="money" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Marchandises en route</CardTitle>
        </CardHeader>
        <CardContent>
          {shipments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun échange en transit.</p>
          ) : (
            <ul className="divide-y">
              {shipments.map(({ shipment, direction, partner, afterEnd }) => (
                <li
                  key={shipment.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-medium">
                      {direction === "in" ? "Reçu de" : "Envoyé à"} {partner} ·{" "}
                      {goodLabel(shipment.good)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Arrivée jour {shipment.arrivesOnDay} ·{" "}
                      {shipment.kind === "gift"
                        ? "Don"
                        : `${credits(shipment.escrow)} sous séquestre`}
                    </p>
                    {afterEnd ? (
                      <p className="text-sm text-warning">
                        Arrivée après la fin prévue : marchandises perdues, séquestre remboursé.
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Historique des échanges</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun échange enregistré.</p>
          ) : (
            <ol className="divide-y">
              {history.slice(0, 30).map(({ entry }) => (
                <li key={entry.id} className="flex gap-4 py-2 text-sm">
                  <span className="tabular shrink-0 text-muted-foreground">J{entry.day}</span>
                  <span>{entry.message}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
