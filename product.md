# ETIC Business Game

Statut : brouillon de cadrage, à approfondir avec GrillMe.
Date : 2 novembre 2026.

## 1. Intention du projet

Le club ETIC organise un mini-projet dans le cadre de l'intégration de ses nouveaux membres. Le projet consiste à créer un business game : un jeu de simulation du cycle de vie d'une entreprise, destiné à apprendre à la gérer.

Les équipes dirigent leurs entreprises dans un même monde économique. Elles doivent acheter, produire, vendre et livrer tout en gérant leurs employés, leurs investissements et leurs campagnes marketing. Leurs choix affectent leurs concurrents et leur propre trajectoire de développement.

Ce document conserve la vision exprimée par le porteur du projet. Il ne constitue pas encore une spécification de développement. Les règles chiffrées et les exemples illustratifs ne sont pas des paramètres définitifs.

## 2. Statut des informations

- **Acquis** : intention ou mécanique explicitement exprimée par le porteur du projet.
- **Exemple** : illustration donnée pour expliquer une idée ; contenu et valeurs à confirmer.
- **À décider** : règle encore ouverte ou recommandation de l'assistant sans réponse du porteur du projet.

Les cinq premières questions de cadrage sont consignées en section 15. Aucune de leurs recommandations n'a encore été validée.

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

Les joueurs sont regroupés en équipes en concurrence dans le même marché. Elles achètent auprès des mêmes fournisseurs et partagent les ressources disponibles.

La rareté est effective : si un produit n'existe qu'en un exemplaire chez un fournisseur et qu'une équipe l'achète, les autres ne peuvent plus l'acheter tant qu'aucun nouveau stock n'est disponible. Les règles de réapprovisionnement restent à décider.

### Relations entre équipes — acquis

Les équipes peuvent collaborer, s'allier et se trahir. Cette liberté fait partie de l'expérience souhaitée.

**À décider** : taille et nombre d'équipes, accès individuels ou compte partagé, échanges autorisés, transferts de fonds ou de marchandises, contrats, visibilité des accords et moyens de trahison. La présence d'un outil de négociation dans la plateforme n'est pas encore décidée.

## 5. Temps et boucle de jeu

### Temps — acquis à préciser

Le jeu comporte un temps simulé accéléré. La formulation initiale indique qu'« un jour équivaut à une minute » ; l'interprétation proposée est **un jour simulé pour une minute réelle**, à confirmer explicitement.

Les approvisionnements, fabrications, livraisons, salaires, pertes de rendement, campagnes et événements doivent être cohérents avec ce temps commun.

**À décider** : durée réelle d'une partie, début et fin, pauses, fonctionnement pendant les déconnexions, calendrier des prélèvements et résolution des actions simultanées.

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

### À décider

Déclenchement automatique ou par les organisateurs, fréquence, durée, portée, préavis, lien avec les news, conditions de fin et règles d'enchères. Les événements doivent pouvoir affecter l'offre, la demande ou d'autres paramètres explicitement définis.

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

Paliers, conditions de déblocage, coût et visibilité des choix, permanence des exclusions, nombre de branches et équilibre économique entre trajectoires. Le seuil final de développement et les conditions de victoire restent ouverts.

## 15. Première série GrillMe — en attente de réponses

Ces recommandations ont été proposées par l'assistant. Le porteur du projet n'y a pas encore répondu ; elles ne sont pas des décisions.

| ID | Question | Recommandation proposée, non validée |
| --- | --- | --- |
| Q1 | Quelle priorité pédagogique donner au jeu ? | Faire comprendre les liens entre achats, production, employés, ventes et trésorerie, et apprendre la décision en équipe avec des conséquences compréhensibles. |
| Q2 | Quel format et quelle durée pour une partie ? | Session simultanée à début et fin communs, pendant 2 à 3 heures réelles ; confirmer aussi 1 jour simulé = 1 minute réelle. |
| Q3 | Comment déterminer le gagnant ? | Classement à la fin du temps imparti selon la valeur finale de l'entreprise : trésorerie, stocks et équipements, moins les dettes ; formule à définir. L'existence de dettes reste elle-même à décider. |
| Q4 | Quel contrôle donner aux organisateurs ? | Un maître du jeu pouvant lancer ou suspendre le temps, publier les news et déclencher des événements ; règles courantes automatiques. |
| Q5 | Comment distinguer vision complète et première version ? | Conserver toutes les mécaniques dans la vision, puis choisir ensemble le périmètre minimal jouable du mini-projet. |

## 16. Reprendre le cadrage

Commencer par les réponses à Q1–Q5. Recalculer ensuite les questions dépendantes selon les réponses, sans transformer une recommandation restée sans réponse en règle acquise.

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

La vision ci-dessus conserve toutes les idées exprimées. La première version jouable, les priorités, le calendrier de réalisation, les ressources disponibles, la plateforme cible et la stack technique restent à décider.

Aucune application n'est encore implémentée dans ce dépôt. Aucun équilibrage économique ni scénario de partie complet n'a encore été testé.
