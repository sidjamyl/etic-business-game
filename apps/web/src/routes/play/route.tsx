import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ClockBar } from "@/components/game/clock-bar";
import { GameBanners } from "@/components/game/game-banners";
import { ViewLoading } from "@/components/game/view-loading";
import { PlayerLayout } from "@/components/layouts";
import { PlayerLobby } from "@/components/lobby/player-lobby";
import { GameProvider, useTeamView } from "@/lib/game";
import { pickGame, requireUser } from "@/lib/session";

/**
 * Player area (#26): signed-in users with a game only. One live stream for every page;
 * the lobby screen replaces the modules until the organizer starts the game.
 */
export const Route = createFileRoute("/play")({
  beforeLoad: async ({ context }) => {
    await requireUser(context);
    const games = await context.queryClient.ensureQueryData(
      context.trpc.game.current.queryOptions(),
    );
    const game = pickGame(games);
    if (!game) throw redirect({ to: "/join" });
    return { game };
  },
  component: PlayRoute,
});

function PlayRoute() {
  const { game } = Route.useRouteContext();
  // A new team (player moved by the organizer) means a new stream: remount the provider.
  return (
    <GameProvider key={`${game.gameId}:${game.teamId}`} game={game}>
      <PlayerLayout clock={<ClockBar />} banners={<GameBanners />}>
        <PlayerArea />
      </PlayerLayout>
    </GameProvider>
  );
}

function PlayerArea() {
  const view = useTeamView();
  if (!view) return <ViewLoading />;
  if (view.clock.status === "lobby") return <PlayerLobby />;
  return <Outlet />;
}
