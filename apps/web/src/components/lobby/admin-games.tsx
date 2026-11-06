import { PageHeader } from "@/components/game/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateGameForm } from "./create-game-form";
import { GamesList } from "./games-list";

/** Organizer home (P8): games on this server and the creation form. */
export function AdminGamesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organisateur"
        title="Parties"
        description="Créez la partie du jour ou une répétition, puis ouvrez-la pour distribuer les codes d'équipe et lancer le jeu."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <GamesList />
        <Card className="gap-5">
          <CardHeader>
            <CardTitle className="font-display text-xl font-bold uppercase">
              Nouvelle partie
            </CardTitle>
            <CardDescription>
              Un code est généré pour chaque équipe ; vous les retrouverez dans le lobby.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateGameForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
