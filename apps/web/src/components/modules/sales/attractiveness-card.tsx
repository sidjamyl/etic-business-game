import { describeTarget } from "@etic/engine";
import { Link } from "@tanstack/react-router";
import { type LucideIcon, Megaphone, Star, Tag, Truck } from "lucide-react";
import type { ReactNode } from "react";
import { InfoTip } from "@/components/game/info-tip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { dayLabel, regionName } from "@/lib/format";
import { useView } from "@/lib/game";
import type { GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";
import { plural, type ReputationLevel, reputationLevel } from "./sales";

const meterTone: Record<ReputationLevel["tone"], string> = {
  default: "[&>[data-slot=progress-indicator]]:bg-foreground",
  success: "[&>[data-slot=progress-indicator]]:bg-success",
  warning: "[&>[data-slot=progress-indicator]]:bg-warning",
  danger: "[&>[data-slot=progress-indicator]]:bg-destructive",
};

/** What attracts customers (R7: price, reputation, distance, marketing), never as a formula. */
export function AttractivenessCard() {
  const { team } = useView();
  const reputation = Math.round(team.reputation);
  const level = reputationLevel(reputation);
  const campaigns = Object.values(team.campaigns).sort((a, b) => a.endDay - b.endDay);
  return (
    <Card>
      <CardHeader>
        <CardTitle
          className="eyebrow flex items-center gap-1.5 text-muted-foreground"
          role="heading"
          aria-level={2}
        >
          Ce qui attire vos clients <InfoTip term="attractiveness" />
        </CardTitle>
        <CardDescription>
          Dans chaque région, les clients d'un produit se partagent entre les entreprises qui le
          vendent : plus votre offre attire, plus vous recevez de commandes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-4 text-sm">
          <Factor icon={Tag} title="Le prix" info="localPrice">
            <p>
              Comparé au prix local de la région : moins cher, vous attirez davantage ; au prix
              maximal, plus personne n'achète.
            </p>
          </Factor>
          <Factor icon={Star} title="La réputation" info="reputation">
            <div className="flex items-center gap-3">
              <Progress
                value={reputation}
                aria-label="Réputation"
                getValueLabel={(value) => `${value} sur 100, ${level.label.toLowerCase()}`}
                className={cn("h-2 bg-muted", meterTone[level.tone])}
              />
              <span className="tabular shrink-0 font-semibold text-foreground">
                {reputation} / 100
              </span>
            </div>
            <p>
              {level.label} ·{" "}
              {plural(team.stats.lateDeliveries, "livraison en retard", "livraisons en retard")} ·{" "}
              {plural(team.stats.failedOrders, "commande annulée", "commandes annulées")}
            </p>
            <p>
              Livrer à l'heure la fait monter ; retards, annulations et scandales la font baisser.
            </p>
          </Factor>
          <Factor icon={Truck} title="La distance">
            <p>
              Plus une région est loin de {team.region ? regionName(team.region) : "chez vous"},
              moins votre offre y attire : vos clients attendent leur livraison plus longtemps.
            </p>
          </Factor>
          <Factor icon={Megaphone} title="Le marketing">
            {campaigns.length === 0 ? (
              <p>Aucune campagne en cours.</p>
            ) : (
              <ul className="space-y-0.5">
                {campaigns.map((campaign) => (
                  <li key={campaign.id}>
                    {capitalize(describeTarget(campaign.region, campaign.productId))} · jusqu'au{" "}
                    {dayLabel(campaign.endDay).toLowerCase()}
                  </li>
                ))}
              </ul>
            )}
            <Link to="/play/marketing" className="inline-block text-primary hover:underline">
              Gérer les campagnes
            </Link>
          </Factor>
        </ul>
        <p className="border-t pt-3 text-xs text-muted-foreground">
          Plus de demande ne garantit pas plus de ventes : encore faut-il avoir le stock pour
          accepter les commandes et les livrer à temps.
        </p>
      </CardContent>
    </Card>
  );
}

function Factor({
  icon: Icon,
  title,
  info,
  children,
}: {
  icon: LucideIcon;
  title: string;
  info?: GlossaryKey;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="flex items-center gap-1.5 font-medium">
          {title}
          {info ? <InfoTip term={info} /> : null}
        </p>
        <div className="space-y-1.5 text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
