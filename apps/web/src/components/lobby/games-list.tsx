import type { GameStatus } from "@etic/engine";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, DoorOpen, Flag, Gamepad2, Pause, Play } from "lucide-react";
import { EmptyState } from "@/components/game/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dayLabel } from "@/lib/format";
import { useTRPC } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { errorMessage, isRehearsal, STATUS_LABEL, sortGames, speedLabel } from "./lobby-helpers";

const STATUS_STYLE: Record<GameStatus, { icon: typeof Play; className: string }> = {
  lobby: { icon: DoorOpen, className: "bg-secondary text-secondary-foreground" },
  running: { icon: Play, className: "bg-success/15 text-success" },
  paused: { icon: Pause, className: "bg-warning/15 text-warning" },
  ended: { icon: Flag, className: "bg-muted text-muted-foreground" },
};

function StatusBadge({ status }: { status: GameStatus }) {
  const { icon: Icon, className } = STATUS_STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Every game on this server: the day's game and rehearsals (P8, P10). */
export function GamesList() {
  const trpc = useTRPC();
  // Read again each time the page opens, so statuses are current (no polling).
  const games = useQuery({ ...trpc.admin.games.queryOptions(), refetchOnMount: "always" });
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground">Parties sur ce serveur</CardTitle>
      </CardHeader>
      <CardContent>
        {games.isPending ? (
          <div className="space-y-2" role="status" aria-label="Chargement des parties">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : games.isError ? (
          <p role="alert" className="text-sm">
            {errorMessage(games.error)}
          </p>
        ) : games.data.length === 0 ? (
          <EmptyState icon={Gamepad2} title="Aucune partie pour l'instant">
            Créez la partie du jour, ou une répétition pour tester le jeu, avec le formulaire.
          </EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partie</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Avancement</TableHead>
                <TableHead>Vitesse</TableHead>
                <TableHead
                  className="text-right"
                  title="Flux temps réel ouverts : joueurs, écran de la salle et organisateur"
                >
                  Connexions
                </TableHead>
                <TableHead>
                  <span className="sr-only">Ouvrir</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortGames(games.data).map((game) => (
                <TableRow key={game.id}>
                  <TableCell className="max-w-64 font-medium">
                    <span className="block truncate" title={game.name}>
                      {game.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={game.status} />
                  </TableCell>
                  <TableCell className="tabular">
                    {game.status === "lobby"
                      ? "Pas commencée"
                      : `${dayLabel(game.time.day)}${game.endDay ? ` / ${game.endDay}` : ""}`}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      {isRehearsal(game.msPerDay) ? (
                        <Badge variant="outline">Répétition</Badge>
                      ) : null}
                      <span className="tabular">{speedLabel(game.msPerDay)}</span>
                    </span>
                  </TableCell>
                  <TableCell className="tabular text-right">{game.metrics.subscribers}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      asChild
                      size="sm"
                      variant={game.status === "ended" ? "outline" : "default"}
                    >
                      <Link to="/admin/games/$gameId" params={{ gameId: game.id }}>
                        Ouvrir
                        <span className="sr-only"> {game.name}</span>
                        <ArrowRight aria-hidden />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
