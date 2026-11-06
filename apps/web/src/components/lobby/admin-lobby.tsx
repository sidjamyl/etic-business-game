import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/game/page-header";
import { ViewLoading } from "@/components/game/view-loading";
import { Button } from "@/components/ui/button";
import { useAdminView } from "@/lib/admin";
import { AdminTeamCard } from "./admin-team-card";
import { CodesPresentation } from "./codes-presentation";
import { CopyButton } from "./copy-button";
import { LaunchCard } from "./launch-card";
import { isRehearsal, joinCodesText, sortTeams, speedLabel } from "./lobby-helpers";
import { EndTimeCard, MemberCapCard, ProjectorCard } from "./lobby-settings";

/** Organizer view of a game still in the lobby (P7, P8, R21): codes, members, readiness, start. */
export function AdminLobby() {
  const view = useAdminView();
  if (!view) return <ViewLoading label="Connexion au lobby…" />;
  const teams = sortTeams(Object.values(view.companies));
  const rehearsal = isRehearsal(view.game.msPerDay);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          rehearsal
            ? `Lobby · Répétition, ${speedLabel(view.game.msPerDay)}`
            : "Lobby · la partie n'a pas commencé"
        }
        title={view.game.name}
        description="Distribuez les codes, vérifiez la composition des équipes, puis lancez la partie dès que toutes sont prêtes."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin">
              <ArrowLeft aria-hidden />
              Toutes les parties
            </Link>
          </Button>
        }
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="lobby-teams-title" className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="lobby-teams-title" className="text-xl font-bold uppercase">
              Équipes et codes
            </h2>
            <div className="flex items-center gap-2">
              <CodesPresentation gameName={view.game.name} teams={teams} />
              <CopyButton
                text={joinCodesText(teams)}
                label="Copier tous les codes"
                copiedMessage="Codes de toutes les équipes copiés."
                size="sm"
              >
                Copier tous les codes
              </CopyButton>
            </div>
          </div>
          <ul className="grid gap-4 lg:grid-cols-2">
            {teams.map((team) => (
              <li key={team.id}>
                <AdminTeamCard team={team} teams={teams} memberCap={view.memberCap} />
              </li>
            ))}
          </ul>
        </section>
        <aside aria-label="Lancement et réglages" className="space-y-4">
          <LaunchCard teams={teams} msPerDay={view.game.msPerDay} />
          <MemberCapCard memberCap={view.memberCap} teams={teams} />
          <EndTimeCard
            key={view.game.endsAt}
            clock={view.clock}
            msPerDay={view.game.msPerDay}
            endsAt={view.game.endsAt}
          />
          <ProjectorCard gameId={view.game.id} />
        </aside>
      </div>
    </div>
  );
}
