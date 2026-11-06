import { createFileRoute, redirect } from "@tanstack/react-router";
import { JoinPage } from "@/components/lobby/join-page";
import { pickGame, requireUser } from "@/lib/session";

/** Code entry (P7) for signed-in players without an unfinished game; others go to their space. */
export const Route = createFileRoute("/join")({
  beforeLoad: async ({ context }) => {
    const user = await requireUser(context);
    if (user.role === "organizer") throw redirect({ to: "/admin" });
    const games = await context.queryClient.fetchQuery(context.trpc.game.current.queryOptions());
    // A finished game (rehearsal) does not prevent joining the next one.
    const game = pickGame(games);
    if (game && game.status !== "ended") throw redirect({ to: "/play" });
  },
  component: JoinPage,
});
