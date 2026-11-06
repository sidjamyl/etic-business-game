import { scoreWeights } from "./end-math";

const definitions = [
  {
    term: "Trésorerie nette",
    detail: "Votre trésorerie moins la dette restante. Stock et machines ne comptent pas.",
  },
  {
    term: "Score économique",
    detail:
      "100 × votre trésorerie nette ÷ la meilleure trésorerie nette de la partie ; 0 si la vôtre est nulle ou négative.",
  },
  {
    term: "Score d'impact",
    detail: "La moyenne de vos indicateurs environnemental et social, sur 100.",
  },
  {
    term: "Un seul gagnant",
    detail: "À égalité, la meilleure trésorerie nette l'emporte, puis le meilleur impact.",
  },
] as const;

/** The final score rule (R18), worded for players; the weights come from the game data. */
export function ScoreFormula() {
  return (
    <div className="space-y-4">
      <p className="font-display text-xl leading-tight font-bold uppercase">
        Score final = <span className="text-power-red">{scoreWeights.economic}</span> économie +{" "}
        <span className="text-power-red">{scoreWeights.impact}</span> impact
      </p>
      <dl className="grid gap-3 text-sm">
        {definitions.map(({ term, detail }) => (
          <div key={term}>
            <dt className="font-medium">{term}</dt>
            <dd className="text-pretty text-muted-foreground">{detail}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
