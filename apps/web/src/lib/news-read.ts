import { useSyncExternalStore } from "react";
import { useGame, useTeamView } from "@/lib/game";

/** Last news id read per game, kept in this browser (F12: unread badge). */
const listeners = new Set<() => void>();
const storageKey = (gameId: string) => `etic:news-read:${gameId}`;

function readLastSeen(gameId: string): number {
  return Number(window.localStorage.getItem(storageKey(gameId)) ?? 0);
}

/** Marks every news item up to `newsId` as read. */
export function markNewsRead(gameId: string, newsId: number): void {
  if (newsId <= readLastSeen(gameId)) return;
  window.localStorage.setItem(storageKey(gameId), String(newsId));
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useLastSeenNews(): number {
  const { gameId } = useGame();
  return useSyncExternalStore(subscribe, () => readLastSeen(gameId));
}

export function useUnreadNewsCount(): number {
  const lastSeen = useLastSeenNews();
  const news = useTeamView()?.news ?? [];
  return news.filter((item) => item.id > lastSeen).length;
}
