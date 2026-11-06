import type { PublicView } from "@etic/engine";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";
import { createContext, type ReactNode, useContext } from "react";
import { applyStreamMessage, publicViewKey, useLiveView } from "@/lib/live-view";
import { useTRPC } from "@/lib/trpc";

const ScreenContext = createContext<string | null>(null);

/** Keeps the projector's public view live (screen.stream, P10). No sign-in needed. */
export function ScreenProvider({ gameId, children }: { gameId: string; children: ReactNode }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const subscription = useSubscription(
    trpc.screen.stream.subscriptionOptions(
      { gameId },
      { onData: (message) => applyStreamMessage(queryClient, publicViewKey(gameId), message) },
    ),
  );
  if (subscription.status === "error") {
    return (
      <div className="grid min-h-dvh place-items-center bg-power-red font-display text-4xl text-milk">
        Partie introuvable.
      </div>
    );
  }
  return <ScreenContext.Provider value={gameId}>{children}</ScreenContext.Provider>;
}

export function useScreenGameId(): string {
  const gameId = useContext(ScreenContext);
  if (!gameId) throw new Error("useScreenGameId must be used inside ScreenProvider");
  return gameId;
}

/** The live public view (clock, companies, news, announcements, results). */
export function usePublicView(): PublicView | undefined {
  return useLiveView<PublicView>(publicViewKey(useScreenGameId()));
}

/** Game name and clock speed (for the real time left). */
export function useScreenInfo() {
  const trpc = useTRPC();
  return useQuery(trpc.screen.info.queryOptions({ gameId: useScreenGameId() })).data;
}
