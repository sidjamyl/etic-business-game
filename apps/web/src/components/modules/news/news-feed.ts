import { type NewsSource, type RegionId, regionById, regions } from "@etic/content";
import type { PublicNews } from "@etic/engine";
import { formatNumber } from "@/lib/format";

/**
 * Pure helpers of the News module (#36, R11): order, filters and search of the feed, and its
 * labels. A news item never says whether it is true: only its paper, region and date.
 */

/** "continent" = news about the whole continent (no region in particular). */
export type RegionFilter = "all" | "continent" | RegionId;
export type SourceFilter = "all" | NewsSource;

export interface NewsFilters {
  source: SourceFilter;
  region: RegionFilter;
  query: string;
}

export const noFilters: NewsFilters = { source: "all", region: "all", query: "" };

/** News shown at first, then added by the same amount on demand. */
export const FEED_PAGE_SIZE = 20;

/** Display order of the two papers. */
export const sourceOrder: readonly NewsSource[] = ["serious", "tabloid"];

/** What each paper is (story 73), in the guide's words: both can be wrong. */
export const sourceKinds: Record<NewsSource, string> = {
  serious: "quotidien sérieux",
  tabloid: "tabloïd",
};

export function parseSourceFilter(value: string): SourceFilter {
  return sourceOrder.find((source) => source === value) ?? "all";
}

export function parseRegionFilter(value: string): RegionFilter {
  if (value === "continent") return "continent";
  return regions.find((region) => region.id === value)?.id ?? "all";
}

/** Region a news item is about, or the whole continent. */
export function regionLabel(region: RegionId | null): string {
  if (region === null) return "Tout le continent";
  return regionById.get(region)?.name ?? region;
}

export interface RegionOption {
  value: RegionFilter;
  label: string;
}

/** Choices of the region filter; the team's own region is pointed out. */
export function regionOptions(ownRegion: RegionId | null): RegionOption[] {
  return [
    { value: "all", label: "Toutes" },
    { value: "continent", label: "Tout le continent" },
    ...regions.map((region) => ({
      value: region.id,
      label: region.id === ownRegion ? `${region.name} (votre région)` : region.name,
    })),
  ];
}

/** Latest first. Ids come from one growing counter, so they follow publication order. */
export function latestFirst<T extends { id: number }>(items: readonly T[]): T[] {
  return items.toSorted((a, b) => b.id - a.id);
}

/** Id of the latest news, 0 before the first one. */
export function latestNewsId(news: readonly { id: number }[]): number {
  return news.reduce((latest, item) => Math.max(latest, item.id), 0);
}

/** News published after `seenBefore`, the last id already read. */
export function countNew(news: readonly { id: number }[], seenBefore: number): number {
  return news.filter((item) => item.id > seenBefore).length;
}

export function countBySource(news: readonly { source: NewsSource }[]): Record<NewsSource, number> {
  const counts: Record<NewsSource, number> = { serious: 0, tabloid: 0 };
  for (const item of news) counts[item.source] += 1;
  return counts;
}

/** Lower case, without accents or ligatures: "Entrepôt" matches "entrepot", "cœur" "coeur". */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[‘’]/g, "'");
}

/** Normalized words of a search; empty when the search is blank. */
export function searchWords(query: string): string[] {
  return normalizeText(query)
    .split(/\s+/)
    .filter((word) => word !== "");
}

/** Searchable text: title, body and the region's name (a news about Azura may not name it). */
function searchableText(item: PublicNews): string {
  const region = item.region === null ? "" : regionLabel(item.region);
  return normalizeText(`${item.title} ${item.body} ${region}`);
}

function matchesRegion(item: PublicNews, region: RegionFilter): boolean {
  if (region === "all") return true;
  if (region === "continent") return item.region === null;
  return item.region === region;
}

/** True when the item passes every filter; every search word must appear. */
export function matchesNews(
  item: PublicNews,
  filters: NewsFilters,
  words: readonly string[] = searchWords(filters.query),
): boolean {
  if (filters.source !== "all" && item.source !== filters.source) return false;
  if (!matchesRegion(item, filters.region)) return false;
  if (words.length === 0) return true;
  const text = searchableText(item);
  return words.every((word) => text.includes(word));
}

/** The feed as shown: latest first, filtered by paper, region and words. */
export function filterNews(news: readonly PublicNews[], filters: NewsFilters): PublicNews[] {
  const words = searchWords(filters.query);
  return latestFirst(news).filter((item) => matchesNews(item, filters, words));
}

export function isFiltered(filters: NewsFilters): boolean {
  return (
    filters.source !== "all" || filters.region !== "all" || searchWords(filters.query).length > 0
  );
}

/** "1 news", "3 nouvelles"… French puts zero and one in the singular. */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${formatNumber(count)} ${count > 1 ? pluralForm : singular}`;
}

/** "23 news", or "5 news sur 23" when filters hide some. */
export function resultsLabel(shown: number, total: number): string {
  const label = plural(shown, "news", "news");
  return shown === total ? label : `${label} sur ${formatNumber(total)}`;
}

/** Label of the button revealing older news. */
export function moreLabel(count: number): string {
  return `Afficher ${plural(count, "news plus ancienne", "news plus anciennes")}`;
}

/** Age in simulated days: "Aujourd'hui", "Hier", "Il y a 5 jours". */
export function ageLabel(day: number, today: number): string {
  const days = today - day;
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  return `Il y a ${formatNumber(days)} jours`;
}
