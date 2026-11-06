import { z } from "zod";

/**
 * Player guide (R22): one short section per module, written for players.
 * Never documents exact formulas, black-market odds or easter eggs.
 */
export const guideSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  paragraphs: z.array(z.string()).min(1),
});
export type GuideSection = z.infer<typeof guideSectionSchema>;

export const guide = z.array(guideSectionSchema).parse([
  {
    id: "start",
    title: "Bien démarrer",
    paragraphs: [
      "Votre entreprise démarre avec ₢50 000 et rien d'autre : ni machine, ni employé. Le temps tourne pour tout le monde au même rythme : une minute réelle correspond à un jour simulé.",
      "Une première boucle simple : achetez une machine, recrutez ses opérateurs, commandez les matières de sa recette, fixez un prix de vente, acceptez les commandes, puis expédiez-les. Tout s'enchaîne ensuite.",
      "Lisez les news : elles ne disent jamais ce qui va se passer, mais elles le laissent deviner.",
    ],
  },
  {
    id: "purchasing",
    title: "Achats et entrepôt",
    paragraphs: [
      "Chaque matière est vendue par plusieurs fournisseurs : les moins chers sont souvent les moins vertueux. Le délai de livraison dépend de la distance entre le fournisseur et votre région.",
      "Le stock des fournisseurs est partagé entre toutes les entreprises et se reconstitue à date fixe. Ce que vous achetez, les autres ne peuvent plus l'acheter.",
      "Une commande est payée et réservée immédiatement ; elle ne peut pas être annulée. Si votre entrepôt est plein, les livraisons attendent dehors : gardez de la place pour vos produits finis.",
    ],
  },
  {
    id: "production",
    title: "Production et machines",
    paragraphs: [
      "Une machine fabrique un produit à la fois, par cycles. Elle a besoin d'un nombre minimal d'opérateurs et des matières de la recette, consommées au début du cycle.",
      "La quantité produite dépend du rendement de la machine et de celui de vos opérateurs. Une machine s'use un peu chaque jour où elle travaille : une maintenance l'immobilise quelques jours mais lui rend presque toute sa vigueur.",
      "Une machine qui attend (matières, opérateurs, place) ne rapporte rien. Surveillez son état.",
    ],
  },
  {
    id: "hr",
    title: "Ressources humaines",
    paragraphs: [
      "Vous recrutez des opérateurs pour les machines et des logisticiens pour préparer les expéditions. Le bassin d'emploi de votre région est limité et partagé avec les autres entreprises de la région.",
      "La paie tombe tous les 30 jours. Sans argent pour la verser, vos employés se mettent en grève et la production s'arrête ; si la grève dure trop longtemps, ils démissionnent tous.",
      "Un employé jamais augmenté finit par perdre en efficacité. Une augmentation, même modeste, le remotive.",
    ],
  },
  {
    id: "sales",
    title: "Ventes et commandes",
    paragraphs: [
      "Fixez un prix par produit et par région : sans prix, vous ne vendez pas dans cette région. Chaque région a son pouvoir d'achat : au-delà d'un certain prix, personne n'achète.",
      "Les clients se répartissent entre les entreprises selon le prix, la réputation, la distance et le marketing. Les commandes arrivent dans votre boîte de réception : acceptez-les si vous avez le stock, sinon laissez-les expirer.",
      "Une commande acceptée doit être livrée avant son échéance. Le client paie à la livraison.",
    ],
  },
  {
    id: "delivery",
    title: "Livraisons",
    paragraphs: [
      "Trois options de transport : standard, express (rapide mais cher et polluant) et verte (lente mais propre). Le coût dépend de la quantité et de la distance.",
      "Vos logisticiens préparent un nombre limité d'expéditions par jour. Une livraison en retard est payée moins cher et nuit à votre réputation ; une commande jamais expédiée finit annulée.",
    ],
  },
  {
    id: "marketing",
    title: "Marketing",
    paragraphs: [
      "Une campagne rend votre offre plus attrayante dans une région, pour un produit ou toute la gamme, pendant 7, 14 ou 30 jours.",
      "Elle vous fait gagner des clients sur vos concurrents, mais elle ne crée pas de clients qui n'existent pas. Inutile de faire de la publicité pour un produit que vous ne pouvez pas livrer.",
    ],
  },
  {
    id: "progression",
    title: "Progression",
    paragraphs: [
      "Vous commencez par les produits essentiels. Pour passer au palier suivant, vendez suffisamment de produits du palier actuel, puis financez un projet de développement.",
      "Au troisième palier, vous choisissez définitivement une branche : Tech ou Loisirs. L'autre vous sera fermée pour toujours.",
      "Attention : débloquer un palier ne crée pas ses clients. La demande pour les produits plus évolués revient avec la reprise économique.",
    ],
  },
  {
    id: "news",
    title: "News et événements",
    paragraphs: [
      "Deux journaux couvrent l'actualité : un quotidien sérieux et un tabloïd plus sensationnaliste. Les deux peuvent se tromper.",
      "Des événements bousculent régulièrement le marché : pénuries, crises, modes, scandales. Ceux qui lisent entre les lignes s'y préparent avant les autres.",
    ],
  },
  {
    id: "auctions",
    title: "Enchères",
    paragraphs: [
      "De temps en temps, un objet rare est mis aux enchères. Les offres sont secrètes et ne peuvent qu'augmenter ; le montant offert est bloqué jusqu'à la clôture.",
      "La plus haute offre l'emporte. Le nom du gagnant est annoncé, jamais le montant.",
    ],
  },
  {
    id: "black-market",
    title: "Marché noir",
    paragraphs: [
      "Le marché noir vend moins cher et achète plus cher. Chaque affaire laisse des traces pendant un moment.",
      "Les autres entreprises peuvent enquêter sur vous et vous accuser publiquement. Si elles ont raison, la sanction est lourde ; si elles ont tort, c'est l'accusateur qui paie.",
    ],
  },
  {
    id: "cards",
    title: "Carte secrète",
    paragraphs: [
      "Votre équipe a reçu une carte secrète au lancement. Elle ne sert qu'une fois : choisissez bien le moment.",
      "Personne ne sait quelle carte vous détenez, ni qui a joué une carte contre lui.",
    ],
  },
  {
    id: "trades",
    title: "Échanges entre entreprises",
    paragraphs: [
      "Négociez en personne, puis formalisez l'accord dans la plateforme : le vendeur propose une marchandise ou une machine à un prix, l'acheteur accepte ou refuse.",
      "Un contrat accepté est garanti : l'argent est bloqué et versé au vendeur à l'arrivée. Les virements et les dons, eux, reposent sur la confiance…",
    ],
  },
  {
    id: "finance",
    title: "Finance",
    paragraphs: [
      "Toutes vos recettes et dépenses sont inscrites au grand livre. Votre trésorerie ne peut jamais être négative : une dépense impossible est refusée.",
      "La banque prête jusqu'à un plafond, avec des intérêts réguliers. Un emprunt bien investi accélère votre croissance ; un emprunt qui comble des pertes les aggrave.",
    ],
  },
  {
    id: "impact",
    title: "Impact social et environnemental",
    paragraphs: [
      "Deux indicateurs mesurent votre manière de produire : l'environnement (fournisseurs, produits, région, transport) et le social (salaires, fournisseurs, grèves, licenciements).",
      "Ils comptent dans le score final, à côté de votre trésorerie. Le détail de chaque indicateur vous montre ce qui les fait monter ou baisser.",
    ],
  },
  {
    id: "score",
    title: "Score et fin de partie",
    paragraphs: [
      "À la fin, seule compte votre trésorerie nette (trésorerie moins dettes) : stocks et machines ne valent plus rien. Pensez à écouler vos stocks et à rembourser vos dettes avant la clôture.",
      "Le score final combine surtout le résultat économique, et pour une part plus petite l'impact social et environnemental. Un seul gagnant sera désigné.",
    ],
  },
]);
