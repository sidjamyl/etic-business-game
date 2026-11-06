import { Factory, Leaf, MapPin, ShoppingCart, Truck } from "lucide-react";
import { TransportImpactBadge } from "@/components/game/impact-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { percent, regionName } from "@/lib/format";
import { useView } from "@/lib/game";
import {
  averageLabel,
  countedScores,
  countLabel,
  optionLabel,
  optionMode,
  optionsByImpact,
  producedByTier,
  productionSentence,
  purchasesSentence,
  type TransportMix,
  transportMix,
  transportSentence,
} from "./impact-math";
import { IndicatorTotal, ModuleLink, SubScoreRow } from "./sub-score-row";

/** Customer deliveries per transport option, with the option's environmental rating (R8). */
function OptionMix({ mix }: { mix: TransportMix }) {
  return (
    <ul className="grid gap-1.5 pt-1" aria-label="Livraisons clients par option de transport">
      {optionsByImpact.map((option) => {
        const units = mix.byOption[option];
        return (
          <li key={option} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <TransportImpactBadge option={option} />
              <span className="text-foreground">{optionLabel(option)}</span>
              <span className="truncate text-xs">{optionMode(option)}</span>
            </span>
            <span className="tabular flex shrink-0 items-baseline gap-3">
              <span className="text-xs">{countLabel(units, "unité", "unités")}</span>
              <span className="w-10 text-right font-medium text-foreground">
                {percent(units / mix.deliveries)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Environmental indicator (R17, N20): purchases, production and transport sub-scores, the
 * facts behind each one and the levers to improve them.
 */
export function EnvironmentalDetail() {
  const { team, impact } = useView();
  const scores = impact.breakdown.environmental;
  const purchases = team.impact.purchases;
  const mix = transportMix(team);
  const ferronia = team.region === "ferronia";
  const counted = countedScores([scores.purchases, scores.production, scores.transport]);

  return (
    <Card>
      <CardHeader>
        <CardTitle
          className="eyebrow flex items-center gap-2 text-muted-foreground"
          role="heading"
          aria-level={2}
        >
          <Leaf className="size-4" aria-hidden />
          Détail environnemental
        </CardTitle>
        <CardDescription>
          Trois sous-notes sur 100, pondérées par vos volumes depuis le début de la partie.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y">
          <SubScoreRow
            icon={ShoppingCart}
            label="Achats de matières"
            value={scores.purchases}
            empty="Aucune matière achetée pour l'instant."
            lever={
              <>
                Comparez la note environnementale (
                <Leaf className="inline size-3.5 align-[-2px]" aria-hidden />) des fournisseurs :
                les moins chers sont souvent les moins vertueux, le marché noir est le pire de tous.{" "}
                <ModuleLink to="/play/achats">Achats</ModuleLink>
              </>
            }
          >
            <p>
              {purchasesSentence(
                purchases.units,
                purchases.lowRatedUnits,
                team.blackMarket.purchasedUnits,
              )}
            </p>
          </SubScoreRow>

          <SubScoreRow
            icon={Factory}
            label="Production"
            value={scores.production}
            empty="Rien n'a encore été produit."
            lever={`Plus un produit est évolué, plus son empreinte est forte${ferronia ? ", et Ferronia pollue davantage" : ""} : compensez par des fournisseurs bien notés et le transport vert.`}
          >
            <p>{productionSentence(producedByTier(team.stats.produced))}</p>
            {ferronia ? (
              <p className="flex items-start gap-1.5">
                <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Production à {regionName(team.region)} : la pollution alourdit l'empreinte de chaque
                unité.
              </p>
            ) : null}
          </SubScoreRow>

          <SubScoreRow
            icon={Truck}
            label="Transport"
            value={scores.transport}
            empty="Aucune expédition pour l'instant."
            lever={
              <>
                L'option verte est la plus propre mais la plus lente, l'express la plus polluante :
                choisissez la verte quand le délai le permet.{" "}
                <ModuleLink to="/play/livraisons">Livraisons</ModuleLink>
              </>
            }
          >
            <p>{transportSentence(mix)}</p>
            {mix.deliveries > 0 ? <OptionMix mix={mix} /> : null}
          </SubScoreRow>
        </ul>
        <IndicatorTotal value={impact.environmental}>{averageLabel(counted)}</IndicatorTotal>
      </CardContent>
    </Card>
  );
}
