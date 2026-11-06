import { cardRules } from "@etic/content";
import { Building2 } from "lucide-react";
import { useId, useState } from "react";
import { EmptyState } from "@/components/game/empty-state";
import { RadioGroup } from "@/components/ui/radio-group";
import { regionName } from "@/lib/format";
import { useView } from "@/lib/game";
import { sabotageResumeDay, targetOptions, tierLabel } from "./card-math";
import { ChoiceCard } from "./choice-card";
import { PlayCardAction } from "./play-card-action";
import { usePlayCard } from "./use-play-card";

export type TargetCard = "spying" | "sabotage";

/** What each targeted card says before and in its confirmation (N18). */
function wording(kind: TargetCard, name: string, today: number) {
  if (kind === "spying") {
    return {
      legend: "Entreprise à espionner",
      readyHint: "Le rapport sera figé au moment où vous jouerez la carte.",
      title: `Espionner ${name} ?`,
      description: `Vous découvrez son tableau de bord complet tel qu'il est aujourd'hui, jour ${today}.`,
      consequences: [
        "Trésorerie, dette, réputation, stocks, machines, effectifs, commandes, prix et traces de marché noir.",
        `Le rapport reste figé au jour ${today} : il ne sera jamais mis à jour.`,
        `${name} ne saura jamais qu'elle a été espionnée.`,
      ],
      confirmLabel: "Espionner",
      success: `Rapport d'espionnage sur ${name} prêt.`,
    };
  }
  return {
    legend: "Entreprise à saboter",
    readyHint: "Elle saura qu'elle a été sabotée, jamais par qui.",
    title: `Saboter ${name} ?`,
    description: `Une de ses machines, tirée au hasard, s'arrête aussitôt et ne pourra pas redémarrer avant le jour ${sabotageResumeDay(today)}.`,
    consequences: [
      `${name} est prévenue qu'elle a subi une carte, sans savoir qui l'a jouée.`,
      "Si elle n'a encore aucune machine, l'activation est refusée et vous gardez votre carte.",
    ],
    confirmLabel: "Saboter",
    success: `Sabotage réussi : une machine de ${name} est à l'arrêt pour ${cardRules.sabotageDays} jours.`,
  };
}

/** Spying and sabotage (stories 92–93): choose a competitor, then confirm. */
export function TargetForm({ kind }: { kind: TargetCard }) {
  const view = useView();
  const { play, locked } = usePlayCard();
  const baseId = useId();
  const [targetId, setTargetId] = useState<string | null>(null);
  const options = targetOptions(view.competitors);
  // The choice is dropped if that company leaves the game meanwhile.
  const target = options.find((option) => option.id === targetId) ?? null;
  const today = view.clock.time.day;
  const text = wording(kind, target?.name ?? "cette entreprise", today);

  if (options.length === 0) {
    return (
      <EmptyState icon={Building2} title="Aucune autre entreprise dans la partie">
        Il faut au moins un concurrent pour jouer cette carte.
      </EmptyState>
    );
  }

  return (
    <form onSubmit={(event) => event.preventDefault()} noValidate className="space-y-5">
      <div className="space-y-2">
        <p id={`${baseId}-legend`} className="text-sm font-medium">
          {text.legend}
        </p>
        <RadioGroup
          aria-labelledby={`${baseId}-legend`}
          value={target?.id ?? ""}
          onValueChange={setTargetId}
          disabled={locked}
          className="grid gap-3 sm:grid-cols-2"
        >
          {options.map((option) => (
            <ChoiceCard
              key={option.id}
              id={`${baseId}-${option.id}`}
              value={option.id}
              selected={target?.id === option.id}
              disabled={locked}
            >
              <span className="truncate font-medium">{option.name}</span>
              <span className="text-xs text-muted-foreground">
                {regionName(option.region)} · {tierLabel(option.tier, option.branch)}
              </span>
            </ChoiceCard>
          ))}
        </RadioGroup>
      </div>
      <PlayCardAction
        locked={locked}
        ready={target !== null}
        hint={target ? text.readyHint : "Choisissez une entreprise pour continuer."}
        title={text.title}
        description={text.description}
        consequences={text.consequences}
        confirmLabel={text.confirmLabel}
        onConfirm={() =>
          target ? play({ kind, targetTeamId: target.id }, text.success) : Promise.resolve(false)
        }
      />
    </form>
  );
}
