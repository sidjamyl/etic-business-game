import type { RegionId } from "@etic/content";
import type { PublicNews } from "@etic/engine";
import { useId } from "react";
import { dayLabel, stepLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ageLabel } from "./news-feed";
import { NewBadge, RegionTag, SourceMark } from "./news-marks";

/**
 * One news of the feed, on the charter's editorial grid (DESIGN.md §5): the date in a narrow
 * column, then paper, region, headline and full text. The text is never shortened: some
 * secrets hide in it. Nothing tells whether the news is true (R11).
 */
export function NewsItem({
  item,
  isNew,
  ownRegion,
  today,
  stepsPerDay,
}: {
  item: PublicNews;
  isNew: boolean;
  ownRegion: RegionId | null;
  today: number;
  stepsPerDay: number;
}) {
  const titleId = useId();
  return (
    <article
      aria-labelledby={titleId}
      className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4 py-4"
    >
      <div className={cn("border-r pr-4 text-right", isNew && "border-r-2 border-r-power-red")}>
        <p
          className={cn(
            "tabular font-display text-base leading-tight font-bold whitespace-nowrap uppercase",
            isNew && "text-power-red",
          )}
        >
          {dayLabel(item.day)}
        </p>
        <p className="text-xs text-muted-foreground">{stepLabel(item.step, stepsPerDay)}</p>
        <p className="text-xs text-muted-foreground">{ageLabel(item.day, today)}</p>
      </div>
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <SourceMark source={item.source} />
          <RegionTag region={item.region} own={item.region !== null && item.region === ownRegion} />
          {isNew ? <NewBadge /> : null}
        </div>
        <h3 id={titleId} className="font-sans text-base leading-snug font-semibold text-pretty">
          {item.title}
        </h3>
        <p className="max-w-prose text-sm leading-relaxed text-pretty">{item.body}</p>
      </div>
    </article>
  );
}
