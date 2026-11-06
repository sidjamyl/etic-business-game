import type { ResultsState } from "@etic/engine";
import { useMutation } from "@tanstack/react-query";
import { CircleCheck, Eye, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAdminGameId } from "@/lib/admin";
import { useTRPC } from "@/lib/trpc";
import { SectionTitle } from "./bits";
import { placeLabel, revealProgress } from "./control-room-helpers";
import { runOrganizerAction } from "./organizer-action";
import { RankingTable } from "./ranking-table";

/**
 * Final reveal driven by the organizer (N21): one team at a time on the projector, from the
 * last place to the first, then the breakdown of the scores for everyone.
 */
export function RevealPanel({ results }: { results: ResultsState }) {
  const gameId = useAdminGameId();
  const trpc = useTRPC();
  const control = useMutation(trpc.admin.control.mutationOptions());
  const { total, revealed, next, allRevealed, breakdownShown } = revealProgress(results);

  const revealNext = () =>
    void runOrganizerAction(() => control.mutateAsync({ gameId, action: "revealNext" }));
  const showBreakdown = () =>
    void runOrganizerAction(
      () => control.mutateAsync({ gameId, action: "showBreakdown" }),
      "Détail des scores affiché sur l'écran de la salle et pour chaque équipe.",
    );

  return (
    // The binding moment of the day: the charter's dotted shadow (DESIGN.md §5).
    <div className="rounded-xl shadow-dotted">
      <Card className="gap-5 border-power-red py-5">
        <CardHeader className="px-5">
          <SectionTitle>Révélation du classement</SectionTitle>
          <CardDescription>
            Chaque clic dévoile une équipe sur l'écran de la salle, de la dernière à la première
            place. Affichez ensuite le détail des scores : les équipes le verront aussi sur leur
            tableau de bord.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="flex items-baseline gap-2">
                <span className="tabular font-display text-4xl font-bold">
                  {revealed}/{total}
                </span>
                <span className="text-sm text-muted-foreground">équipes révélées</span>
              </p>
              <Progress
                value={total > 0 ? (revealed / total) * 100 : 0}
                aria-label="Équipes révélées"
                className="mt-2 h-1.5 w-56"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {next ? (
                <Button size="lg" onClick={revealNext} disabled={control.isPending}>
                  <Eye aria-hidden />
                  {next.rank === 1 ? "Révéler le vainqueur" : `Révéler la ${placeLabel(next.rank)}`}
                </Button>
              ) : null}
              <Button
                size="lg"
                variant={allRevealed && !breakdownShown ? "default" : "outline"}
                onClick={showBreakdown}
                disabled={!allRevealed || breakdownShown || control.isPending}
              >
                <ListOrdered aria-hidden />
                Afficher le détail des scores
              </Button>
            </div>
          </div>
          <p aria-live="polite" className="text-sm">
            {next ? (
              <>
                Prochaine annonce : <span className="font-semibold">{placeLabel(next.rank)}</span> —{" "}
                {next.companyName}.{" "}
                <span className="text-muted-foreground">
                  Le détail des scores se débloque une fois tout le classement révélé.
                </span>
              </>
            ) : breakdownShown ? (
              <span className="inline-flex items-start gap-2 text-success">
                <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                Tout est révélé : le détail des scores est affiché sur l'écran de la salle et sur le
                tableau de bord de chaque équipe.
              </span>
            ) : (
              "Tout le classement est révélé : affichez le détail des scores quand la salle est prête."
            )}
          </p>
        </CardContent>
        <CardContent className="px-0">
          <RankingTable
            ranking={results.ranking}
            caption="Classement final et avancement de la révélation"
            reveal={{ total, revealedCount: revealed }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
