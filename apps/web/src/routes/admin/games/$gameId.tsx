import { createFileRoute } from "@tanstack/react-router";
import { ControlRoom } from "@/components/control-room/control-room";
import { ViewLoading } from "@/components/game/view-loading";
import { AdminLobby } from "@/components/lobby/admin-lobby";
import { AdminGameProvider, useAdminView } from "@/lib/admin";

/** One game for the organizer: the lobby before the start, then the control room (N22). */
export const Route = createFileRoute("/admin/games/$gameId")({
  component: AdminGame,
});

function AdminGame() {
  const { gameId } = Route.useParams();
  return (
    <AdminGameProvider gameId={gameId}>
      <AdminGameArea />
    </AdminGameProvider>
  );
}

function AdminGameArea() {
  const view = useAdminView();
  if (!view) return <ViewLoading label="Connexion à la salle de contrôle…" />;
  return view.clock.status === "lobby" ? <AdminLobby /> : <ControlRoom />;
}
