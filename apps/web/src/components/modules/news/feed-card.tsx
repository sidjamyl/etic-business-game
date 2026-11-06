import { ChevronDown, Newspaper, SearchX } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/game/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { useView } from "@/lib/game";
import { FeedToolbar } from "./feed-toolbar";
import {
  FEED_PAGE_SIZE,
  filterNews,
  moreLabel,
  type NewsFilters,
  noFilters,
  resultsLabel,
} from "./news-feed";
import { NewsItem } from "./news-item";

/**
 * The feed and its archive (stories 73–74): every news since the start, latest first, with
 * search and filters; older news come on demand. `seenBefore` is the last news already read
 * when the page opened: later ones are marked « Nouveau ».
 */
export function FeedCard({ seenBefore }: { seenBefore: number }) {
  const { news, team, clock } = useView();
  const [filters, setFilters] = useState<NewsFilters>(noFilters);
  const [limit, setLimit] = useState(FEED_PAGE_SIZE);
  const items = filterNews(news, filters);
  const shown = items.slice(0, limit);
  const remaining = items.length - shown.length;

  return (
    <Card>
      <CardHeader>
        <h2 className="eyebrow font-sans text-muted-foreground">Toutes les news</h2>
        <CardDescription>
          Des plus récentes aux plus anciennes. Cherchez un mot ou filtrez par source et par région
          pour relier les indices.
        </CardDescription>
        <CardAction>
          <p className="tabular text-sm text-muted-foreground" aria-live="polite">
            {resultsLabel(items.length, news.length)}
          </p>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {news.length === 0 ? (
          <EmptyState icon={Newspaper} title="Aucune news pour l'instant">
            Les premières paraîtront dans les jours qui viennent. Une notification vous préviendra à
            chaque parution.
          </EmptyState>
        ) : (
          <>
            <FeedToolbar filters={filters} onChange={setFilters} ownRegion={team.region} />
            {items.length === 0 ? (
              <EmptyState icon={SearchX} title="Aucune news ne correspond">
                <p>Essayez un autre mot, une autre région ou l'autre journal.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setFilters(noFilters)}
                >
                  Effacer les filtres
                </Button>
              </EmptyState>
            ) : (
              <ol
                className="divide-y border-t"
                aria-label="News, des plus récentes aux plus anciennes"
              >
                {shown.map((item) => (
                  <li key={item.id}>
                    <NewsItem
                      item={item}
                      isNew={item.id > seenBefore}
                      ownRegion={team.region}
                      today={clock.time.day}
                      stepsPerDay={clock.stepsPerDay}
                    />
                  </li>
                ))}
              </ol>
            )}
            {remaining > 0 ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setLimit((current) => current + FEED_PAGE_SIZE)}
              >
                <ChevronDown aria-hidden />
                {moreLabel(Math.min(remaining, FEED_PAGE_SIZE))}
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
