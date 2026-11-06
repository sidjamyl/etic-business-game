import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { ratingTone } from "@/components/game/impact-badge";
import { cn } from "@/lib/utils";
import { levelLabels, type RatingLevel, ratingLevel } from "./impact-math";

const levelIcon = { good: CircleCheck, fair: TriangleAlert, poor: CircleAlert } as const;

/**
 * Meter colours (D1: Pousse, Ocre, Power red): the fill carries the level, the track is a
 * lighter step of the same colour so the level reads across the whole meter.
 */
export const levelFill: Record<RatingLevel, string> = {
  good: "bg-success",
  fair: "bg-warning",
  poor: "bg-destructive",
};

export const levelTrack: Record<RatingLevel, string> = {
  good: "bg-success/15",
  fair: "bg-warning/15",
  poor: "bg-destructive/15",
};

const clamp = (value: number) => Math.min(100, Math.max(0, value));

/** Level of a 0–100 rating in words, with an icon: never colour alone (DESIGN.md §3). */
export function RatingPill({ value, className }: { value: number; className?: string }) {
  const level = ratingLevel(value);
  const Icon = levelIcon[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        ratingTone(value),
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      <span className="sr-only">Niveau </span>
      {levelLabels[level]}
    </span>
  );
}

/** A sub-score on 0–100; dashed and empty while it has no data (it does not count yet). */
export function ScoreBar({ value, className }: { value: number | null; className?: string }) {
  if (value === null) {
    return <div aria-hidden className={cn("h-2 rounded-full border border-dashed", className)} />;
  }
  const level = ratingLevel(value);
  return (
    <div
      aria-hidden
      className={cn("h-2 overflow-hidden rounded-full", levelTrack[level], className)}
    >
      <div
        className={cn("h-full rounded-full", levelFill[level])}
        style={{ width: `${clamp(value)}%` }}
      />
    </div>
  );
}
