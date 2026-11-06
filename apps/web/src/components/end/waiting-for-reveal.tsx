import { Flag, MonitorPlay } from "lucide-react";
import { useId } from "react";
import { StatCard } from "@/components/game/stat-card";
import { credits } from "@/lib/format";
import { useView } from "@/lib/game";
import { impactScore, netCashOf } from "./end-math";
import { EndSection, ScoreOutOf100, Spotlight } from "./end-section";
import { ReadOnlyNote } from "./read-only-note";
import { ScoreFormula } from "./score-formula";
import { SettlementRulesDialog } from "./settlement-rules";

/**
 * The game is over and the organizer has not shown the results yet (N21): all eyes on the
 * room's screen. Only the team's own figures, never the others' (story 115).
 */
export function WaitingForReveal() {
  const { team, impact } = useView();
  const titleId = useId();
  const net = netCashOf(team);
  return (
    <div className="space-y-10">
      <Spotlight reveal aria-labelledby={titleId}>
        <Flag
          className="pointer-events-none absolute top-1/2 right-12 size-40 -translate-y-1/2 text-milk/10"
          aria-hidden
        />
        <p className="eyebrow">Fin de partie · {team.companyName ?? team.name}</p>
        <h1 id={titleId} className="mt-3 text-6xl leading-none font-bold uppercase">
          Partie terminée
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-pretty">
          Tout est figé, plus aucune décision n'est possible. Les résultats seront révélés sur
          l'écran de la salle : le classement, de la dernière à la première place, puis le détail
          des scores. Ils s'afficheront ensuite ici.
        </p>
        <p className="mt-8 inline-flex items-center gap-2.5 rounded-full bg-milk/10 px-4 py-2 text-sm font-medium">
          <MonitorPlay className="size-4" aria-hidden />
          Les yeux sur l'écran de la salle
          <span className="size-2 rounded-full bg-milk motion-safe:animate-pulse" aria-hidden />
        </p>
      </Spotlight>

      <EndSection number={1} title="Vos chiffres de fin de partie">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Trésorerie nette"
            value={credits(net)}
            info="netCash"
            tone={net < 0 ? "danger" : "default"}
            hint={`Trésorerie ${credits(team.cash)} − dette ${credits(team.finance.debt)}`}
          />
          <StatCard
            label="Environnement"
            value={<ScoreOutOf100 value={impact.environmental} />}
            info="environmental"
          />
          <StatCard label="Social" value={<ScoreOutOf100 value={impact.social} />} info="social" />
          <StatCard
            label="Score d'impact"
            value={<ScoreOutOf100 value={impactScore(impact.environmental, impact.social)} />}
            info="impact"
            hint="Moyenne des deux indicateurs"
          />
        </div>
        <p className="text-sm text-pretty text-muted-foreground">
          Votre score économique dépend de la meilleure trésorerie nette de la partie : réponse à la
          révélation.
        </p>
      </EndSection>

      <EndSection number={2} title="Le calcul du score">
        <ScoreFormula />
        <SettlementRulesDialog label="Revoir les règles de clôture" variant="outline" />
      </EndSection>

      <ReadOnlyNote />
    </div>
  );
}
