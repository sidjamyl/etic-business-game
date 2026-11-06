import { createFileRoute } from "@tanstack/react-router";
import { ProjectorLayout } from "@/components/layouts";
import { ProjectorScreen } from "@/components/projector/projector-screen";
import { ScreenProvider } from "@/lib/screen";

/** Projector screen: public, no sign-in (P10, story 126). */
export const Route = createFileRoute("/screen/$gameId")({
  component: Screen,
});

function Screen() {
  const { gameId } = Route.useParams();
  return (
    <ScreenProvider gameId={gameId}>
      <ProjectorLayout>
        <ProjectorScreen />
      </ProjectorLayout>
    </ScreenProvider>
  );
}
