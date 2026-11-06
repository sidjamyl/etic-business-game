/** Presentation-only scenario data; the normal game scenario is unchanged. */
export const demoFilm = {
  seed: "etic-film-v1",
  startDay: 200,
  endDay: 202,
  companyNames: ["Collectif", "Alliance", "Horizon", "Élan"],
  profiles: [
    { base: 0, region: "ferronia" },
    { base: 0, region: "nordhaven" },
    { base: 2, region: "port-libre" },
    { base: 3, region: "azura" },
  ],
  news: [
    {
      id: "n-031",
      title: "Le réseau industriel de Ferronia montre des signes de fatigue",
      body: "Des baisses de tension perturbent les équipements. Les équipes techniques préparent une intervention préventive.",
    },
    {
      id: "n-032",
      title: "Incident technique — production suspendue",
      body: "Une panne du réseau industriel immobilise temporairement les machines de Ferronia. Aucun blessé : les équipes sont en sécurité. Les fournisseurs locaux sont également perturbés.",
    },
    {
      id: "n-amb-33",
      title: "Le réseau industriel de Ferronia est rétabli",
      body: "Les équipes techniques ont terminé leur intervention. Les fournisseurs locaux reprennent progressivement leur activité.",
    },
  ],
  event: { id: "e-ferronia-accident", title: "Panne technique à Ferronia" },
  raisePercent: 5,
  marketingDays: 14,
  tradePriceFactor: 0.8,
} as const;
