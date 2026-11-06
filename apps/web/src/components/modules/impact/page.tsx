import { Leaf, Users } from "lucide-react";
import { PageHeader } from "@/components/game/page-header";
import { useView } from "@/lib/game";
import { EnvironmentalDetail } from "./environmental-detail";
import { HintsCard } from "./hints-card";
import { IndicatorCard } from "./indicator-card";
import { ScoreCard } from "./score-card";
import { SocialDetail } from "./social-detail";

/**
 * Impact (#41, R17, R18, N20): the environmental and social indicators on 100, what they bring
 * to the final score, the server's hints, then each indicator's sub-scores and penalties with
 * the facts behind them and the levers to improve them. Read-only: the levers are pulled in
 * Achats, Livraisons and Équipe. Everything is derived from the live team view.
 */
export function ImpactPage() {
  const { impact, clock } = useView();
  const ended = clock.status === "ended";
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Impact"
        title="Social et environnement"
        description={
          ended
            ? "Partie terminée : voici vos indicateurs définitifs et ce qui les a fait bouger."
            : "Deux indicateurs sur 100 mesurent votre manière de produire. Ils partent de 50 et tiennent compte de toutes vos décisions depuis le début, pondérées par les volumes : grandir ne pénalise pas, mal produire si."
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <IndicatorCard
          icon={Leaf}
          label="Environnement"
          info="environmental"
          value={impact.environmental}
          causes="Fournisseurs, produits, région de production et transport."
        />
        <IndicatorCard
          icon={Users}
          label="Social"
          info="social"
          value={impact.social}
          causes="Salaires, fournisseurs, grèves, licenciements et marché noir."
        />
        <ScoreCard environmental={impact.environmental} social={impact.social} ended={ended} />
      </div>
      <HintsCard hints={impact.hints} />
      <div className="grid gap-6 xl:grid-cols-2">
        <EnvironmentalDetail />
        <SocialDetail />
      </div>
    </div>
  );
}
