import { type NewsSource, newsSources, type RegionId } from "@etic/content";
import { Globe, type LucideIcon, MapPin, Newspaper, Zap } from "lucide-react";
import { dayLabel, regionName, stepLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FakeNewsDraft } from "./card-math";

/** Same marks as the news feed (#36): each paper keeps its icon, never colour alone. */
export const sourceIcon: Record<NewsSource, LucideIcon> = { serious: Newspaper, tabloid: Zap };

export const sourceKinds: Record<NewsSource, string> = {
  serious: "quotidien sérieux",
  tabloid: "tabloïd",
};

/** How each paper writes, as the news page presents them; never whether a news is true. */
export const sourceBlurbs: Record<NewsSource, string> = {
  serious: "Le journal de référence du continent, au ton posé.",
  tabloid: "Scoops, rumeurs et gros titres : plus sensationnaliste.",
};

export const sourceOrder: readonly NewsSource[] = ["serious", "tabloid"];

const sourceTone: Record<NewsSource, string> = {
  serious: "text-foreground",
  tabloid: "text-cacao",
};

export function SourceMark({ source }: { source: NewsSource }) {
  const Icon = sourceIcon[source];
  return (
    <span className={cn("inline-flex items-center gap-1.5", sourceTone[source])}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="eyebrow">{newsSources[source]}</span>
      <span className="text-xs text-muted-foreground">· {sourceKinds[source]}</span>
    </span>
  );
}

function RegionTag({ region, own }: { region: RegionId | null; own: boolean }) {
  const Icon = region === null ? Globe : MapPin;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
        own ? "border-night/40 font-medium text-foreground" : "text-muted-foreground",
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {region === null ? "Tout le continent" : regionName(region)}
      {own ? <span className="font-normal text-muted-foreground">· votre région</span> : null}
    </span>
  );
}

/**
 * The fake news as every company will read it in the feed: date, paper, region, headline and
 * text, with nothing telling it apart from a real one (R11). `compact` drops the date column
 * (confirmation dialog).
 */
export function NewsPreview({
  draft,
  ownRegion,
  day,
  step,
  stepsPerDay,
  compact = false,
}: {
  draft: FakeNewsDraft;
  ownRegion: RegionId | null;
  day: number;
  step: number;
  stepsPerDay: number;
  compact?: boolean;
}) {
  const title = draft.title.trim();
  const body = draft.body.trim();
  return (
    <article
      aria-label="Aperçu de la news"
      className={cn(
        "rounded-lg border bg-card p-4",
        !compact && "grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4",
      )}
    >
      {compact ? null : (
        <div className="border-r-2 border-r-power-red pr-4 text-right">
          <p className="tabular font-display text-base leading-tight font-bold whitespace-nowrap text-power-red uppercase">
            {dayLabel(day)}
          </p>
          <p className="text-xs text-muted-foreground">{stepLabel(step, stepsPerDay)}</p>
          <p className="text-xs text-muted-foreground">Aujourd'hui</p>
        </div>
      )}
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <SourceMark source={draft.source} />
          <RegionTag
            region={draft.region}
            own={draft.region !== null && draft.region === ownRegion}
          />
        </div>
        <h3
          className={cn(
            "font-sans text-base leading-snug font-semibold text-pretty break-words",
            !title && "font-normal text-muted-foreground italic",
          )}
        >
          {title || "Votre titre apparaîtra ici"}
        </h3>
        <p
          className={cn(
            "max-w-prose text-sm leading-relaxed text-pretty break-words",
            !body && "text-muted-foreground italic",
          )}
        >
          {body || "Puis le texte de votre news."}
        </p>
      </div>
    </article>
  );
}
