import { type CardId, cards } from "@etic/content";
import { EyeOff, type LucideIcon, PauseCircle, Shuffle, Undo2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { cardIcon } from "./card-icons";

const rules: { icon: LucideIcon; text: string }[] = [
  {
    icon: Shuffle,
    text: "Chaque entreprise a reçu au lancement une carte tirée au hasard. Elle ne sert qu'une fois.",
  },
  {
    icon: EyeOff,
    text: "Activation anonyme : personne ne sait quelle carte vous détenez, ni qui a joué une carte contre lui.",
  },
  {
    icon: Undo2,
    text: "Une activation refusée (cible sans machine, par exemple) ne consomme pas la carte.",
  },
  {
    icon: PauseCircle,
    text: "Impossible de jouer une carte pendant une pause ou après la fin de la partie.",
  },
];

/** How secret cards work (R14, N18), and the six cards any company may hold. */
export function CardRules({ own }: { own: CardId | null }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="eyebrow font-sans text-muted-foreground">Règles des cartes</h2>
      </CardHeader>
      <CardContent className="space-y-5">
        <ul className="space-y-3 text-sm">
          {rules.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3">
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-pretty">{text}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-2 border-t pt-4">
          <h3 className="eyebrow font-sans text-muted-foreground">Les six cartes du jeu</h3>
          <ul className="space-y-2.5 text-sm">
            {cards.map((card) => {
              const Icon = cardIcon[card.id];
              const mine = card.id === own;
              return (
                <li key={card.id} className="flex gap-3">
                  <Icon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      mine ? "text-power-red" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="font-medium">
                      {card.name}
                      {mine ? (
                        <span className="ml-2 eyebrow rounded-full bg-power-red px-1.5 py-0.5 text-milk">
                          La vôtre
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-pretty text-muted-foreground">{card.description}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
