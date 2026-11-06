import { scoreRules } from "@etic/content";
import type { RankingEntry } from "@etic/engine";
import { Eye, EyeOff, Trophy } from "lucide-react";
import { InfoTip } from "@/components/game/info-tip";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { credits, percent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Pill, SectionTitle } from "./bits";
import { formatIndicator, formatScore, isRevealed } from "./control-room-helpers";

/** Final score with a bar out of 100 (the number carries the information). */
function ScoreBar({ value }: { value: number }) {
  return (
    <div className="flex items-center justify-end gap-3">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-foreground/10" aria-hidden>
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="tabular w-12 text-right font-semibold">{formatScore(value)}</span>
    </div>
  );
}

/**
 * Ranking (R18): net cash, economic score, impact and final score. During the reveal, the
 * last column tells what the room has already seen (N21).
 */
export function RankingTable({
  ranking,
  caption,
  reveal,
}: {
  ranking: readonly RankingEntry[];
  caption: string;
  reveal?: { total: number; revealedCount: number };
}) {
  return (
    <Table>
      <caption className="sr-only">{caption}</caption>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-16 pl-5 text-muted-foreground">Rang</TableHead>
          <TableHead className="text-muted-foreground">Entreprise</TableHead>
          <TableHead className="text-right text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              Trésorerie nette <InfoTip term="netCash" />
            </span>
          </TableHead>
          <TableHead className="text-right text-muted-foreground">Économie</TableHead>
          <TableHead className="text-right text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              Impact <InfoTip term="impact" />
            </span>
          </TableHead>
          <TableHead className={cn("text-right text-muted-foreground", !reveal && "pr-5")}>
            Score final
          </TableHead>
          {reveal ? (
            <TableHead className="pr-5 text-muted-foreground">Écran de la salle</TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {ranking.map((entry) => {
          const leader = entry.rank === 1;
          return (
            <TableRow key={entry.teamId} className={cn(leader && "bg-foreground/5")}>
              <TableCell className="pl-5">
                <span className="inline-flex items-center gap-1.5">
                  <span className="tabular font-display text-lg font-bold">{entry.rank}</span>
                  {leader ? (
                    <>
                      <Trophy className="size-4 text-warning" aria-hidden />
                      <span className="sr-only">en tête</span>
                    </>
                  ) : null}
                </span>
              </TableCell>
              <TableCell className="font-medium">{entry.companyName}</TableCell>
              <TableCell
                className={cn("tabular text-right", entry.netCash < 0 && "text-destructive")}
              >
                {credits(entry.netCash)}
              </TableCell>
              <TableCell className="tabular text-right">{formatScore(entry.economic)}</TableCell>
              <TableCell className="text-right">
                <div className="tabular">{formatScore(entry.impact)}</div>
                <div className="tabular text-xs text-muted-foreground">
                  env. {formatIndicator(entry.environmental)} · social{" "}
                  {formatIndicator(entry.social)}
                </div>
              </TableCell>
              <TableCell className={cn(!reveal && "pr-5")}>
                <ScoreBar value={entry.final} />
              </TableCell>
              {reveal ? (
                <TableCell className="pr-5">
                  {isRevealed(entry.rank, reveal.total, reveal.revealedCount) ? (
                    <Pill tone="success" icon={Eye}>
                      Révélée
                    </Pill>
                  ) : (
                    <Pill tone="neutral" icon={EyeOff}>
                      Pas encore
                    </Pill>
                  )}
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** Live ranking, for the organizer only (P9): the teams never see it during the game. */
export function LiveRankingCard({ ranking }: { ranking: readonly RankingEntry[] }) {
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <SectionTitle>Classement en direct</SectionTitle>
        <CardDescription className="flex items-start gap-2">
          <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Visible par vous seul : les équipes le découvriront à la révélation finale. Score final
            = {percent(scoreRules.economicWeight)} économie (trésorerie nette rapportée à la
            meilleure) + {percent(scoreRules.impactWeight)} impact.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <RankingTable ranking={ranking} caption="Classement en direct des entreprises" />
      </CardContent>
    </Card>
  );
}
