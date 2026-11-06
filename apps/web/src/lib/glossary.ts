/**
 * Short explanations shown in tooltips on key indicators (R22, F22).
 * Never give exact formulas or hidden odds.
 */
export const glossary = {
  machineEfficiency:
    "Rendement de la machine : il baisse un peu chaque jour où elle travaille. Une maintenance le remonte.",
  workforceEfficiency:
    "Rendement des opérateurs : un employé jamais augmenté finit par travailler moins bien.",
  output:
    "Production d'un cycle = production prévue × rendement de la machine × rendement des opérateurs.",
  attractiveness:
    "Ce qui fait choisir votre offre : prix comparé au pouvoir d'achat local, réputation, distance et marketing.",
  reputation:
    "Elle monte avec les livraisons à l'heure et baisse avec les retards, les échecs et les scandales.",
  localPrice:
    "Prix que les clients de la région jugent normal. En dessous, ils achètent davantage.",
  maxPrice: "Au-delà de ce prix, plus personne n'achète dans la région.",
  availableCash:
    "Trésorerie disponible : votre trésorerie moins l'argent bloqué par vos offres d'enchères.",
  netCash: "Trésorerie nette : trésorerie moins dettes. C'est elle qui compte à la fin.",
  warehouse:
    "Capacité de l'entrepôt, toutes marchandises confondues. Plein, il bloque livraisons et production.",
  logistics: "Expéditions que vos logisticiens peuvent préparer par jour.",
  environmental:
    "Indicateur environnemental : fournisseurs, produits, région de production et transport.",
  social: "Indicateur social : salaires, fournisseurs, grèves, licenciements et marché noir.",
  impact:
    "Impact = moyenne des indicateurs social et environnemental ; il compte pour 30 % du score.",
  traces: "Traces de marché noir : elles restent 30 jours et rendent une enquête efficace.",
  ethics: "Note éthique du fournisseur (sociale et environnementale), sur 100.",
} as const;

export type GlossaryKey = keyof typeof glossary;
