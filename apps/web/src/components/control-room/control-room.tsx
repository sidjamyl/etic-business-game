import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Radio, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/game/confirm-dialog";
import { PageHeader } from "@/components/game/page-header";
import { ViewLoading } from "@/components/game/view-loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type AdminStreamView, useAdminGameId, useAdminView } from "@/lib/admin";
import { useTRPC } from "@/lib/trpc";
import { AuctionsCard } from "./auctions-card";
import { CompaniesTable } from "./companies-table";
import { ControlBar } from "./control-bar";
import {
  formatClockTime,
  formatDurationMs,
  serverHealth,
  sortCompanies,
  speedLabel,
} from "./control-room-helpers";
import { EventsCard } from "./events-card";
import { runOrganizerAction } from "./organizer-action";
import { ProjectorLinks } from "./projector-links";
import { LiveRankingCard } from "./ranking-table";
import { RevealPanel } from "./reveal-panel";
import { TradesCard } from "./trades-card";

function Moderation({ news }: { news: AdminStreamView["cardNews"] }) {
  const gameId = useAdminGameId();
  const trpc = useTRPC();
  const remove = useMutation(trpc.admin.deleteNews.mutationOptions());
  return (
    <Card>
      <CardHeader>
        <CardTitle>Modération des fausses news</CardTitle>
      </CardHeader>
      <CardContent>
        {news.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune fausse news publiée.</p>
        ) : (
          <ul className="divide-y">
            {[...news].reverse().map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 py-4 first:pt-0">
                <div className="min-w-0">
                  <p className="eyebrow text-muted-foreground">Jour {item.day}</p>
                  <h3 className="mt-1 font-semibold">{item.title}</h3>
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                    {item.body}
                  </p>
                </div>
                <ConfirmDialog
                  title="Supprimer cette news ?"
                  description="Elle disparaîtra des écrans des équipes et du projecteur."
                  confirmLabel="Supprimer"
                  tone="danger"
                  trigger={
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label={`Supprimer ${item.title}`}
                      disabled={remove.isPending}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  }
                  onConfirm={async () => {
                    const ok = await runOrganizerAction(
                      () => remove.mutateAsync({ gameId, newsId: item.id }),
                      "News supprimée.",
                    );
                    return ok ? undefined : false;
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Organizer control room for a started game (live companies, controls, ranking…). */
export function ControlRoom() {
  const view = useAdminView();
  if (!view) return <ViewLoading label="Connexion à la salle de contrôle…" />;
  const { clock, game, metrics } = view;
  const health = serverHealth(metrics, game.msPerDay / clock.stepsPerDay);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Organisation · ${speedLabel(game.msPerDay)}`}
        title={game.name}
        description="Toutes les entreprises, une seule horloge. Les informations de cette salle vous sont réservées."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="ghost">
              <Link to="/admin">
                <ArrowLeft aria-hidden />
                Parties
              </Link>
            </Button>
            <ProjectorLinks gameId={game.id} />
          </div>
        }
      />
      <ControlBar clock={clock} msPerDay={game.msPerDay} endsAt={game.endsAt} />
      <section
        aria-label="État du serveur"
        className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border px-4 py-3 text-sm"
      >
        <span className="flex items-center gap-2">
          <Radio className="size-4" aria-hidden />
          {health === "good"
            ? "Serveur opérationnel"
            : health === "slow"
              ? "Serveur à surveiller"
              : "Serveur ralenti"}
        </span>
        <span className="tabular text-muted-foreground">
          {metrics.subscribers} connexions · calcul {formatDurationMs(metrics.lastStepDurationMs)}
        </span>
        <span className="text-muted-foreground">
          Sauvegarde : {formatClockTime(metrics.lastSavedAt) ?? "en attente"}
        </span>
        {game.endsAt ? <span>Fin à {formatClockTime(game.endsAt)}</span> : null}
      </section>
      {view.results ? (
        <RevealPanel results={view.results} />
      ) : (
        <LiveRankingCard ranking={view.ranking} />
      )}
      <Card>
        <CardHeader>
          <CardTitle>Entreprises · {Object.keys(view.companies).length}</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <CompaniesTable companies={sortCompanies(Object.values(view.companies))} />
        </CardContent>
      </Card>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <EventsCard events={view.events} clock={clock} msPerDay={game.msPerDay} />
        <AuctionsCard auctions={view.auctions} companies={view.companies} clock={clock} />
        <TradesCard trades={view.trades} companies={view.companies} />
        <Moderation news={view.cardNews} />
      </div>
    </div>
  );
}
