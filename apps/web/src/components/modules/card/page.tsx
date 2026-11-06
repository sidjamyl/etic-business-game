import { Spade } from "lucide-react";
import { EmptyState } from "@/components/game/empty-state";
import { PageHeader } from "@/components/game/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useView } from "@/lib/game";
import { ActivationPanel } from "./activation-panel";
import { CardAttacks } from "./card-attacks";
import { findPlay } from "./card-math";
import { CardOutcome } from "./card-outcome";
import { CardRules } from "./card-rules";
import { SecretCardFace } from "./secret-card";

/** The game ended with the card still in hand. */
function NeverPlayed() {
  return (
    <Card>
      <CardHeader>
        <p className="eyebrow text-muted-foreground">Partie terminée</p>
        <h2 className="text-xl font-bold uppercase">Carte jamais jouée</h2>
      </CardHeader>
      <CardContent className="text-sm text-pretty text-muted-foreground">
        Votre carte est restée secrète jusqu'au bout : elle ne peut plus être jouée.
      </CardContent>
    </Card>
  );
}

/**
 * Secret card (#39, R14, N18, stories 90–97): the team's card drawn with the charter's dotted
 * shadow, one activation path per card (writing, target or supplier choice, confirmation), what
 * it did once played — the spying report among others — and the cards played against the
 * company, always anonymously.
 */
export function CardPage() {
  const { team, clock } = useView();
  const card = team.card;
  const play = card?.used ? findPlay(team.log, card.id) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Carte secrète"
        title="Votre atout"
        description="Tirée au hasard au lancement, elle ne sert qu'une fois. Son activation est anonyme : personne ne saura que c'est vous."
      />
      {card === null ? (
        <EmptyState icon={Spade} title="Pas de carte secrète">
          Les cartes sont distribuées au lancement de la partie.
        </EmptyState>
      ) : (
        <div className="grid items-start gap-8 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="space-y-8">
            <SecretCardFace card={card} play={play} />
            <CardRules own={card.id} />
          </div>
          <div className="space-y-6">
            {card.used ? (
              <CardOutcome card={card} play={play} />
            ) : clock.status === "ended" ? (
              <NeverPlayed />
            ) : (
              <ActivationPanel id={card.id} />
            )}
            <CardAttacks />
          </div>
        </div>
      )}
    </div>
  );
}
