import type { RankingEntry } from "@etic/engine";
import { Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { InfoTip } from "@/components/game/info-tip";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { credits } from "@/lib/format";
import { cn } from "@/lib/utils";
import { placeLabel, scoreValue, scoreWeights } from "./end-math";

function NumberHead({ children }: { children: ReactNode }) {
  return (
    <TableHead className="text-right">
      <span className="inline-flex items-center gap-1">{children}</span>
    </TableHead>
  );
}

/** Final ranking with every company's breakdown (R18, N21); the team's own row stands out. */
export function RankingTable({ ranking, teamId }: { ranking: RankingEntry[]; teamId: string }) {
  return (
    <Table>
      <TableCaption className="text-pretty">
        {`Notes sur 100. Score final = ${scoreWeights.economic} économie + ${scoreWeights.impact} impact. `}
        À égalité, la meilleure trésorerie nette l'emporte, puis le meilleur impact.
      </TableCaption>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Rang</TableHead>
          <TableHead>Entreprise</TableHead>
          <NumberHead>
            Trésorerie nette <InfoTip term="netCash" />
          </NumberHead>
          <NumberHead>Économie</NumberHead>
          <NumberHead>Environnement</NumberHead>
          <NumberHead>Social</NumberHead>
          <NumberHead>
            Impact <InfoTip term="impact" />
          </NumberHead>
          <NumberHead>Score final</NumberHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ranking.map((entry) => {
          const mine = entry.teamId === teamId;
          return (
            <TableRow
              key={entry.teamId}
              className={cn(mine && "bg-power-red/5 hover:bg-power-red/10")}
            >
              <TableCell className="tabular font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  {entry.rank === 1 ? (
                    <Trophy className="size-4 text-power-red" aria-hidden />
                  ) : null}
                  {placeLabel(entry.rank)}
                </span>
              </TableCell>
              <TableCell className="font-medium">
                {entry.companyName}
                {mine ? <Badge className="ml-2">Vous</Badge> : null}
              </TableCell>
              <TableCell
                className={cn("tabular text-right", entry.netCash < 0 && "text-destructive")}
              >
                {credits(entry.netCash)}
              </TableCell>
              <TableCell className="tabular text-right">{scoreValue(entry.economic)}</TableCell>
              <TableCell className="tabular text-right">
                {scoreValue(entry.environmental)}
              </TableCell>
              <TableCell className="tabular text-right">{scoreValue(entry.social)}</TableCell>
              <TableCell className="tabular text-right">{scoreValue(entry.impact)}</TableCell>
              <TableCell className="tabular text-right text-base font-semibold">
                {scoreValue(entry.final)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
