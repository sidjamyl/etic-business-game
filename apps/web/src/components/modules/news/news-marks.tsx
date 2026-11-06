import { type NewsSource, newsSources, type RegionId } from "@etic/content";
import { Globe, type LucideIcon, MapPin, Newspaper, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { regionLabel, sourceKinds } from "./news-feed";

/** Each paper keeps its icon everywhere (feed, filters, legend): never colour alone. */
export const sourceIcon: Record<NewsSource, LucideIcon> = { serious: Newspaper, tabloid: Zap };

const sourceTone: Record<NewsSource, string> = {
  serious: "text-foreground",
  tabloid: "text-cacao",
};

/** Masthead of a paper: icon, name and what kind of paper it is (story 73). */
export function SourceMark({ source, className }: { source: NewsSource; className?: string }) {
  const Icon = sourceIcon[source];
  return (
    <span className={cn("inline-flex items-center gap-1.5", sourceTone[source], className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="eyebrow">{newsSources[source]}</span>
      <span className="text-xs text-muted-foreground">· {sourceKinds[source]}</span>
    </span>
  );
}

/** Region a news is about (or the whole continent); the team's own region stands out. */
export function RegionTag({ region, own }: { region: RegionId | null; own: boolean }) {
  const Icon = region === null ? Globe : MapPin;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
        own ? "border-night/40 font-medium text-foreground" : "text-muted-foreground",
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {regionLabel(region)}
      {own ? <span className="font-normal text-muted-foreground">· votre région</span> : null}
    </span>
  );
}

/** Unread marker, in the colour of the navigation badge, with a word (never colour alone). */
export function NewBadge() {
  return <span className="eyebrow rounded-full bg-power-red px-2 py-0.5 text-milk">Nouveau</span>;
}
