import { startRules } from "@etic/content";
import { useMutation } from "@tanstack/react-query";
import { CircleCheck, Clock, Play } from "lucide-react";
import { ConfirmDialog } from "@/components/game/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAdminGameId } from "@/lib/admin";
import { credits } from "@/lib/format";
import { useTRPC } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { AdminTeam } from "./admin-team-card";
import { isRehearsal, missingLabel, speedLabel } from "./lobby-helpers";
import { runOrganizerAction } from "./organizer-action";

/** Readiness of every team and the start of the game (R21, stories 18–19). */
export function LaunchCard({ teams, msPerDay }: { teams: AdminTeam[]; msPerDay: number }) {
  const gameId = useAdminGameId();
  const trpc = useTRPC();
  const control = useMutation(trpc.admin.control.mutationOptions());
  const waiting = teams.filter((team) => !team.ready);
  const readyCount = teams.length - waiting.length;
  const allReady = waiting.length === 0;

  const start = async () => {
    const ok = await runOrganizerAction(
      () => control.mutateAsync({ gameId, action: "start" }),
      "La partie est lancée !",
    );
    // Refused (a team is no longer ready): keep the dialog open next to the message.
    return ok ? undefined : false;
  };

  const card = (
    <Card className={cn("gap-4 py-5", allReady && "border-power-red")}>
      <CardHeader className="px-5">
        <CardTitle className="eyebrow text-muted-foreground">Lancement</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        <div>
          <p className="flex items-baseline gap-2">
            <span className="tabular font-display text-4xl font-bold">
              {readyCount}/{teams.length}
            </span>
            <span className="text-sm text-muted-foreground">équipes prêtes</span>
          </p>
          <Progress
            value={teams.length > 0 ? (readyCount / teams.length) * 100 : 0}
            aria-label="Équipes prêtes"
            className="mt-2 h-1.5"
          />
        </div>
        {allReady ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <CircleCheck className="size-4 shrink-0" aria-hidden />
            Toutes les équipes sont prêtes.
          </p>
        ) : (
          <div className="space-y-1.5 text-sm">
            <p className="text-muted-foreground">En attente :</p>
            <ul className="space-y-1">
              {waiting.map((team) => (
                <li key={team.id} className="flex items-start gap-2">
                  <Clock className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                  <span>
                    <span className="font-medium">{team.name}</span> — il manque{" "}
                    {missingLabel({
                      memberCount: team.members.length,
                      companyName: team.companyName,
                      region: team.region,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <ConfirmDialog
          trigger={
            <Button size="lg" className="w-full" disabled={!allReady || control.isPending}>
              <Play aria-hidden />
              Lancer la partie
            </Button>
          }
          title="Lancer la partie ?"
          description="L'horloge commune démarre pour toutes les équipes."
          consequences={[
            `Chaque équipe reçoit ${credits(startRules.startingCash)} et sa carte secrète, tirée au hasard.`,
            "Les noms d'entreprise et les régions sont figés : la région devient définitive.",
            isRehearsal(msPerDay)
              ? `Partie de répétition : ${speedLabel(msPerDay)}.`
              : "Un jour simulé passe à chaque minute réelle.",
          ]}
          confirmLabel="Lancer la partie"
          onConfirm={start}
        />
        {allReady ? null : (
          <p className="text-xs text-muted-foreground">
            Le bouton s'active quand chaque équipe a au moins un membre, un nom d'entreprise et une
            région.
          </p>
        )}
      </CardContent>
    </Card>
  );
  // The charter's dotted shadow marks the binding action once it is available (DESIGN.md §5).
  // The wrapper always exists, so the confirmation stays open if readiness changes meanwhile.
  return <div className={cn("rounded-xl", allReady && "shadow-dotted")}>{card}</div>;
}
