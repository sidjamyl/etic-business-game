import { markNewsRead } from "@/lib/news-read";
import { useMountEffect } from "@/lib/use-mount-effect";

/**
 * Opening the News page counts as reading the feed (#36): once, when the page mounts, every
 * news published so far is marked as read in this browser, which clears the unread badge of
 * the navigation. This syncs an external store (localStorage) on mount, hence the mount-only
 * effect; it never holds data or derived state. News arriving while the page stays open
 * remain unread until « Tout marquer comme lu » or the next visit.
 */
export function useMarkNewsReadOnOpen(gameId: string, latestId: number): void {
  useMountEffect(() => {
    markNewsRead(gameId, latestId);
  });
}
