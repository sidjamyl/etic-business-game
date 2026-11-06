import type { AdminStreamView } from "@etic/server/router";
import { useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";
import { createContext, type ReactNode, useContext } from "react";
import { adminViewKey, applyStreamMessage, useLiveView } from "@/lib/live-view";
import { useTRPC } from "@/lib/trpc";

export type { AdminStreamView };

const AdminGameContext = createContext<string | null>(null);

/** Keeps the organizer's control-room view live (admin.stream, N22). */
export function AdminGameProvider({ gameId, children }: { gameId: string; children: ReactNode }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const subscription = useSubscription(
    trpc.admin.stream.subscriptionOptions(
      { gameId },
      { onData: (message) => applyStreamMessage(queryClient, adminViewKey(gameId), message) },
    ),
  );
  if (subscription.status === "error") {
    return (
      <p className="p-6 text-destructive">
        {subscription.error?.message ?? "Partie introuvable ou accès refusé."}
      </p>
    );
  }
  return <AdminGameContext.Provider value={gameId}>{children}</AdminGameContext.Provider>;
}

export function useAdminGameId(): string {
  const gameId = useContext(AdminGameContext);
  if (!gameId) throw new Error("useAdminGameId must be used inside AdminGameProvider");
  return gameId;
}

/** The live organizer view, or undefined before the first message. */
export function useAdminView(): AdminStreamView | undefined {
  return useLiveView<AdminStreamView>(adminViewKey(useAdminGameId()));
}
