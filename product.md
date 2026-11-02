# ETIC Business Game

Statut : brouillon de cadrage, à approfondir avec GrillMe.
Date : 2 novembre 2026.

## 1. Intention du projet

Le club ETIC organise un mini-projet dans le cadre de l'intégration de ses nouveaux membres. Les nouveaux membres apprennent à réaliser ce type de projet en construisant un business game : un jeu de simulation du cycle de vie d'une entreprise, destiné à apprendre à la gérer.

La profondeur doit susciter de la réflexion et de vrais arbitrages, sans imposer un projet démesuré. Comprendre les interactions entre fonctions de l'entreprise et décider en équipe font partie des objectifs validés. La distinction entre membres qui développent le projet et participants qui jouent reste à préciser.

Les équipes dirigent leurs entreprises dans un même monde économique. Elles doivent acheter, produire, vendre et livrer tout en gérant leurs employés, leurs investissements et leurs campagnes marketing. Leurs choix affectent leurs concurrents et leur propre trajectoire de développement.

Ce document conserve la vision exprimée par le porteur du projet. Il ne constitue pas encore une spécification de développement. Les règles chiffrées et les exemples illustratifs ne sont pas des paramètres définitifs.

## 2. Statut des informations

- **Acquis** : intention ou mécanique explicitement exprimée par le porteur du projet.
- **Exemple** : illustration donnée pour expliquer une idée ; contenu et valeurs à confirmer.
- **À décider** : règle encore ouverte ou recommandation de l'assistant sans réponse du porteur du projet.

Les réponses à la première série de questions et la prochaine série ouverte sont consignées en section 15. Les propositions non validées restent identifiées comme telles.

## 3. Univers et storytelling

### Situation initiale — acquis

Le monde a subi une grave crise économique et peine à s'en remettre. Le pouvoir d'achat a fortement chuté ; une grande partie de la population rencontre des difficultés pour se nourrir.

Les entreprises commencent dans cette économie fragilisée en proposant principalement des produits de première nécessité. Elles se développent progressivement vers des produits plus évolués, jusqu'à un seuil de progression encore à définir.

L'histoire doit accompagner cette évolution. Les événements économiques et les informations régionales rendent le monde vivant et obligent les équipes à adapter leurs décisions.

### Choix d'une région — acquis

Au début de la partie, chaque équipe choisit une région d'implantation. Chaque région offre des avantages et des inconvénients qui influencent la stratégie et l'exposition aux crises.

**Exemple de scénario fictif proposé** : commencer en Algérie pourrait donner accès à une clientèle importante tout en exposant l'entreprise à un événement d'instabilité politique susceptible de faire fortement baisser sa clientèle. Cet exemple est une piste de game design, pas une affirmation sur le pays réel.

**À décider** : régions disponibles, caractéristiques visibles au départ, différences de ressources, accès aux clients d'autres régions, mobilité ou expansion, et possibilité pour plusieurs équipes de choisir la même région.

## 4. Participants et marché partagé

### Équipes — acquis

Les joueurs sont regroupés en équipes en concurrence dans le même marché. La partie se déroule en présentiel sur une grande journée, approximativement de 10 h à 18 h. Toutes les équipes accèdent au logiciel et commencent et terminent au même moment. Elles achètent auprès des mêmes fournisseurs et partagent les ressources disponibles.

La rareté est effective : si un produit n'existe qu'en un exemplaire chez un fournisseur et qu'une équipe l'achète, les autres ne peuvent plus l'acheter tant qu'aucun nouveau stock n'est disponible. Les règles de réapprovisionnement restent à décider.

### Relations entre équipes — acquis

Les équipes peuvent collaborer, s'allier et se trahir. Cette liberté fait partie de l'expérience souhaitée.

**À décider** : taille et nombre d'équipes, accès individuels ou compte partagé, échanges autorisés, transferts de fonds ou de marchandises, contrats, visibilité des accords et moyens de trahison. La présence d'un outil de négociation dans la plateforme n'est pas encore décidée.

## 5. Temps et boucle de jeu

### Temps — acquis à préciser

Le jeu comporte un temps simulé accéléré. La formulation initiale indique qu'« un jour équivaut à une minute » ; l'interprétation proposée est **un jour simulé pour une minute réelle**, à confirmer explicitement.

Les approvisionnements, fabrications, livraisons, salaires, pertes de rendement, campagnes et événements doivent être cohérents avec ce temps commun.

**Acquis** : session commune en présentiel d'environ 10 h à 18 h, soit environ huit heures réelles. L'horaire exact reste ajustable.

**À décider** : confirmation du ratio temporel, pauses communes, fonctionnement pendant les déconnexions, calendrier des prélèvements et résolution des actions simultanées. À titre de calcul, huit heures sans pause représenteraient 480 jours simulés avec le ratio proposé ; cette durée simulée n'est pas encore validée.

### Boucle d'activité — synthèse des mécaniques exprimées

1. Lire les informations disponibles et observer le marché.
2. Choisir les achats et investissements accessibles à son entreprise.
3. Attendre les approvisionnements nécessaires.
4. Fabriquer avec les matières premières, machines et ressources humaines disponibles.
5. Proposer des produits au marché et recevoir des demandes de livraison.
6. Organiser les livraisons, supporter leurs coûts et réaliser les ventes.
7. Réinvestir et adapter sa stratégie selon les résultats, les événements et les décisions adverses.

Cette boucle ne fixe pas encore le moment exact des paiements ni le caractère manuel ou automatique de chaque action.

## 6. Achat et approvisionnement

### Acquis

Le module achat permet d'acheter des produits et des matières premières auprès de différents fournisseurs. Les machines nécessaires à la fabrication doivent également être achetées ; leur rattachement exact à l'interface achat reste ouvert.

Chaque fournisseur propose ses propres prix et délais de livraison. Une équipe doit donc arbitrer entre coût, disponibilité et rapidité.

Les stocks des fournisseurs sont partagés entre les équipes.

### À décider

Catalogue initial, quantités disponibles, fréquence de réapprovisionnement, évolution des prix, paiement et réservation du stock, annulation, capacité de stockage et possibilité de revendre directement les produits achetés.

## 7. Fabrication

### Acquis

Les équipes fabriquent des produits à partir de matières premières et de machines achetées. Chaque machine permet de fabriquer un ensemble prédéfini de produits, avec des durées et capacités propres.

Le rendement des machines diminue avec le temps en raison de l'usure.

### Exemples

- Une machine commence avec un rendement de 100 %, qui baisse ensuite.
- Une machine peut fabriquer deux produits définis en un temps X ; une autre peut en fabriquer trois autres en un temps Y.

La notion de « deux produits » peut désigner des références compatibles ou des quantités par cycle : ce point doit être clarifié.

### À décider

Recettes, unités produites par cycle, files de production, fabrication simultanée, affectation des employés, consommation des matières, signification du rendement, usure liée au temps ou à l'utilisation, panne éventuelle, maintenance, réparation et remplacement.

## 8. Vente et livraison

### Vente — acquis

Les équipes mettent leurs produits fabriqués sur le marché et reçoivent des demandes de livraison. Les équipes se disputent un même marché ; la répartition de la demande reste à définir.

**À décider** : fixation des prix, origine et fréquence des demandes, critères de choix des clients, acceptation ou refus d'une commande, réservation de stock, annulation et moment de l'encaissement.

### Livraison — acquis

Les demandes obtenues doivent être livrées. Chaque livraison possède un coût et un délai qui affectent la décision commerciale.

**À décider** : choix de transporteurs ou d'options, impact de la distance et de la région, livraison partielle, retard, échec et pénalités.

## 9. Ressources humaines

### Acquis

L'entreprise gère des employés et leur verse un salaire. Si un employé ne reçoit pas d'augmentation pendant un certain temps, son rendement diminue.

Cette mécanique crée un arbitrage entre coût salarial et productivité.

### À décider

Recrutement, métiers, effectifs initiaux, affectation, fréquence de paie, délai avant baisse de rendement, montant d'augmentation nécessaire, effet d'une augmentation sur le rendement, impayés, départs et licenciements.

## 10. Marketing

### Acquis

Les équipes peuvent lancer des campagnes marketing. Chaque campagne possède une durée, un public cible et un effet sur les ventes.

**Exemple** : une campagne augmente les ventes de 20 %. Cette valeur n'est pas fixée.

### À décider

Coût des campagnes, publics disponibles, ciblage régional, indicateur affecté (demande, conversion ou autre), cumul de campagnes et mesure des résultats. Une hausse de la demande ne garantit pas une vente si l'entreprise ne peut pas répondre à la commande.

## 11. News et information

### Acquis

Le concept de **news remplace le forecasting**. Aucun module distinct de prévision n'est prévu dans la vision actuelle.

Des nouvelles paraissent régulièrement, par exemple chaque semaine simulée. Elles parlent du public et de la vie dans différentes régions et donnent des indices indirects sur les changements économiques et de consommation.

Les équipes doivent interpréter ces textes. Une news ne doit pas annoncer explicitement qu'un produit va devenir très demandé.

### À décider

Fréquence définitive, rédaction, diffusion globale ou régionale, lien entre indices et événements, degré d'incertitude, archivage et distinction éventuelle entre sources.

## 12. Événements

### Acquis

Des événements réguliers font évoluer les conditions de jeu et forcent les équipes à s'adapter. Ils peuvent être positifs ou négatifs, mondiaux ou liés à un contexte particulier.

### Exemples exprimés

- Un changement du comportement des consommateurs.
- Une crise qui rend un produit indisponible.
- La découverte d'une substance toxique dans un produit, qui fait disparaître sa demande.
- L'apparition d'un produit particulièrement utile et rare, vendu aux enchères.

Les enchères sont donc une mécanique envisagée à préciser.

### Pilotage retenu pour le cadrage

Le porteur du projet laisse ce choix à l'assistant et privilégie la simplicité : un calendrier d'événements préparé à l'avance et exécuté automatiquement. Un contrôle manuel étendu des organisateurs reste une possibilité facultative, uniquement si son coût de réalisation est faible. Il n'est pas nécessaire au fonctionnement prévu.

### À décider

Fréquence, durée, portée, préavis, lien avec les news, conditions de fin et règles d'enchères. Les événements doivent pouvoir affecter l'offre, la demande ou d'autres paramètres explicitement définis.

## 13. Marché noir, cartes secrètes et easter eggs

### Marché noir — acquis

Le marché noir permet d'acheter moins cher et de vendre plus cher. Il expose l'équipe à un malus si ses activités sont découvertes par d'autres équipes.

La formulation initiale évoquait une défaite, puis a été corrigée en malus : l'élimination n'est donc pas une règle établie.

**À décider** : produits concernés, accès, stocks, acheteurs, détection, preuves, accusation, traitement des accusations infondées et pénalité.

### Cartes secrètes — acquis

Chaque équipe reçoit aléatoirement une carte secrète au début de la partie. Cette carte confère un pouvoir ou bonus activable à un moment choisi.

**Exemple** : diffuser une fake news dans le jeu pour induire les autres équipes en erreur.

**À décider** : catalogue, équilibrage, nombre d'utilisations, conditions d'activation, visibilité, durée, portée et relation entre fake news et effets économiques réels. La possibilité de tromper les équipes est acquise ; un effet direct sur la demande ne l'est pas.

### Easter eggs — acquis

De petits easter eggs doivent être cachés dans la plateforme.

**À décider** : nature, déclencheurs, indices et éventuelles récompenses ou conséquences.

## 14. Progression et spécialisation

### Acquis

L'entreprise commence par les produits de première nécessité et accède progressivement à des produits plus évolués.

Les équipes ne doivent pas toutes vivre la même expérience. Certains choix structurants sont exclusifs : choisir de fabriquer ou d'acquérir un produit ou une branche peut bloquer l'accès à une autre possibilité.

La progression prend ainsi la forme d'un arbre de décisions avec différentes trajectoires.

**Exemple de divergence en fin de partie** : une équipe vend des consoles de type Switch 2, une autre des ordinateurs portables. Ces produits illustrent les spécialisations ; ils ne constituent pas un catalogue arrêté.

### À décider

Paliers, conditions de déblocage, coût et visibilité des choix, permanence des exclusions, nombre de branches et équilibre économique entre trajectoires. Le seuil final de développement reste ouvert. Le classement final et l'impact social et environnemental sont décrits en section 15.

## 15. Décisions de cadrage et entretien en cours

### Première série — réponses enregistrées

| ID | Sujet | Réponse et statut |
| --- | --- | --- |
| Q1 | Objectif pédagogique et profondeur | Validé : apprendre à réaliser ce type de projet, comprendre la gestion de l'entreprise et réfléchir en équipe. Une profondeur stratégique réelle est souhaitée, avec une réalisation de taille raisonnable. |
| Q2 | Format | Validé : journée en présentiel, approximativement 10 h–18 h, début et fin communs à toutes les équipes. La proposition de 2–3 heures est remplacée. Le ratio temporel et les pauses restent à préciser. |
| Q3 | Victoire | À la fin de la journée, l'argent détenu est un critère de victoire. Le porteur souhaite aussi prendre en compte l'impact social et environnemental. Leur combinaison et leurs mesures restent ouvertes. La valorisation des stocks et des équipements proposée par l'assistant n'a pas été retenue comme règle. |
| Q4 | Organisateurs | Choix délégué à l'assistant, avec une préférence pour la simplicité : événements prédéfinis et automatiques. Un pilotage manuel est facultatif si peu coûteux. |
| Q5 | Périmètre de la première version | Toutes les mécaniques décrites sont souhaitées jouables dès cette version. Réduire le volume de contenu reste une proposition à discuter ; supprimer des mécaniques n'est pas une décision validée. |

### Classement et impact social et environnemental

**Acquis** : l'argent disponible à la fin de la journée compte dans la victoire. Le volet social et environnemental doit être approfondi comme autre dimension de réussite.

**À décider** : un classement unique ou plusieurs récompenses, priorité de l'argent, poids des impacts, mesure des impacts, distinction entre social et environnemental, égalités et traitement des engagements en cours à la clôture. Aucun score composite ni formule comptable n'est encore validé.

### Deuxième série — questions ouvertes

Les recommandations suivantes sont proposées par l'assistant et attendent une réponse. Un « oui » accepte la recommandation de la question concernée.

| ID | Question | Recommandation non validée |
| --- | --- | --- |
| Q6 | Faut-il plusieurs récompenses plutôt qu'un score combinant argent et impact ? | Un gagnant économique, selon l'argent disponible à la clôture, et une distinction séparée pour l'impact social et environnemental. Cela évite de fixer immédiatement un taux de conversion entre argent et impact. |
| Q7 | Les impacts doivent-ils découler des décisions courantes ? | Oui : effets sociaux et environnementaux définis pour les fournisseurs, les produits, les transports et les conditions salariales ; indicateurs visibles par l'équipe, sans module de gestion supplémentaire. Les règles et unités seront précisées ensuite. |
| Q8 | Confirmer un jour simulé par minute réelle, avec une pause commune possible ? | Oui : temps global partagé et gel de toute la simulation pendant une pause commune, notamment pour le déjeuner. Huit heures hors pauses représenteraient 480 jours simulés. |
| Q9 | Les membres d'une équipe doivent-ils gérer ensemble une seule entreprise ? | Oui : une entreprise par équipe, plusieurs accès individuels et les mêmes droits de décision pour ses membres. Nombre d'équipes et de personnes à préciser si déjà connus. |
| Q10 | Le marché client doit-il être simulé par le logiciel ? | Oui : des clients simulés génèrent une demande partagée que les équipes se disputent ; les échanges entre équipes constituent une activité distincte. La formule d'attribution sera décidée ensuite. |
| Q11 | Peut-on limiter le contenu tout en conservant toutes les mécaniques ? | Oui : petit catalogue, quelques régions, spécialisations, événements et cartes pour la première version. Délai de réalisation, nombre de développeurs et niveau technique à communiquer pour dimensionner ce contenu. |

## 16. Reprendre le cadrage

Reprendre les questions Q6–Q11 en attente de la section 15. Les réponses à Q1–Q5 sont enregistrées. Recalculer ensuite les questions dépendantes selon les réponses, sans transformer une recommandation restée sans réponse en règle acquise.

Les domaines à approfondir comprennent :

- Le format de la partie, les participants et le rôle des organisateurs.
- La victoire, la trésorerie initiale, les coûts récurrents et le sort d'une entreprise sans liquidités.
- La demande, les prix, la concurrence et les transactions sur les stocks partagés.
- La production, l'usure, les employés et les délais.
- Les régions, la progression et les choix exclusifs.
- Les news, les événements, le marché noir, les cartes et les alliances.
- Le périmètre de la première version, puis les contraintes de réalisation du mini-projet.

Une nouvelle session peut approfondir une partie du document seulement. Elle doit enregistrer les décisions validées et conserver explicitement les questions restantes.

## 17. Périmètre de réalisation

La première version doit rendre jouables toutes les mécaniques décrites : régions, temps partagé, achats, fabrication et usure, ventes, livraisons, ressources humaines, marketing, news, événements et enchères, marché noir, cartes secrètes, alliances et trahisons, easter eggs et progression à choix exclusifs. Le volet social et environnemental souhaité doit également être défini.

Cette ambition est un objectif produit, pas encore une estimation de faisabilité. Le volume de contenu, les priorités de réalisation, le calendrier, les ressources disponibles, la plateforme cible et la stack technique restent à décider.

Aucune application n'est encore implémentée dans ce dépôt. Aucun équilibrage économique ni scénario de partie complet n'a encore été testé.
