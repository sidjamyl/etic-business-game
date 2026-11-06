# ETIC Business Game

Statut : cadrage des règles achevé (Q1–Q13, P1–P12, R1–R24, O1–O4) ; PRD v1 en cours de validation dans [`docs/prd-v1.md`](docs/prd-v1.md).
Dernière mise à jour : 6 novembre 2026.

## 1. Intention du projet

Le club ETIC organise un mini-projet dans le cadre de l'intégration de ses nouveaux membres : une journée de business game, un jeu de simulation du cycle de vie d'une entreprise, destiné à apprendre à la gérer.

La profondeur doit susciter de la réflexion et de vrais arbitrages, sans imposer un projet démesuré. Comprendre les interactions entre fonctions de l'entreprise et décider en équipe font partie des objectifs validés.

**Acquis (P1)** : le porteur du projet et l'assistant réalisent l'ensemble du logiciel. Les nouveaux membres jouent ; ils ne développent pas.

Les équipes dirigent leurs entreprises dans un même monde économique. Elles doivent acheter, produire, vendre et livrer tout en gérant leurs employés, leurs investissements et leurs campagnes marketing. Leurs choix affectent leurs concurrents et leur propre trajectoire de développement.

Les valeurs chiffrées citées dans ce document sont des valeurs de départ : le contenu et l'équilibrage définitifs sont produits selon la démarche R23 (section 15).

## 2. Statut des informations

- **Acquis** : intention, mécanique ou règle explicitement validée par le porteur du projet.
- **Exemple** : illustration donnée pour expliquer une idée ; contenu et valeurs à confirmer.
- **À décider** : règle encore ouverte ou recommandation de l'assistant sans réponse du porteur du projet.

Les réponses aux séries de questions sont consignées en section 15. Les propositions non validées restent identifiées comme telles.

## 3. Univers et storytelling

### Situation initiale — acquis

Le monde a subi une grave crise économique et peine à s'en remettre. Le pouvoir d'achat a fortement chuté ; une grande partie de la population rencontre des difficultés pour se nourrir.

Les entreprises commencent dans cette économie fragilisée en proposant principalement des produits de première nécessité. Elles se développent progressivement vers des produits plus évolués (section 14).

L'histoire accompagne cette évolution. Les événements économiques et les informations régionales rendent le monde vivant et obligent les équipes à adapter leurs décisions.

### Régions — acquis (R3)

Quatre régions fictives, sans affirmation sur des pays réels :

| Région | Avantage | Inconvénient ou risque |
| --- | --- | --- |
| **Azura** | Forte population, demande élevée en produits essentiels | Faible pouvoir d'achat ; instabilité politique pouvant faire chuter la clientèle |
| **Nordhaven** | Pouvoir d'achat élevé, demande précoce pour les paliers supérieurs | Petite population, salaires élevés |
| **Ferronia** | Région industrielle : fournisseurs proches, achats moins chers et plus rapides | Pollution, donc impact environnemental dégradé ; accidents industriels |
| **Port-Libre** | Plateforme commerciale : transport moins cher vers toutes les régions, accès facilité au marché noir | Contrôles douaniers : risque accru de découverte des activités de marché noir |

- Chaque région possède sa propre clientèle. Une équipe peut vendre dans toutes les régions, avec un coût et un délai de livraison croissants avec la distance.
- Plusieurs équipes peuvent choisir la même région et se concurrencer directement.
- La région d'implantation est définitive.

**Exemple d'origine** : l'idée d'une grande clientèle exposée à une instabilité politique, initialement illustrée par l'Algérie, est reprise sous la forme fictive d'Azura.

## 4. Participants et marché partagé

### Équipes — acquis

Chaque équipe gère une seule entreprise. Plusieurs membres se connectent simultanément et ont tous les mêmes droits de décision. Les équipes sont en concurrence dans le même marché. Toutes accèdent au logiciel et commencent et terminent au même moment. Elles achètent auprès des mêmes fournisseurs et partagent les ressources disponibles.

**Acquis (P3)** : configuration de référence de 4 équipes de 4 membres ; le nombre d'équipes reste configurable à la création de la partie.

La rareté est effective : si un produit n'existe qu'en un exemplaire chez un fournisseur et qu'une équipe l'achète, les autres ne peuvent plus l'acheter avant le réapprovisionnement (section 6).

### Rôles, connexion et équipes — acquis (P6–P8)

- Deux rôles : **participant** (membre d'une équipe) et **organisateur**. L'écran projeté ne demande aucune connexion.
- Connexion par **Google** ou par **e-mail et mot de passe** créés à l'inscription.
- L'organisateur est un compte ordinaire désigné comme organisateur.
- L'organisateur crée les équipes ; chaque équipe reçoit un **code**. Le participant saisit ce code une fois et reste rattaché à cette équipe pour la partie. Un participant n'appartient qu'à une équipe par partie ; seul l'organisateur peut le déplacer ou le retirer.
- **Acquis (O4)** : un plafond de membres par équipe est fixé à la création de la partie (4 par défaut) et reste modifiable par l'organisateur ; une équipe complète refuse son code avec le message « équipe complète ».
- **Acquis (O3)** : pas de réinitialisation du mot de passe par e-mail en v1. Un participant qui a oublié son mot de passe se connecte avec Google ou crée un nouveau compte et rejoint son équipe avec le code ; l'organisateur peut retirer l'ancien compte.

### Relations entre équipes — acquis (R15)

Les équipes peuvent collaborer, s'allier et se trahir. Les entreprises achètent et vendent entre elles des matières premières, des produits et des machines à prix négociés. Ces échanges ne désignent pas le rachat des entreprises.

- La négociation se fait **en personne** ; la plateforme ne propose pas de messagerie.
- **Offre d'échange formelle** : une équipe propose des marchandises, un prix, une option de transport et la prise en charge du transport. L'autre équipe accepte ou refuse.
- **Contrat garanti** : à l'acceptation, le paiement de l'acheteur est bloqué et les marchandises partent. Le vendeur est payé à l'arrivée. Aucune tricherie n'est possible sur un contrat.
- **Transferts libres** : une équipe peut envoyer de l'argent ou des marchandises sans contrepartie (don, prêt, avance).
- La trahison passe par les engagements hors contrat, les cartes secrètes, les accusations et les promesses orales.
- Les alliances sont informelles. Les échanges sont privés (équipes concernées et organisateur).

## 5. Temps et boucle de jeu

### Temps — acquis

Le jeu comporte un temps simulé accéléré : **un jour simulé pour une minute réelle**. Le temps est commun à toutes les équipes. L'organisateur peut mettre en pause toute la simulation, notamment pour le déjeuner.

Session commune en présentiel d'environ 10 h à 18 h. L'organisateur fixe l'heure de fin ou clôture manuellement (R19).

**Acquis (P10)** : pour les répétitions et l'équilibrage, l'organisateur peut créer une partie de test avec une vitesse et une durée différentes. La partie réelle reste à un jour par minute.

**Acquis (P9)** : le temps n'attend jamais une équipe. Une équipe entièrement déconnectée voit son entreprise continuer à fonctionner (production, livraisons, salaires, usure, campagnes), sans décision automatique. Un journal d'activité montre ce qui s'est passé.

**Acquis (O1)** : pendant une pause, les participants consultent leurs données ; toutes les décisions sont bloquées jusqu'à la reprise.

### Démarrage d'une partie — acquis (R21)

1. **Lobby** : l'organisateur ouvre la partie ; les participants se connectent et rejoignent leur équipe. L'horloge ne tourne pas.
2. Chaque équipe choisit un **nom d'entreprise** et sa **région**. Les choix sont visibles par tous et modifiables jusqu'au lancement.
3. L'organisateur lance la partie lorsque toutes les équipes sont prêtes : l'horloge démarre, chaque équipe reçoit sa trésorerie initiale et sa carte secrète tirée au hasard, et la première news paraît.

### Boucle d'activité — synthèse

1. Lire les informations disponibles et observer le marché.
2. Choisir les achats et investissements accessibles à son entreprise.
3. Attendre les approvisionnements nécessaires.
4. Fabriquer avec les matières premières, machines et employés disponibles.
5. Fixer ses prix et accepter des commandes de clients simulés.
6. Organiser les livraisons, supporter leurs coûts et encaisser les ventes.
7. Réinvestir et adapter sa stratégie selon les résultats, les événements et les décisions adverses.

## 6. Achat et approvisionnement — acquis (R4)

- **2 à 3 fournisseurs par matière première**, chacun situé dans une région, avec son **prix**, son **délai** (selon la distance avec l'acheteur) et sa **note éthique** (sociale et environnementale).
- Les **machines** s'achètent auprès de **fournisseurs d'équipement** selon les mêmes règles.
- **Stocks limités et partagés**, **réapprovisionnés à date fixe** (exemple : tous les 7 jours simulés jusqu'à un niveau défini). Les dates de réapprovisionnement sont visibles ; les achats des concurrents ne le sont pas.
- **Prix fixes**, modifiés uniquement par les événements.
- **Paiement à la commande**, stock **réservé immédiatement** (premier arrivé, premier servi), **sans annulation**. Les marchandises arrivent après le délai.

### Entrepôt — acquis (R9)

- Chaque entreprise démarre avec un **entrepôt de capacité limitée** (exemple : 500 unités toutes marchandises confondues).
- Entrepôt plein : livraisons fournisseurs et production **attendent**, sans perte.
- **Extension** payante avec délai de construction.
- Aucun coût de stockage par unité, aucune péremption.

## 7. Fabrication — acquis (R5)

- Une **machine** fabrique une **liste définie de produits compatibles**, **un produit à la fois**. « Deux produits » désigne deux références compatibles, non une quantité.
- Chaque produit a une **recette** (matières consommées), une **durée de cycle** et une **production par cycle**. Les matières sont consommées au **début du cycle** ; sans matières, la machine attend.
- **File de production** : l'équipe choisit un produit et un nombre de cycles.
- Chaque machine exige un **nombre minimal d'opérateurs** affectés (section 9).
- **Production = production par cycle × rendement machine × rendement des employés.**
- **Usure** : rendement initial de 100 %, en baisse à chaque jour simulé de fonctionnement (exemple : −1 % par jour), jusqu'à un plancher (exemple : 40 %). Aucune panne aléatoire ; les pannes viennent des événements.
- **Maintenance** payante : rendement ramené à environ 95 %, machine immobilisée quelques jours.
- Une machine peut être **vendue à une autre équipe** ou **mise au rebut** ; les fournisseurs ne la rachètent pas.

## 8. Vente et livraison

### Vente — acquis (R7)

- Chaque équipe fixe **son prix par produit et par région**.
- Chaque région génère chaque jour une **demande par produit** selon sa population, son pouvoir d'achat, la reprise économique (section 14) et les événements.
- Chaque région a un **prix maximal** par produit au-delà duquel personne n'achète.
- La demande est **répartie proportionnellement** entre les équipes selon leur **attractivité** : prix relatif au pouvoir d'achat, marketing, réputation et délai de livraison.
- La demande arrive sous forme de **commandes clients** (produit, quantité, région, échéance) dans une **boîte de réception**. L'équipe accepte, ce qui réserve le stock, ou laisse expirer (exemple : après 2 jours). Une **acceptation automatique** est possible par produit.
- **Paiement à la livraison.** Retard : remise et baisse de réputation. Échec : aucun paiement et forte baisse de réputation.

**Acquis (O2)** : une commande ne peut être acceptée que si les produits finis sont disponibles dans l'entrepôt ; l'acceptation les réserve. L'acceptation automatique suit la même règle.

### Livraison — acquis (R8)

| Option | Coût | Délai | Impact environnemental |
| --- | --- | --- | --- |
| Standard (route) | moyen | moyen | moyen |
| Express (avion) | élevé | court | mauvais |
| Verte (rail ou électrique) | moyen-élevé | long | bon |

- Une **matrice de coûts et de délais** relie les quatre régions ; les livraisons locales sont rapides et peu coûteuses ; Port-Libre bénéficie d'une réduction sur toutes les liaisons.
- Chaque **logisticien** prépare au plus N expéditions par jour ; au-delà, les expéditions attendent.
- **Pas de livraison partielle** ; les marchandises quittent l'entrepôt au départ de l'expédition.
- Un événement peut retarder une livraison ; les pénalités de retard s'appliquent.
- Les mêmes règles valent pour les échanges entre entreprises.

## 9. Ressources humaines — acquis (R6)

- **Deux métiers** : **opérateurs** (font tourner les machines) et **logisticiens** (préparent les expéditions).
- **Recrutement** dans le **bassin d'emploi de la région d'implantation**, limité et partagé par les équipes de la région. **Salaire de base régional.** Arrivée après un court délai (exemple : 2 jours).
- **Paie automatique tous les 30 jours simulés.**
- **Rendement** initial de 100 %. Sans augmentation pendant 60 jours, il baisse par paliers (exemple : −5 % tous les 10 jours, jusqu'à 50 %). Une **augmentation d'au moins 5 %** relance le délai et rétablit progressivement le rendement.
- Un salaire supérieur à la moyenne régionale améliore l'impact social ; un salaire minimal le dégrade.
- **Paie impossible** : grève (production nulle) jusqu'au paiement et baisse de l'impact social. **Acquis (N25)** : après 10 jours de grève, les employés impayés démissionnent ensemble ; les arriérés sont annulés, ils retournent au bassin d'emploi, l'entreprise subit une pénalité sociale de 15 et peut réembaucher.
- **Licenciement** possible contre une indemnité (exemple : un demi-mois de salaire) et une pénalité d'impact social. Aucune démission aléatoire.

## 10. Marketing — acquis (R10)

- **Cible** : une région ou toutes, et un produit ou toute la gamme.
- **Durée** : 7, 14 ou 30 jours simulés.
- **Coût** selon la population, la durée et l'étendue de la cible, **payé au lancement**.
- **Effet** : hausse de l'attractivité de l'équipe (exemple : +20 %) sur la cible. La campagne prend des parts de marché aux concurrents ; elle ne crée pas de demande supplémentaire.
- Les campagnes sur des cibles différentes se cumulent ; deux campagnes sur la même cible sont interdites.
- L'équipe consulte les commandes reçues par région et par produit dans le temps.
- Une hausse de la demande ne garantit pas une vente si l'entreprise ne peut pas répondre à la commande.

## 11. News et information — acquis (R11)

Le concept de **news remplace le forecasting**. Aucune news n'annonce explicitement qu'un produit va devenir très demandé.

- **Une à deux news par semaine simulée**, environ 100 sur la journée, rédigées à l'avance dans le scénario.
- **Diffusion commune** à toutes les équipes et sur l'écran projeté ; une news peut porter sur une région.
- Chaque événement est **annoncé indirectement 3 à 10 jours avant** par une ou deux news, puis annoncé lorsqu'il survient.
- Environ **un indice sur cinq est une fausse piste**.
- **Deux sources fictives** : un quotidien sérieux, fiable, et un tabloïd, plus sensationnaliste et plus souvent trompeur.
- Les fausses news des cartes secrètes paraissent dans le même fil, sous l'une de ces sources, sans distinction.
- Toutes les news passées restent consultables.

## 12. Événements et enchères — acquis (R12)

### Événements

- **Calendrier rédigé à l'avance et exécuté automatiquement**, d'environ **15 événements** (environ un tous les 30 jours simulés). Un seul scénario fixe en v1.
- Chaque événement a une **portée** (mondiale, régionale ou produit), un **début**, une **durée** ou un caractère permanent, des **effets sur des paramètres définis** et des **news associées**.
- **Types** : demande, approvisionnement (rupture, prix), scandale produit (substance toxique, demande à zéro), crise régionale, coûts (salaires, transport), jalons de reprise (ouverture de la demande des paliers 2 et 3), pannes ou accidents.
- Aucun déclenchement manuel par l'organisateur (Q4, P8).

### Enchères

- **Trois enchères** dans la partie, chacune pour un objet rare et utile (exemples : machine haut de gamme, brevet de rendement, licence).
- **Offres scellées** pendant une fenêtre de 3 jours simulés ; une seule offre par équipe, qu'elle peut augmenter. La plus haute offre gagne et paie son montant ; en cas d'égalité, l'offre la plus ancienne l'emporte.
- L'offre **bloque la trésorerie** jusqu'à la clôture et **engage** l'équipe. Les perdants sont remboursés.
- Le gagnant est annoncé dans les news et sur l'écran projeté ; le montant reste secret.

## 13. Marché noir, cartes secrètes et easter eggs

### Marché noir — acquis (R13)

- Un onglet accessible à toutes les équipes. Aucune élimination.
- **Achat** de certaines matières premières environ 35 % moins cher, sur un stock séparé et limité, avec un impact social et environnemental très mauvais.
- **Vente** de produits finis environ 30 % au-dessus du prix régional, avec un volume quotidien limité et un paiement immédiat, sans livraison ni effet de réputation.
- **Port-Libre** : accès élargi (stock et acheteurs) mais contrôles douaniers avec une faible probabilité de détection automatique.
- Chaque transaction laisse des **traces pendant 30 jours**.
- **Enquête** payante sur une autre équipe : probabilité de trouver une preuve croissante avec le volume de traces récentes ; résultat privé.
- **Accusation publique**, avec ou sans preuve :
  - équipe coupable : amende d'environ deux fois le gain illicite, baisse de réputation, pénalité d'impact social, exclusion du marché noir pendant 30 jours et news de scandale ;
  - équipe innocente : amende et baisse de réputation pour l'accusateur.

### Cartes secrètes — acquis (R14)

Chaque équipe reçoit au lancement une carte tirée au hasard dans un catalogue de six. Les cartes sont **à usage unique**, **secrètes** et d'**activation anonyme**.

| Carte | Effet |
| --- | --- |
| Fake news | Publie une news rédigée par l'équipe, sous la source choisie, sans effet économique direct. |
| Espionnage | Affiche une fois le tableau de bord complet d'un concurrent. |
| Sabotage | Arrête une machine d'un concurrent pendant 5 jours. |
| Priorité fournisseur | Donne un jour d'accès exclusif au prochain réapprovisionnement d'un fournisseur. |
| Paix sociale | Remet tous les employés à 100 % et gèle leur baisse pendant 60 jours. |
| Amnistie | Efface les traces de marché noir et annule une accusation visant l'équipe. |

L'équipe ciblée sait qu'elle a subi une carte, pas qui l'a jouée. L'organisateur peut supprimer une fausse news inappropriée.

### Easter eggs — acquis (R20)

| Easter egg | Déclencheur | Indice |
| --- | --- | --- |
| Code Konami | ↑↑↓↓←→←→BA dans l'application | Aucun |
| Logo ETIC | Dix clics sur le logo | News du tabloïd sur « les dix coups » |
| Acrostiche | Mot formé par les initiales d'une news du quotidien sérieux, saisi dans un champ caché | La news elle-même |
| Fournisseur secret | Fournisseur non listé, accessible par un code cité dans une news | News sur un « entrepôt fantôme » |

La première équipe qui découvre un secret reçoit un petit bonus unique (exemple : ₢2 000 ou un objet rare) ; les suivantes reçoivent un badge. L'écran projeté annonce anonymement la découverte.

## 14. Progression et spécialisation — acquis (R1, R2)

| Palier | Produits | Accès |
| --- | --- | --- |
| 1 — Essentiels | Pain, eau en bouteille, savon | Dès le départ |
| 2 — Courants | Vêtements, plats préparés, petit électroménager | Jalon de ventes du palier 1, puis projet de développement payant |
| 3 — Avancés | Branche Tech : ordinateurs portables ; branche Loisirs : consoles de jeu | Jalon de ventes du palier 2, puis projet de développement payant |

- Environ 8 à 10 matières premières (exemples : farine, eau, plastique, tissu, métal, composants électroniques).
- **Déblocage** : atteindre un **jalon de ventes** du palier précédent, puis payer un **projet de développement** dont le délai précède l'ouverture du palier.
- **Choix exclusif** : au moment d'investir dans le palier 3, l'équipe choisit définitivement Tech ou Loisirs ; l'autre branche lui est fermée.
- La **demande des paliers 2 et 3 apparaît progressivement** avec la reprise économique, portée par les événements et les news.

## 15. Décisions de cadrage

### Première série — réponses enregistrées

| ID | Sujet | Réponse et statut |
| --- | --- | --- |
| Q1 | Objectif pédagogique et profondeur | Validé : apprendre à réaliser ce type de projet, comprendre la gestion de l'entreprise et réfléchir en équipe. Une profondeur stratégique réelle est souhaitée, avec une réalisation de taille raisonnable. P1 précise que les nouveaux membres jouent sans développer. |
| Q2 | Format | Validé : journée en présentiel, approximativement 10 h–18 h, début et fin communs à toutes les équipes. |
| Q3 | Victoire | Argent détenu et impact social et environnemental. La valorisation des stocks et des équipements n'est pas retenue. Formule fixée en R18. |
| Q4 | Organisateurs | Événements prédéfinis et automatiques. Pouvoirs de l'organisateur fixés en P8. |
| Q5 | Périmètre de la première version | Toutes les mécaniques jouables dès cette version. |

### Deuxième et troisième séries — réponses enregistrées

| ID | Sujet | Réponse et statut |
| --- | --- | --- |
| Q6 | Classement | Un seul gagnant. |
| Q7 | Origine des impacts | Fournisseurs, produits, transports et conditions salariales, visibles dans des indicateurs. Mesure fixée en R17. |
| Q8 | Temps et pauses | Un jour simulé par minute réelle, temps commun, pause commune. |
| Q9 | Entreprise et membres | Une entreprise par équipe, plusieurs membres simultanés aux droits égaux. Effectifs fixés en P3. |
| Q10 | Clients et échanges | Clients simulés et échanges entre entreprises. Règles fixées en R15. |
| Q11 | Volume du contenu | Contenu limité, toutes les mécaniques conservées. |
| Q12 | Gagnant unique | Score combinant argent et impact, économie majoritaire. Formule fixée en R18. |
| Q13 | Échanges entre entreprises | Matières premières et produits à prix négociés, sans rachat d'entreprise. |

Les questions Q14 à Q18 proposées précédemment sont résolues par les séries suivantes : Q14 par R18, Q15 par R19, Q16 par R16, Q17 par R15 et Q18 par P1–P3.

### Quatrième série — réalisation, rôles et déroulement (6 novembre 2026)

| ID | Sujet | Réponse et statut |
| --- | --- | --- |
| P1 | Réalisation | Validé : le porteur du projet et l'assistant réalisent tout ; les nouveaux membres jouent. |
| P2 | Calendrier | Validé : aucun calendrier fixé ; priorité à une livraison rapide. |
| P3 | Effectifs | Validé : référence de 4 équipes de 4 membres ; nombre d'équipes configurable. |
| P4 | Supports | Validé : application web pour ordinateurs portables, dans le navigateur ; écran projeté pour l'horloge, les news et les événements. Le téléphone n'est pas une cible. |
| P5 | Hébergement | Validé : en ligne par défaut, avec un secours exécutable sur un ordinateur du réseau local en une commande. Reprise en pause depuis la dernière sauvegarde. |
| P6 | Connexion | Validé : Google ou e-mail et mot de passe ; l'organisateur est un compte désigné. |
| P7 | Équipes | Validé : code d'équipe saisi une fois ; une équipe par participant et par partie ; l'organisateur peut déplacer un participant. |
| P8 | Pouvoirs de l'organisateur | Validé : préparation de la partie et des codes, lancement, pause, reprise, clôture, vue d'ensemble en direct de toutes les entreprises et classement final. Pas de déclenchement manuel d'événements ni de correction de données. |
| P9 | Classement en cours de partie | Validé : classement en direct pour l'organisateur seulement ; invisible pour les équipes. |
| P10 | Écran projeté | Validé : horloge, news, événements et pause pendant la partie ; classement final uniquement à la fin. |
| P11 | Déconnexions | Validé : l'entreprise d'une équipe absente continue de fonctionner sans décision automatique ; journal d'activité. |
| P12 | Mode répétition | Validé : vitesse et durée réglables pour les parties de test. |

La proposition de reporter les règles ouvertes aux tickets de réalisation a été refusée : toutes les règles ont été définies avant la PRD.

### Cinquième série — règles du jeu (6 novembre 2026)

| ID | Sujet | Réponse et statut |
| --- | --- | --- |
| R1 | Produits et paliers | Validé : 3 paliers, 8 produits finis, branches exclusives Tech et Loisirs (section 14). |
| R2 | Déblocage | Validé : jalon de ventes puis projet de développement payant avec délai ; branche choisie à l'investissement ; demande progressive. |
| R3 | Régions | Validé : Azura, Nordhaven, Ferronia, Port-Libre ; vente dans toutes les régions ; régions partageables ; implantation définitive. |
| R4 | Fournisseurs | Validé : section 6. |
| R5 | Fabrication | Validé : section 7. |
| R6 | Ressources humaines | Validé : section 9. |
| R7 | Ventes et demande | Validé : section 8. |
| R8 | Livraison | Validé : section 8. |
| R9 | Entrepôt | Validé : section 6. |
| R10 | Marketing | Validé : section 10. |
| R11 | News | Validé : section 11. |
| R12 | Événements et enchères | Validé : section 12. |
| R13 | Marché noir | Validé : section 13. |
| R14 | Cartes secrètes | Validé : section 13. |
| R15 | Échanges entre entreprises | Validé : section 4. |
| R16 | Trésorerie, prêts et difficultés | Validé : section 16. |
| R17 | Impact | Validé : section 17. |
| R18 | Score | Validé : section 17. |
| R19 | Fin de partie | Validé : section 17. |
| R20 | Easter eggs | Validé : section 13. |
| R21 | Démarrage | Validé : section 5. |
| R22 | Apprentissage des règles | Validé : page « Guide » découpée par module, info-bulles sur les indicateurs clés et briefing de 15 minutes par l'organisateur. Pas de tutoriel interactif. Formules exactes, probabilités du marché noir et easter eggs non documentés. |
| R23 | Contenu et valeurs chiffrées | Validé : l'assistant rédige le contenu et les valeurs dans des données de jeu modifiables sans code, les teste par des parties simulées avec des bots ; le porteur relit le contenu ; l'équilibrage final suit une répétition avec de vraies personnes. |
| R24 | PRD | Validé : une PRD unique pour la v1, en français, publiée en ticket GitHub après approbation. |

### Sixième série — précisions issues de la rédaction de la PRD (6 novembre 2026)

| ID | Sujet | Réponse et statut |
| --- | --- | --- |
| O1 | Décisions pendant la pause | Validé : consultation seule ; toutes les décisions sont bloquées jusqu'à la reprise. |
| O2 | Commande sans stock | Validé : acceptation uniquement avec les produits finis disponibles dans l'entrepôt, y compris en acceptation automatique. |
| O3 | Mot de passe oublié | Validé : pas de réinitialisation par e-mail en v1 ; connexion Google ou nouveau compte avec le code d'équipe ; l'organisateur peut retirer l'ancien compte. |
| O4 | Taille des équipes | Validé : plafond fixé à la création de la partie, 4 par défaut, modifiable par l'organisateur. |

Aucune question de règle ne reste ouverte. La stack technique et l'organisation du dépôt seront décidées au début de la réalisation.

### Septième série — précisions de réalisation du backend (6 novembre 2026)

Décisions prises pendant la discussion de chaque issue (#2 à #23). Le détail figure dans le commentaire de clôture de chaque issue GitHub.

| ID | Sujet | Réponse et statut |
| --- | --- | --- |
| N5 | Pas de temps | Validé : 4 sous-étapes par jour simulé (toutes les 15 s en vitesse réelle) ; règles quotidiennes une fois par jour. |
| N6 | Rejoindre en cours de partie | Validé : possible pendant toute la partie, pauses comprises, dans la limite du plafond. |
| N7 | Catalogue | Validé : 9 matières, 8 produits et leurs recettes ; 2 à 3 fournisseurs par matière ; matrice de délais entre régions. |
| N8 | Ressources humaines | Validé : salaires et bassins régionaux, paie tous les 30 jours, grève, baisse sans augmentation, indemnités. |
| N9 | Production | Validé : opérateurs requis, file de cycles, matières au départ, usure 1 %/jour, maintenance à 10 % du prix. |
| N10 | Demande | Validé : prix de référence, population, pouvoir d'achat, reprise progressive, répartition par attractivité, commandes clients. |
| N11 | Livraison | Validé : options standard, express, verte ; capacité des logisticiens ; retard −20 % ; échec 5 jours après l'échéance. |
| N12 | Finance | Validé : grand livre, prêt plafonné à ₢30 000, intérêts de 3 % tous les 30 jours. |
| N13 | Progression | Validé : jalons de ventes et projets de développement ; seule la production est bloquée. |
| N14 | Marketing | Validé : coût selon population, étendue et durée ; +20 % d'attractivité sans cumul. |
| N15 | Scénario | Validé : 15 événements de 25 à 400 jours avec indices et fausses pistes. |
| N16 | Enchères | Validé : brevet, licence d'export, ligne dernière génération ; offres scellées et montant bloqué. |
| N17 | Marché noir | Validé : prix, plafonds, traces, enquêtes, accusations ; amende au-delà du disponible ajoutée à la dette. |
| N18 | Cartes | Validé : règles précises des six cartes ; espionnage invisible, sabotage signalé anonymement, amnistie préventive. |
| N19 | Échanges | Validé : offre du vendeur, séquestre, transport selon R8 sans file des logisticiens, transferts libres. |
| N20 | Impact | Validé : moyennes de sous-notes pondérées par les volumes ; pénalités sociales. |
| N21 | Révélation | Validé : pilotée par l'organisateur, de la dernière à la première équipe, puis détail. |
| N22 | Salle de contrôle | Validé : flux organisateur en temps réel. |
| N23 | Easter eggs | Validé : Konami, logo, acrostiche « TRÉSOR », code « ENTREPOT-404 ». |
| N24 | Équilibrage | Validé : 4 bots, 10 graines, 7 cibles mesurées automatiquement (`bun run sim`). |
| N25 | Grève sans fin | Validé : **modifie R6** — après 10 jours de grève, les employés impayés démissionnent ensemble ; arriérés annulés, pénalité sociale de 15, réembauche possible. |
| N26 | Fin de l'équilibrage par bots | Validé : arrêt à 5 cibles sur 7 ; les deux cibles manquées relèvent des limites des bots ; réglage final après la répétition (rapport dans `docs/balancing.md`). |

### Ajustements d'équilibrage (#23, R23)

Valeurs modifiées après les simulations par bots ; elles restent des données de jeu, à réajuster après la répétition :

- Entrepôt : 1 500 unités au départ, extension de +1 000 pour ₢10 000 (500 bloquaient la production de trois machines).
- Stocks des fournisseurs : niveaux hebdomadaires portés à environ 85 % du besoin de quatre entreprises à pleine production.
- Prix : matières premières −25 % ; prix de référence des paliers 1 et 2 +56 % au total (pain ₢31, eau ₢19, savon ₢29, vêtements ₢94, plats ₢54, bouilloire ₢187) ; prime des fournisseurs éthiques ramenée à environ +40 %.
- Azura : pouvoir d'achat 0,75 au lieu de 0,6.
- Palier 3 : jalon de 200 ventes du palier 2, projet à ₢25 000 ; lignes Tech et Loisirs à ₢22 000 et ₢20 000 ; demande du palier 3 de jour 150 à jour 300 (au lieu de 180 à 360) ; demande de base des ordinateurs portés à 6 et des consoles à 8.

## 16. Trésorerie, prêts et difficultés — acquis (R16)

- Monnaie fictive : le **crédit (₢)**.
- Chaque équipe démarre avec la **même trésorerie** (exemple : ₢50 000) et **rien d'autre** : ni machine, ni employé, un entrepôt de base vide.
- **Prêt bancaire** jusqu'à un plafond (exemple : ₢30 000) ; intérêts prélevés tous les 30 jours ; remboursement possible à tout moment ; la dette restante est déduite du score.
- Toute dépense volontaire est **refusée** si la trésorerie est insuffisante ; la trésorerie ne devient jamais négative.
- Les coûts automatiques impayés provoquent une **grève** (salaires) ou s'ajoutent à la dette (intérêts).
- **Aucune élimination** : une entreprise en difficulté continue de jouer, de vendre, d'emprunter dans la limite du plafond, d'échanger et de recevoir des transferts.

## 17. Impact, score et fin de partie

### Impact social et environnemental — acquis (R17)

- Deux indicateurs sur 100 : **environnemental** et **social**, à 50 au départ.
- Chacun est une **moyenne pondérée par les volumes** des décisions de l'équipe sur toute la partie : la taille de l'entreprise n'est pas pénalisée, la manière de produire l'est.
- Environnemental : note environnementale des fournisseurs, empreinte des produits (plus forte au palier 3), production à Ferronia, option de transport, achats au marché noir.
- Social : salaires par rapport à la moyenne régionale, jours de grève, licenciements, note sociale des fournisseurs, achats au marché noir, condamnations pour marché noir.
- Les indicateurs sont visibles en permanence avec le détail de leurs causes.

### Score final — acquis (R18)

- **Trésorerie nette** = trésorerie finale − dette restante.
- **Score économique** = 100 × trésorerie nette de l'équipe ÷ meilleure trésorerie nette ; 0 si la trésorerie nette est nulle ou négative.
- **Score d'impact** = (environnemental + social) ÷ 2.
- **Score final = 70 % économique + 30 % impact.** Un seul gagnant.
- Égalité : la meilleure trésorerie nette l'emporte, puis le meilleur impact.
- Révélation finale sur l'écran projeté : classement, puis détail par équipe.

### Fin de partie — acquis (R19)

L'organisateur fixe l'heure de fin ou clôture manuellement. L'écran projeté affiche un compte à rebours pendant les 30 derniers jours simulés. À la clôture, tout se fige :

| Engagement en cours | Traitement |
| --- | --- |
| Livraisons clients en route | Non payées |
| Commandes fournisseurs non reçues | Perdues |
| Contrats entre entreprises en transit | Annulés, paiement rendu à l'acheteur |
| Enchères non closes | Offres remboursées |
| Stocks, machines, production en cours | Valeur nulle |
| Dette restante | Déduite de la trésorerie nette |
| Salaires et intérêts depuis la dernière échéance | Non prélevés |

## 18. Périmètre de réalisation

La première version rend jouables toutes les mécaniques décrites ci-dessus, avec un volume de contenu limité (PRD, section Scope). Trois interfaces : participant, organisateur et écran projeté.

Démarche de réalisation validée : `write-a-prd` → `prd-to-issues` → `start-next-issue` → `start-implementation`. La PRD est publiée dans l'issue GitHub #1.

### Stack et organisation technique — acquis (6 novembre 2026)

| ID | Sujet | Décision |
| --- | --- | --- |
| S1 | Langage et architecture | TypeScript partout, monorepo : `engine` (règles pures), `server` (temps réel), `web` (React + Vite), avec TanStack Query et TanStack Router. |
| S2 | Communication | tRPC v11 et Zod, intégration officielle TanStack Query, envoi temps réel par abonnements SSE. |
| S3 | Données | PostgreSQL et Drizzle ; Postgres en conteneur Docker en développement et en secours. Parties en cours en mémoire, instantané à chaque jour simulé. |
| S4 | Authentification | Better Auth (Google, e-mail et mot de passe), adaptateur Drizzle ; organisateur désigné par e-mail dans la configuration. |
| S5 | Interface | Tailwind CSS v4, shadcn/ui, Recharts ; identité visuelle dans [`DESIGN.md`](DESIGN.md). |
| D1 | Couleurs fonctionnelles | Ajout de Pousse (vert) et Ocre (ambre), réservées aux variations, alertes et graphiques. |
| S6 | Déploiement | VPS Contabo d'un ami, Docker Compose (image applicative, Postgres, HTTPS) ; même Compose pour le secours local. URL indifférente, compatible avec la connexion Google. |
| S7 | Qualité | Tests unitaires et simulations par bots sur le moteur ; un test Playwright du parcours principal ; Biome ; TypeScript strict. |
| S8 | CI/CD | Aucune : vérifications lancées localement par une commande unique ; déploiement manuel à la fin. |
| S9 | Réseau | Un flux SSE par navigateur, aucun polling ; vue complète à la connexion puis deltas par équipe regroupés par tick ; flux public séparé pour l'écran projeté ; commandes tRPC groupées, validées et limitées en débit ; compression et cache des fichiers statiques. |
| S10 | Observabilité | Logs Pino JSON, journal des commandes dans Postgres (débogage, journal d'activité, débriefing), route `/health`, métriques serveur dans la vue organisateur ; aucun service externe. |
| S11 | Dépôt | Workspaces Bun : `apps/server`, `apps/web`, `packages/engine`, `packages/content` ; une seule image Docker ; code et commits en anglais, interface et documentation en français. |
| S12 | Exécution | Bun pour l'exécution, les tests (`bun test`) et les scripts ; Hono comme serveur HTTP ; pilote postgres.js. |
| S13 | Moteur | État unique sérialisable ; fonctions pures `applyCommand` et `tick` (un jour simulé) ; aléatoire déterministe à graine ; sauvegarde par instantané et journal de commandes ; rejeu possible ; commandes sérialisées par partie côté serveur. |
| S14 | Conventions front | TanStack Form et schémas Zod partagés ; pas de gestionnaire d'état global ; français sans bibliothèque d'internationalisation ; pas de `useEffect` pour les données ou l'état dérivé ; routes `/`, `/play/*`, `/admin/*`, `/screen/:gameId`. |

Aucune application n'est encore implémentée dans ce dépôt. Aucun équilibrage économique ni scénario de partie complet n'a encore été testé.
