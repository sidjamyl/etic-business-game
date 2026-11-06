import { ArrowLeftRight, Coins, Layers, type LucideIcon, Tag, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { InfoTip } from "@/components/game/info-tip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { boostLabel, rangeFactorLabel } from "./marketing-math";

/** How a campaign works (R10, N14), in words: never as a formula. */
export function MarketingRules() {
  const boost = boostLabel();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground" role="heading" aria-level={2}>
          Comment ça marche
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4 text-sm">
          <Rule icon={TrendingUp} title={`${boost} d'attractivité`} info>
            Sur toute la cible et pendant toute la durée, vos offres attirent davantage que celles
            de vos concurrents.
          </Rule>
          <Rule icon={ArrowLeftRight} title="Des parts de marché, pas de clients en plus">
            La demande d'une région ne change pas : la campagne prend des clients à vos concurrents.
            Seul sur un marché, vous n'y gagnez rien.
          </Rule>
          <Rule icon={Layers} title="Pas de cumul">
            Là où deux campagnes se recouvrent, l'effet reste de {boost}. Une même cible n'a qu'une
            campagne à la fois.
          </Rule>
          <Rule icon={Tag} title="Seulement là où vous vendez">
            Sans prix fixé dans Ventes, la campagne n'agit pas. Et plus de commandes ne veut pas
            dire plus de ventes : il faut du stock pour les honorer.
          </Rule>
          <Rule icon={Coins} title="Payée au lancement">
            Le coût suit la population de la cible et la durée ; toute la gamme coûte{" "}
            {rangeFactorLabel()} fois plus qu'un seul produit. Aucun remboursement.
          </Rule>
        </ul>
      </CardContent>
    </Card>
  );
}

function Rule({
  icon: Icon,
  title,
  info = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  info?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 space-y-1">
        <p className="flex items-center gap-1.5 font-medium">
          {title}
          {info ? <InfoTip term="attractiveness" /> : null}
        </p>
        <p className="text-pretty text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}
