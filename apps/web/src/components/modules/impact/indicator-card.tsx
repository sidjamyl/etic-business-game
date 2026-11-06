import { impactRules } from "@etic/content";
import { type LucideIcon, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { InfoTip } from "@/components/game/info-tip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";
import { formatScore, fromStart, type RatingLevel, ratingLevel, signedScore } from "./impact-math";
import { RatingPill } from "./rating";

// Half circle from 0 (left) to 100 (right) through the top, in viewBox units.
const CX = 60;
const CY = 60;
const RADIUS = 50;
const STROKE = 10;
const ARC = `M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 0 1 ${CX + RADIUS} ${CY}`;

/** Same colours as the meters: the track is a lighter step of the fill (D1). */
const arcTone: Record<RatingLevel, { track: string; fill: string }> = {
  good: { track: "stroke-success/15", fill: "stroke-success" },
  fair: { track: "stroke-warning/15", fill: "stroke-warning" },
  poor: { track: "stroke-destructive/15", fill: "stroke-destructive" },
};

/** Point of the arc at `value` (0–100), `offset` units outside (+) or inside (−) its centre line. */
function arcPoint(value: number, offset: number) {
  const angle = Math.PI * (1 - value / 100);
  const radius = RADIUS + offset;
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
}

/** Decorative half-circle gauge: the value and its level are written next to it. */
function Gauge({ value }: { value: number }) {
  const tone = arcTone[ratingLevel(value)];
  const filled = Math.min(100, Math.max(0, value));
  // Tick on the starting level of every indicator (R17: 50).
  const tickIn = arcPoint(impactRules.neutral, -(STROKE / 2 + 3));
  const tickOut = arcPoint(impactRules.neutral, STROKE / 2 + 3);
  return (
    <svg viewBox="0 0 120 62" className="block w-full" aria-hidden>
      <path d={ARC} pathLength={100} fill="none" strokeWidth={STROKE} className={tone.track} />
      {filled > 0 ? (
        <path
          d={ARC}
          pathLength={100}
          fill="none"
          strokeWidth={STROKE}
          strokeDasharray={`${filled} 100`}
          className={tone.fill}
        />
      ) : null}
      <line
        x1={tickIn.x}
        y1={tickIn.y}
        x2={tickOut.x}
        y2={tickOut.y}
        strokeWidth={1.5}
        className="stroke-foreground/60"
      />
    </svg>
  );
}

/** Gap to the starting level, with a sign and an icon (never colour alone). */
function StartGap({ value }: { value: number }) {
  const gap = fromStart(value);
  if (gap === 0) {
    return (
      <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
        <Minus className="size-4" aria-hidden />
        Au niveau de départ ({impactRules.neutral})
      </p>
    );
  }
  const Icon = gap > 0 ? TrendingUp : TrendingDown;
  return (
    <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
      <span
        className={cn(
          "inline-flex items-center gap-1 font-medium",
          gap > 0 ? "text-success" : "text-destructive",
        )}
      >
        <Icon className="size-4" aria-hidden />
        <span className="tabular">
          {signedScore(gap)} {Math.abs(gap) >= 2 ? "points" : "point"}
        </span>
      </span>
      depuis le départ ({impactRules.neutral})
    </p>
  );
}

/** One indicator on 100 (R17): half-circle gauge, level, gap to the start and its causes. */
export function IndicatorCard({
  icon: Icon,
  label,
  info,
  value,
  causes,
}: {
  icon: LucideIcon;
  label: string;
  info: GlossaryKey;
  value: number;
  causes: string;
}) {
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-5">
        <div className="flex items-center gap-1.5">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          <CardTitle className="eyebrow text-muted-foreground" role="heading" aria-level={2}>
            {label}
          </CardTitle>
          <InfoTip term={info} />
        </div>
        <RatingPill value={value} />
      </CardHeader>
      <CardContent className="space-y-3 px-5">
        <div className="relative mx-auto w-full max-w-60">
          <Gauge value={value} />
          <p className="absolute inset-x-0 bottom-0 text-center leading-none">
            <span className="tabular text-4xl font-semibold">{formatScore(value)}</span>
            <span className="text-sm text-muted-foreground"> / 100</span>
          </p>
        </div>
        <StartGap value={value} />
        <p className="text-center text-xs text-muted-foreground">{causes}</p>
      </CardContent>
    </Card>
  );
}
