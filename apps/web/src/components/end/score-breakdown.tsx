import type { RankingEntry } from "@etic/engine";
import type { ReactNode } from "react";
import { InfoTip } from "@/components/game/info-tip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { credits } from "@/lib/format";
import { useView } from "@/lib/game";
import type { GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";
import {
  economicExplanation,
  finalFormula,
  impactExplanation,
  netCashOf,
  scoreWeights,
} from "./end-math";
import { ScoreOutOf100 } from "./end-section";

function Figure({
  label,
  info,
  value,
  hint,
  negative = false,
}: {
  label: string;
  info?: GlossaryKey;
  value: ReactNode;
  hint?: string;
  negative?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {label}
        {info ? <InfoTip term={info} /> : null}
      </dt>
      <dd className="text-right">
        <span className={cn("tabular font-medium", negative && "text-destructive")}>{value}</span>
        {hint ? <span className="tabular block text-xs text-muted-foreground">{hint}</span> : null}
      </dd>
    </div>
  );
}

/** One part of the final score: its weight, its score out of 100 and how it was obtained. */
function ScorePart({
  title,
  weight,
  score,
  formula,
  children,
}: {
  title: string;
  weight: string;
  score: number;
  formula: string;
  children: ReactNode;
}) {
  return (
    <Card className="gap-4">
      <CardHeader className="flex flex-row items-baseline justify-between gap-4">
        <CardTitle className="eyebrow text-muted-foreground">
          {title} · compte pour {weight}
        </CardTitle>
        <ScoreOutOf100 value={score} className="text-3xl font-semibold" />
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="space-y-2">{children}</dl>
        <p className="tabular rounded-md bg-muted px-3 py-2 text-sm text-pretty">{formula}</p>
      </CardContent>
    </Card>
  );
}

/** The detail of the team's final score (R18, story 118), step by step. */
export function ScoreBreakdown({ entry, best }: { entry: RankingEntry; best: number }) {
  const { team } = useView();
  // The ranking was computed when the game ended: only split it if the view still matches.
  const split =
    netCashOf(team) === entry.netCash
      ? `Trésorerie ${credits(team.cash)} − dette ${credits(team.finance.debt)}`
      : undefined;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <ScorePart
          title="Économie"
          weight={scoreWeights.economic}
          score={entry.economic}
          formula={economicExplanation(entry.netCash, best, entry.economic)}
        >
          <Figure
            label="Votre trésorerie nette"
            info="netCash"
            value={credits(entry.netCash)}
            hint={split}
            negative={entry.netCash < 0}
          />
          {best > 0 ? (
            <Figure label="Meilleure trésorerie nette de la partie" value={credits(best)} />
          ) : null}
        </ScorePart>
        <ScorePart
          title="Impact"
          weight={scoreWeights.impact}
          score={entry.impact}
          formula={impactExplanation(entry)}
        >
          <Figure
            label="Indicateur environnemental"
            info="environmental"
            value={<ScoreOutOf100 value={entry.environmental} />}
          />
          <Figure
            label="Indicateur social"
            info="social"
            value={<ScoreOutOf100 value={entry.social} />}
          />
        </ScorePart>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl bg-night px-6 py-4 text-milk">
        <p className="eyebrow">Score final</p>
        <p className="tabular text-lg font-semibold">
          {finalFormula(entry)}
          <span className="font-normal opacity-80"> / 100</span>
        </p>
      </div>
    </div>
  );
}
