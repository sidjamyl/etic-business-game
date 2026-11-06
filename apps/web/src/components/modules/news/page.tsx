import { CheckCheck } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/game/page-header";
import { Button } from "@/components/ui/button";
import { useGame, useView } from "@/lib/game";
import { markNewsRead, useLastSeenNews } from "@/lib/news-read";
import { AnnouncementsCard } from "./announcements-card";
import { FeedCard } from "./feed-card";
import { countNew, latestNewsId, plural } from "./news-feed";
import { useMarkNewsReadOnOpen } from "./read-on-open";
import { SourcesCard } from "./sources-card";

/**
 * News (#36, R11, stories 73–74): the feed of both papers with source and region, the whole
 * archive with search and filters, and the public announcements alongside. Each new news also
 * pops up as a notification and counts in the navigation badge (foundation, #26).
 *
 * Read state: opening the page marks every news as read, which clears the badge; the ones
 * that were unread keep their « Nouveau » mark during the visit, until « Tout marquer comme
 * lu ». Reading is not a game decision: nothing here depends on the pause.
 */
export function NewsPage() {
  const { news } = useView();
  const { gameId } = useGame();
  const latestId = latestNewsId(news);
  // Snapshot of the last news read when the page opened: the store moves on right after.
  const lastSeen = useLastSeenNews();
  const [seenBefore, setSeenBefore] = useState(lastSeen);
  useMarkNewsReadOnOpen(gameId, latestId);
  const newCount = countNew(news, seenBefore);

  function markAllRead() {
    markNewsRead(gameId, latestId);
    setSeenBefore((previous) => Math.max(previous, latestId));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="News"
        title="Fil d'actualité"
        description="Deux journaux couvrent le continent. Leurs news n'annoncent jamais clairement l'avenir : à vous de relier les indices."
        actions={
          <>
            {newCount > 0 ? (
              <p className="tabular text-sm text-muted-foreground">
                {plural(newCount, "news parue", "news parues")} depuis votre dernière visite
              </p>
            ) : null}
            <Button variant="outline" disabled={newCount === 0} onClick={markAllRead}>
              <CheckCheck aria-hidden />
              Tout marquer comme lu
            </Button>
          </>
        }
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <FeedCard seenBefore={seenBefore} />
        <div className="space-y-6">
          <AnnouncementsCard />
          <SourcesCard />
        </div>
      </div>
    </div>
  );
}
