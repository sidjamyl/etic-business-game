import { scoreRules } from "@etic/content";
import { InfoTip } from "@/components/game/info-tip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { percent } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ECONOMIC_POINTS,
  formatScore,
  IMPACT_POINTS,
  impactScore,
  ratingLevel,
  scoreContribution,
} from "./impact-math";
import { levelFill, levelTrack, RatingPill } from "./rating";

/**
 * The final score's two parts (R18): the economic part stays blank (it depends on the best
 * company, revealed at the end), the impact part fills with the current impact score.
 */
function ScoreSplit({ impact }: { impact: number }) {
  const level = ratingLevel(impact);
  const economic = { flexGrow: scoreRules.economicWeight };
  const share = { flexGrow: scoreRules.impactWeight };
  return (
    <div aria-hidden className="space-y-1.5">
      <div className="flex h-3 gap-0.5">
        <div className="basis-0 rounded-l-full bg-muted" style={economic} />
        <div
          className={cn("basis-0 overflow-hidden rounded-r-full", levelTrack[level])}
          style={share}
        >
          <div className={cn("h-full", levelFill[level])} style={{ width: `${impact}%` }} />
        </div>
      </div>
      <div className="flex gap-0.5 text-xs text-muted-foreground">
        <span className="basis-0" style={economic}>
          Économie {percent(scoreRules.economicWeight)}
        </span>
        <span className="basis-0 whitespace-nowrap" style={share}>
          Impact {percent(scoreRules.impactWeight)}
        </span>
      </div>
    </div>
  );
}

/** Impact score (average of both indicators) and what it brings to the final score (R18). */
export function ScoreCard({
  environmental,
  social,
  ended,
}: {
  environmental: number;
  social: number;
  ended: boolean;
}) {
  const impact = impactScore(environmental, social);
  const points = scoreContribution(impact);
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-5">
        <div className="flex items-center gap-1.5">
          <CardTitle className="eyebrow text-muted-foreground" role="heading" aria-level={2}>
            Score d'impact
          </CardTitle>
          <InfoTip term="impact" />
        </div>
        <RatingPill value={impact} />
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        <div>
          <p className="leading-none">
            <span className="tabular text-4xl font-semibold">{formatScore(impact)}</span>
            <span className="text-sm text-muted-foreground"> / 100</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Moyenne de vos indicateurs environnemental et social.
          </p>
        </div>
        <div className="space-y-2">
          <p className="eyebrow text-muted-foreground">Dans le score final</p>
          <ScoreSplit impact={impact} />
          <p className="text-sm">
            {ended ? "Votre impact vous rapporte " : "À ce niveau, votre impact vous rapporte "}
            <strong className="tabular font-semibold">
              {formatScore(points)} {points >= 2 ? "points" : "point"} sur {IMPACT_POINTS}
            </strong>
            .
          </p>
          <p className="text-xs text-muted-foreground">
            Les {ECONOMIC_POINTS} autres points viennent de votre trésorerie nette, comparée à celle
            de la meilleure entreprise :{" "}
            {ended ? "ils sont révélés avec le classement." : "ils ne seront connus qu'à la fin."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
