import type { RankingEntry } from "@etic/engine";
import { Trophy } from "lucide-react";
import { useId } from "react";
import { placeSuffix, resultTagline, scoreValue } from "./end-math";
import { Spotlight } from "./end-section";

/** The team's own result once the organizer has shown the breakdown (story 118). */
export function ResultHero({ entry, total }: { entry: RankingEntry; total: number }) {
  const titleId = useId();
  const winner = entry.rank === 1;
  return (
    <Spotlight tone={winner ? "red" : "cacao"} reveal aria-labelledby={titleId}>
      <div className="flex flex-wrap items-end justify-between gap-10">
        <div className="min-w-0">
          <p className="eyebrow">Résultats finaux · {entry.companyName}</p>
          <h1 id={titleId} className="mt-4 flex items-end gap-4 leading-none font-bold uppercase">
            {winner ? <Trophy className="size-16 shrink-0" aria-hidden /> : null}
            <span className="tabular text-8xl">
              {entry.rank}
              <sup className="text-4xl normal-case">{placeSuffix(entry.rank)}</sup>
            </span>
            <span className="pb-2 text-3xl">place sur {total}</span>
          </h1>
          <p className="mt-6 text-xl text-pretty">{resultTagline(entry.rank, total)}</p>
        </div>
        <div className="text-right">
          <p className="eyebrow">Score final</p>
          <p className="tabular mt-2 font-display text-6xl leading-none font-bold">
            {scoreValue(entry.final)}
            <span className="text-2xl opacity-80"> / 100</span>
          </p>
        </div>
      </div>
    </Spotlight>
  );
}
