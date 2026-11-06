import type { RankingEntry } from "@etic/engine";
import { PageHeader } from "@/components/game/page-header";
import { useGame, useView } from "@/lib/game";
import { bestNetCash, finalRanking } from "./end-math";
import { EndSection } from "./end-section";
import { RankingTable } from "./ranking-table";
import { ReadOnlyNote } from "./read-only-note";
import { ResultHero } from "./result-hero";
import { ScoreBreakdown } from "./score-breakdown";
import { WaitingForReveal } from "./waiting-for-reveal";

function FinalResults({ ranking, teamId }: { ranking: RankingEntry[]; teamId: string }) {
  const mine = ranking.find((entry) => entry.teamId === teamId);
  return (
    <div className="space-y-10">
      {mine ? (
        <>
          <ResultHero entry={mine} total={ranking.length} />
          <EndSection number={1} title="Détail de votre score">
            <ScoreBreakdown entry={mine} best={bestNetCash(ranking)} />
          </EndSection>
        </>
      ) : (
        <PageHeader eyebrow="Fin de partie" title="Résultats finaux" />
      )}
      <EndSection number={mine ? 2 : 1} title="Classement final">
        <RankingTable ranking={ranking} teamId={teamId} />
      </EndSection>
      <ReadOnlyNote />
    </div>
  );
}

/**
 * The dashboard once the game has ended (#42, R19, N21): a waiting screen until the organizer
 * shows the breakdown on the room's screen, then the team's result and the final ranking.
 * The view brings the results live: no polling.
 */
export function EndScreen() {
  const view = useView();
  const { teamId } = useGame();
  const ranking = finalRanking(view.results);
  if (ranking.length === 0) return <WaitingForReveal />;
  return <FinalResults ranking={ranking} teamId={teamId} />;
}
