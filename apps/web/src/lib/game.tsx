import { newsSources } from "@etic/content";
import type { ActivityEntry, ClockView, PatchOp, PublicNews, TeamView } from "@etic/engine";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useSubscription } from "@trpc/tanstack-react-query";
import { createContext, type ReactNode, useContext } from "react";
import { toast } from "sonner";
import { applyStreamMessage, patchOps, teamViewKey, useLiveView } from "@/lib/live-view";
import { refreshCurrentGames } from "@/lib/session";
import { useTRPC } from "@/lib/trpc";

/** The game the signed-in player belongs to (from `game.current`). */
export interface CurrentGame {
  gameId: string;
  teamId: string;
  name: string;
  status: ClockView["status"];
  msPerDay: number;
}

export type ConnectionState = "connecting" | "live" | "error";

const GameContext = createContext<CurrentGame | null>(null);
const ConnectionContext = createContext<ConnectionState>("connecting");

/** Toasts for what players must not miss: new news and events hitting their company (F2, F12). */
function notify(ops: readonly PatchOp[]): void {
  for (const op of ops) {
    if (op.op !== "append") continue;
    const [root, child] = op.path;
    if (root === "news") {
      for (const news of op.values as PublicNews[]) {
        toast(news.title, { description: newsSources[news.source] });
      }
    }
    if (root === "team" && child === "log") {
      for (const entry of op.values as ActivityEntry[]) {
        if (entry.kind === "event") toast.warning(entry.message);
      }
    }
  }
}

/**
 * Keeps the team view live for the whole /play area (#26): one SSE subscription, the full
 * view then patches into the Query cache. If the stream ends (player moved or removed by
 * the organizer), the current game is read again and the route guards decide where to go.
 */
export function GameProvider({ game, children }: { game: CurrentGame; children: ReactNode }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const subscription = useSubscription(
    trpc.game.stream.subscriptionOptions(
      { gameId: game.gameId },
      {
        onData: (message) => {
          applyStreamMessage(queryClient, teamViewKey(game.gameId), message);
          notify(patchOps(message));
        },
        onComplete: async () => {
          // The server ends the stream once the player no longer belongs to the team (moved or
          // removed by the organizer): forget the old team's view, read the current game
          // fresh (ensureQueryData in the guard would return the stale list), then let the
          // guards pick the new team or send the player back to /join.
          await queryClient.resetQueries({ queryKey: teamViewKey(game.gameId) });
          await refreshCurrentGames({ queryClient, trpc });
          await router.invalidate();
        },
      },
    ),
  );
  const connection: ConnectionState =
    subscription.status === "pending"
      ? "live"
      : subscription.status === "error"
        ? "error"
        : "connecting";
  return (
    <GameContext.Provider value={game}>
      <ConnectionContext.Provider value={connection}>{children}</ConnectionContext.Provider>
    </GameContext.Provider>
  );
}

export function useGame(): CurrentGame {
  const game = useContext(GameContext);
  if (!game) throw new Error("useGame must be used inside GameProvider");
  return game;
}

export function useConnection(): ConnectionState {
  return useContext(ConnectionContext);
}

/** The live team view, or undefined before the first message. */
export function useTeamView(): TeamView | undefined {
  return useLiveView<TeamView>(teamViewKey(useGame().gameId));
}

/**
 * The live team view inside the /play area. Pages are only rendered once the first full
 * view has arrived (see PlayerArea), so this never returns undefined there.
 */
export function useView(): TeamView {
  const view = useTeamView();
  if (!view) throw new Error("useView used before the team view arrived");
  return view;
}

export function useClock(): ClockView {
  return useView().clock;
}

/** Decisions are only possible while the game runs (O1): disable buttons otherwise. */
export function useCanAct(): boolean {
  return useTeamView()?.clock.status === "running";
}
