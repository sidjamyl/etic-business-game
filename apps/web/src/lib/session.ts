import type { AppRouter } from "@etic/server/router";
import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";

export interface RouterContext {
  queryClient: QueryClient;
  trpc: TRPCOptionsProxy<AppRouter>;
}

/** The signed-in user (or null), cached until sign-in or sign-out. */
export function loadSession({ queryClient, trpc }: RouterContext) {
  return queryClient.ensureQueryData(trpc.session.queryOptions());
}

export function homeFor(role: "organizer" | "participant") {
  return role === "organizer" ? "/admin" : "/play";
}

/** Route guard: signed-in users only, optionally organizers only. */
export async function requireUser(context: RouterContext, role?: "organizer") {
  const user = await loadSession(context);
  if (!user) throw redirect({ to: "/" });
  if (role && user.role !== role) throw redirect({ to: homeFor(user.role) });
  return user;
}

/** After sign-in or sign-out, the session must be read again. */
export async function refreshSession({ queryClient, trpc }: RouterContext) {
  queryClient.removeQueries();
  return queryClient.fetchQuery(trpc.session.queryOptions());
}

/** A game the signed-in user belongs to (`game.current`). */
export interface MemberGame {
  gameId: string;
  name: string;
  teamId: string;
  status: "lobby" | "running" | "paused" | "ended";
  msPerDay: number;
}

const STATUS_PRIORITY: Record<MemberGame["status"], number> = {
  running: 0,
  paused: 0,
  lobby: 1,
  ended: 2,
};

/** The game to show: one in progress first, then one in the lobby, then a finished one. */
export function pickGame(games: readonly MemberGame[]): MemberGame | undefined {
  return [...games].sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status])[0];
}

/** After joining a team: read the current game again before entering /play. */
export async function refreshCurrentGames({ queryClient, trpc }: RouterContext) {
  await queryClient.invalidateQueries(trpc.game.current.queryFilter());
  return queryClient.fetchQuery(trpc.game.current.queryOptions());
}
