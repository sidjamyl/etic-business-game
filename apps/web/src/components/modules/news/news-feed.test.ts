import { describe, expect, test } from "bun:test";
import type { PublicNews } from "@etic/engine";
import {
  ageLabel,
  countBySource,
  countNew,
  filterNews,
  isFiltered,
  latestFirst,
  latestNewsId,
  matchesNews,
  moreLabel,
  type NewsFilters,
  noFilters,
  normalizeText,
  parseRegionFilter,
  parseSourceFilter,
  plural,
  regionLabel,
  regionOptions,
  resultsLabel,
  searchWords,
} from "./news-feed.ts";

function news(
  id: number,
  source: PublicNews["source"],
  region: PublicNews["region"],
  title: string,
  body = "",
): PublicNews {
  return { id, day: id, step: 0, source, region, title, body };
}

// Published in id order, deliberately stored out of order to check the sort.
const feed: PublicNews[] = [
  news(12, "serious", "nordhaven", "Nordhaven inaugure sa nouvelle gare", "Des trains réguliers."),
  news(3, "tabloid", "azura", "Azura : le marché de nuit fait son retour", "Les lampions."),
  news(40, "tabloid", "port-libre", "Un entrepôt fantôme sur les quais", "Une porte marquée."),
  news(27, "serious", null, "Le Conseil continental se réunit", "Le dialogue reprend."),
  news(33, "serious", "azura", "Récolte record", "Les greniers débordent, le cœur léger."),
];

const filters = (patch: Partial<NewsFilters>): NewsFilters => ({ ...noFilters, ...patch });
const ids = (items: readonly PublicNews[]) => items.map((item) => item.id);
const clean = (text: string) => text.replace(/\s/g, " ");

describe("order and read state", () => {
  test("latest first, without touching the original list", () => {
    expect(ids(latestFirst(feed))).toEqual([40, 33, 27, 12, 3]);
    expect(ids(feed)).toEqual([12, 3, 40, 27, 33]);
  });

  test("latest id, 0 before the first news", () => {
    expect(latestNewsId(feed)).toBe(40);
    expect(latestNewsId([])).toBe(0);
  });

  test("new news are those published after the last one read", () => {
    expect(countNew(feed, 0)).toBe(5);
    expect(countNew(feed, 27)).toBe(2);
    expect(countNew(feed, 40)).toBe(0);
  });

  test("count per paper", () => {
    expect(countBySource(feed)).toEqual({ serious: 3, tabloid: 2 });
    expect(countBySource([])).toEqual({ serious: 0, tabloid: 0 });
  });
});

describe("filters", () => {
  test("no filter keeps everything, latest first", () => {
    expect(ids(filterNews(feed, noFilters))).toEqual([40, 33, 27, 12, 3]);
    expect(isFiltered(noFilters)).toBe(false);
  });

  test("by paper", () => {
    expect(ids(filterNews(feed, filters({ source: "tabloid" })))).toEqual([40, 3]);
    expect(ids(filterNews(feed, filters({ source: "serious" })))).toEqual([33, 27, 12]);
  });

  test("by region: exact region, or news about the whole continent", () => {
    expect(ids(filterNews(feed, filters({ region: "azura" })))).toEqual([33, 3]);
    expect(ids(filterNews(feed, filters({ region: "continent" })))).toEqual([27]);
    expect(ids(filterNews(feed, filters({ region: "ferronia" })))).toEqual([]);
  });

  test("filters combine", () => {
    const azuraTabloid = filters({ source: "tabloid", region: "azura" });
    expect(ids(filterNews(feed, azuraTabloid))).toEqual([3]);
    expect(isFiltered(azuraTabloid)).toBe(true);
  });

  test("search ignores case, accents and ligatures; every word must appear", () => {
    expect(ids(filterNews(feed, filters({ query: "ENTREPOT" })))).toEqual([40]);
    expect(ids(filterNews(feed, filters({ query: "coeur" })))).toEqual([33]);
    expect(ids(filterNews(feed, filters({ query: "  gare   trains " })))).toEqual([12]);
    expect(ids(filterNews(feed, filters({ query: "gare quais" })))).toEqual([]);
  });

  test("search finds the region a news is about, not the papers' names", () => {
    expect(ids(filterNews(feed, filters({ query: "port-libre" })))).toEqual([40]);
    expect(ids(filterNews(feed, filters({ query: "choc" })))).toEqual([]);
  });

  test("a blank search is no filter", () => {
    expect(isFiltered(filters({ query: "   " }))).toBe(false);
    expect(isFiltered(filters({ query: "gare" }))).toBe(true);
    expect(searchWords("  ")).toEqual([]);
  });

  test("matchesNews checks a single item", () => {
    const [first] = feed;
    if (!first) throw new Error("empty feed");
    expect(matchesNews(first, filters({ region: "nordhaven", query: "gare" }))).toBe(true);
    expect(matchesNews(first, filters({ source: "tabloid" }))).toBe(false);
  });

  test("filter values coming from the controls are checked", () => {
    expect(parseSourceFilter("tabloid")).toBe("tabloid");
    expect(parseSourceFilter("all")).toBe("all");
    expect(parseSourceFilter("toString")).toBe("all");
    expect(parseRegionFilter("ferronia")).toBe("ferronia");
    expect(parseRegionFilter("continent")).toBe("continent");
    expect(parseRegionFilter("atlantis")).toBe("all");
  });
});

describe("labels", () => {
  test("normalized text", () => {
    expect(normalizeText("L’Écho Choc")).toBe("l'echo choc");
  });

  test("regions, with the team's own region pointed out", () => {
    expect(regionLabel(null)).toBe("Tout le continent");
    expect(regionLabel("port-libre")).toBe("Port-Libre");
    const options = regionOptions("ferronia");
    expect(options.map((option) => option.value)).toEqual([
      "all",
      "continent",
      "azura",
      "nordhaven",
      "ferronia",
      "port-libre",
    ]);
    expect(options.find((option) => option.value === "ferronia")?.label).toBe(
      "Ferronia (votre région)",
    );
    expect(regionOptions(null).some((option) => option.label.includes("votre région"))).toBe(false);
  });

  test("French plurals: zero and one are singular", () => {
    expect(plural(0, "nouvelle", "nouvelles")).toBe("0 nouvelle");
    expect(plural(1, "nouvelle", "nouvelles")).toBe("1 nouvelle");
    expect(plural(3, "nouvelle", "nouvelles")).toBe("3 nouvelles");
  });

  test("result count and more button", () => {
    expect(resultsLabel(23, 23)).toBe("23 news");
    expect(resultsLabel(5, 23)).toBe("5 news sur 23");
    expect(moreLabel(1)).toBe("Afficher 1 news plus ancienne");
    expect(moreLabel(20)).toBe("Afficher 20 news plus anciennes");
    expect(clean(resultsLabel(1200, 1200))).toBe("1 200 news");
  });

  test("age in simulated days", () => {
    expect(ageLabel(12, 12)).toBe("Aujourd'hui");
    expect(ageLabel(11, 12)).toBe("Hier");
    expect(ageLabel(4, 12)).toBe("Il y a 8 jours");
    expect(ageLabel(13, 12)).toBe("Aujourd'hui");
  });
});
