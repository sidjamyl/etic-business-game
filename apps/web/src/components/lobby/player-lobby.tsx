import { Circle, CircleCheck, Lock } from "lucide-react";
import { PageHeader } from "@/components/game/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useGame, useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import { CompanyNameForm } from "./company-name-form";
import { RegionPicker } from "./region-picker";
import { CompetitorsCard, LaunchStatusCard, TeamMembersCard } from "./team-panels";

/**
 * Player screen while the game is in the lobby (R21): company name, home region, readiness,
 * then the wait for the organizer. Shown on every /play page until the start.
 */
export function PlayerLobby() {
  const view = useView();
  const game = useGame();
  const { team } = view;
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Lobby · ${game.name}`}
        title={team.companyName ?? team.name}
        description="La partie n'a pas encore commencé. Nommez votre entreprise et choisissez sa région : vos choix restent modifiables jusqu'au lancement."
      />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="lobby-step-name" className="space-y-4">
            <StepHeading
              id="lobby-step-name"
              number="01"
              title="Nom de l'entreprise"
              done={team.companyName !== null}
            />
            <CompanyNameForm />
          </section>
          <section aria-labelledby="lobby-step-region" className="space-y-4">
            <StepHeading
              id="lobby-step-region"
              number="02"
              title="Région d'implantation"
              done={team.region !== null}
            />
            <Alert>
              <Lock aria-hidden />
              <AlertTitle>Définitive dès le lancement</AlertTitle>
              <AlertDescription>
                Vous pouvez changer de région jusqu'au lancement ; ensuite, votre entreprise y reste
                pour toute la partie. Chaque équipe voit les choix des autres.
              </AlertDescription>
            </Alert>
            <RegionPicker />
          </section>
        </div>
        <aside aria-label="Préparation de l'équipe" className="space-y-6">
          <LaunchStatusCard />
          <TeamMembersCard />
          <CompetitorsCard />
        </aside>
      </div>
    </div>
  );
}

/** Numbered section title, as in the charter ("01", "02" in Power red). */
function StepHeading({
  id,
  number,
  title,
  done,
}: {
  id: string;
  number: string;
  title: string;
  done: boolean;
}) {
  const Icon = done ? CircleCheck : Circle;
  return (
    <div className="flex items-center gap-3 border-b pb-2">
      <span aria-hidden className="tabular font-display text-2xl font-bold text-power-red">
        {number}
      </span>
      <h2 id={id} className="text-xl font-bold uppercase">
        {title}
      </h2>
      <span
        className={cn(
          "ml-auto inline-flex items-center gap-1 text-xs font-medium",
          done ? "text-success" : "text-muted-foreground",
        )}
      >
        <Icon className="size-4" aria-hidden />
        {done ? "Fait" : "À faire"}
      </span>
    </div>
  );
}
