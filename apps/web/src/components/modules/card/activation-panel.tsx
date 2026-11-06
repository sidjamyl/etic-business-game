import { type CardId, cardRules, hrRules } from "@etic/content";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { cardName } from "./card-math";
import { FakeNewsForm } from "./fake-news-form";
import { AmnestyForm, SocialPeaceForm } from "./instant-forms";
import { SupplierPriorityForm } from "./supplier-form";
import { TargetForm } from "./target-form";

/** What playing the card does, in one sentence, above its form. */
const intro: Record<CardId, string> = {
  "fake-news":
    "Rédigez votre news et choisissez le journal qui la publie. Elle paraîtra aussitôt dans le fil de toutes les entreprises.",
  spying:
    "Choisissez un concurrent : vous découvrirez une fois son tableau de bord complet, sans qu'il le sache.",
  sabotage: `Choisissez un concurrent : une de ses machines, tirée au hasard, s'arrêtera ${cardRules.sabotageDays} jours.`,
  "supplier-priority":
    "Choisissez un fournisseur : le jour de son prochain réapprovisionnement, il ne vendra qu'à vous.",
  "social-peace": `Tous vos employés reviennent à 100 % de rendement, et leur rendement ne baissera pas pendant ${hrRules.raiseGraceDays} jours.`,
  amnesty: `Vos traces de marché noir sont effacées, et la prochaine accusation qui vous vise dans les ${cardRules.amnestyShieldDays} jours est annulée.`,
};

function ActivationForm({ id }: { id: CardId }) {
  switch (id) {
    case "fake-news":
      return <FakeNewsForm />;
    case "spying":
      return <TargetForm kind="spying" />;
    case "sabotage":
      return <TargetForm kind="sabotage" />;
    case "supplier-priority":
      return <SupplierPriorityForm />;
    case "social-peace":
      return <SocialPeaceForm />;
    case "amnesty":
      return <AmnestyForm />;
  }
}

/** How to play the card (stories 91–96): one path per card, always ending in a confirmation. */
export function ActivationPanel({ id }: { id: CardId }) {
  return (
    <Card>
      <CardHeader>
        <p className="eyebrow text-power-red">Activation</p>
        <h2 className="text-xl font-bold uppercase">Jouer « {cardName(id)} »</h2>
        <CardDescription className="text-pretty">{intro[id]}</CardDescription>
      </CardHeader>
      <CardContent>
        <ActivationForm id={id} />
      </CardContent>
    </Card>
  );
}
