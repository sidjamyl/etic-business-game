import { z } from "zod";

/** Secret cards catalog (R14). Effects are implemented in the Secret cards issue. */
export const cardSchema = z.object({
  id: z.enum(["fake-news", "spying", "sabotage", "supplier-priority", "social-peace", "amnesty"]),
  name: z.string(),
  description: z.string(),
});

export type Card = z.infer<typeof cardSchema>;
export type CardId = Card["id"];

export const cards = z.array(cardSchema).parse([
  {
    id: "fake-news",
    name: "Fake news",
    description:
      "Publiez une news de votre plume, sous la source de votre choix. Personne ne saura qu'elle est fausse.",
  },
  {
    id: "spying",
    name: "Espionnage",
    description: "Consultez une fois le tableau de bord complet d'un concurrent.",
  },
  {
    id: "sabotage",
    name: "Sabotage",
    description: "Arrêtez une machine d'un concurrent pendant 5 jours.",
  },
  {
    id: "supplier-priority",
    name: "Priorité fournisseur",
    description:
      "Obtenez un jour d'accès exclusif au prochain réapprovisionnement d'un fournisseur.",
  },
  {
    id: "social-peace",
    name: "Paix sociale",
    description:
      "Tous vos employés reviennent à 100 % de rendement et leur baisse est gelée pendant 60 jours.",
  },
  {
    id: "amnesty",
    name: "Amnistie",
    description: "Effacez vos traces de marché noir et annulez une accusation qui vous vise.",
  },
]);

export const cardById = new Map(cards.map((card) => [card.id, card]));
