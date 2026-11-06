# PRD — ETIC Business Game v1

Statut : validée par le porteur du projet et publiée dans l’issue GitHub #1. Backend et interfaces implémentés ; déploiement #47 hors du périmètre de la démonstration locale.
Référence produit : [`product.md`](../product.md) (vision, règles acquises et historique des décisions P1–P12, R1–R24, O1–O4).

## Problem Statement

Le club ETIC veut accueillir ses nouveaux membres avec une grande journée de jeu en présentiel (environ 10 h–18 h). Aucun outil existant ne permet à quatre équipes de diriger chacune une entreprise dans **un même monde économique**, en temps réel, avec des ressources rares partagées, des concurrents qui réagissent et des événements qui bousculent les plans.

Sans cet outil, les nouveaux membres ne vivent pas concrètement les arbitrages d'une entreprise : acheter ou attendre, produire ou entretenir, payer ses employés ou investir, tricher ou rester propre, coopérer ou trahir. L'organisateur, de son côté, n'a aucun moyen d'animer et de suivre une telle journée.

## Goals

- Faire comprendre par la pratique les interactions entre les fonctions d'une entreprise : achats, production, ressources humaines, ventes, livraison, marketing, finance et impact.
- Obliger les équipes à décider ensemble, sous contrainte de temps, de rareté et d'incertitude.
- Proposer une profondeur stratégique réelle : trajectoires divergentes, choix exclusifs, alliances et trahisons.
- Désigner un seul gagnant par un score combinant résultat économique (majoritaire) et impact social et environnemental.
- Offrir à l'organisateur une journée simple à piloter : un scénario automatique, une pause commune et une vue d'ensemble.
- Livrer vite : toutes les mécaniques présentes, avec un volume de contenu limité.

## Solution

Une application web, utilisée dans le navigateur des ordinateurs portables des participants, sans installation.

L'organisateur crée une partie, ouvre un lobby et distribue un code par équipe. Les participants se connectent (Google ou e-mail et mot de passe), rejoignent leur équipe avec le code, nomment leur entreprise et choisissent une région d'implantation. Au lancement, chaque équipe reçoit ₢50 000 et une carte secrète tirée au hasard ; l'horloge commune démarre à un jour simulé par minute réelle.

Pendant la journée, chaque équipe achète des matières premières et des machines auprès de fournisseurs aux stocks partagés, recrute et paie ses employés, fabrique, fixe ses prix par région, accepte les commandes de clients simulés et les livre. Elle lance des campagnes marketing, lit des news qui donnent des indices sur l'évolution du monde, subit ou exploite des événements, enchérit sur des objets rares, peut recourir au marché noir à ses risques, utilise sa carte secrète, négocie en personne avec les autres équipes et formalise ses échanges dans la plateforme. Elle débloque progressivement des produits plus évolués jusqu'à une spécialisation exclusive (Tech ou Loisirs).

Deux indicateurs, environnemental et social, montrent en permanence les conséquences de ses choix. Un écran projeté dans la salle affiche l'horloge, les news, les événements et, à la fin, le classement. L'organisateur suit toutes les entreprises et le classement en direct, met le jeu en pause pour tous et clôture la partie.

## User Stories

Acteurs : **participant** (membre d'une équipe, mêmes droits que ses coéquipiers), **organisateur**, **salle** (personnes qui regardent l'écran projeté, sans connexion).

### Connexion et équipes

1. En tant que participant, je veux me connecter avec mon compte Google, afin d'entrer dans le jeu sans créer de mot de passe.
2. En tant que participant sans compte Google, je veux créer un compte avec mon e-mail et un mot de passe, afin de participer quand même.
3. En tant que participant, je veux rejoindre mon équipe en saisissant son code une seule fois, afin d'être rattaché à la bonne entreprise.
4. En tant que participant, je veux un message « équipe complète » lorsque le plafond de membres est atteint, afin de comprendre pourquoi le code est refusé.
5. En tant que participant, je veux un message clair si le code saisi est invalide, afin de corriger mon erreur.
6. En tant que participant, je veux retrouver automatiquement mon équipe après un rechargement ou sur un autre ordinateur, afin de reprendre sans aide.
7. En tant que participant, je veux voir les prénoms des membres de mon équipe, afin de savoir qui décide avec moi.
8. En tant qu'organisateur, je veux être reconnu comme organisateur par mon compte, afin d'accéder aux fonctions d'animation sans système séparé.
9. En tant qu'organisateur, je veux déplacer un participant d'une équipe à une autre ou le retirer d'une équipe, afin de corriger une erreur d'affectation ou de supprimer un compte abandonné.
10. En tant que participant ayant oublié mon mot de passe, je veux me connecter avec Google ou créer un nouveau compte et rejoindre mon équipe avec son code, afin de reprendre sans réinitialisation par e-mail.
11. En tant que participant, je ne veux appartenir qu'à une seule équipe par partie, afin que les rôles restent clairs.

### Préparation et lobby

12. En tant qu'organisateur, je veux créer une partie en choisissant le nombre d'équipes, leurs noms et le nombre maximal de membres par équipe (4 par défaut, modifiable ensuite), afin de préparer la journée.
13. En tant qu'organisateur, je veux obtenir un code par équipe, afin de le distribuer aux participants.
14. En tant qu'organisateur, je veux créer une partie de test avec une vitesse d'horloge et une durée différentes, afin de répéter et d'équilibrer le jeu sans attendre huit heures.
15. En tant que participant, je veux donner un nom à mon entreprise dans le lobby, afin de l'identifier.
16. En tant que participant, je veux voir les quatre régions avec leurs avantages et leurs risques, afin de choisir mon implantation en connaissance de cause.
17. En tant que participant, je veux voir les régions choisies par les autres équipes et pouvoir changer mon choix jusqu'au lancement, afin de décider d'éviter ou d'affronter un concurrent.
18. En tant qu'organisateur, je veux voir quelles équipes sont prêtes (nom et région choisis), afin de lancer au bon moment.
19. En tant qu'organisateur, je veux lancer la partie, afin que l'horloge démarre, que chaque équipe reçoive ₢50 000 et sa carte secrète, et que la première news paraisse.

### Horloge, pause et fin

20. En tant que participant, je veux voir en permanence la date simulée et le temps restant, afin de planifier mes décisions.
21. En tant qu'organisateur, je veux mettre toute la simulation en pause et la reprendre, afin de gérer le déjeuner ou un imprévu.
22. En tant que participant, je veux voir clairement que le jeu est en pause et pouvoir consulter mes données, toutes les décisions étant bloquées jusqu'à la reprise, afin que la pause reste équitable.
23. En tant qu'organisateur, je veux fixer l'heure de fin ou clôturer manuellement la partie, afin de respecter le programme de la journée.
24. En tant que participant, je veux voir un compte à rebours pendant les 30 derniers jours simulés, afin de préparer la liquidation de mon entreprise.

### Achats et fournisseurs

25. En tant que participant, je veux consulter les fournisseurs de chaque matière première avec leur prix, délai, note éthique, stock disponible et date de prochain réapprovisionnement, afin de choisir où acheter.
26. En tant que participant, je veux commander une quantité auprès d'un fournisseur, afin d'alimenter ma production.
27. En tant que participant, je veux que ma commande soit payée et le stock réservé immédiatement, afin d'être sûr de l'obtenir face aux autres équipes.
28. En tant que participant, je veux un refus explicite si le stock du fournisseur est épuisé ou si ma trésorerie est insuffisante, afin d'adapter ma décision.
29. En tant que participant, je veux suivre mes commandes en cours et leur date d'arrivée, afin d'organiser la production.
30. En tant que participant, je veux acheter des machines auprès de fournisseurs d'équipement, afin de pouvoir fabriquer.
31. En tant que participant, je veux savoir qu'une commande passée ne peut pas être annulée, afin de mesurer mon engagement.

### Entrepôt

32. En tant que participant, je veux voir l'occupation de mon entrepôt, afin d'anticiper la saturation.
33. En tant que participant, je veux que les livraisons et la production attendent lorsque l'entrepôt est plein, sans perte, afin de comprendre la contrainte.
34. En tant que participant, je veux financer une extension d'entrepôt avec un délai de construction, afin d'augmenter ma capacité.

### Production et machines

35. En tant que participant, je veux voir pour chaque machine les produits compatibles, sa durée de cycle, sa production par cycle et son rendement actuel, afin de planifier.
36. En tant que participant, je veux affecter des opérateurs à une machine, afin qu'elle puisse fonctionner.
37. En tant que participant, je veux programmer une file de cycles pour un produit sur une machine, afin qu'elle tourne sans intervention constante.
38. En tant que participant, je veux voir qu'une machine attend faute de matières, d'opérateurs ou de place, afin de lever le blocage.
39. En tant que participant, je veux connaître la quantité produite selon le rendement de la machine et celui de mes employés, afin de comprendre ma productivité.
40. En tant que participant, je veux voir le rendement baisser à chaque jour de fonctionnement, afin d'anticiper l'usure.
41. En tant que participant, je veux lancer une maintenance payante qui immobilise la machine quelques jours et lui rend environ 95 % de rendement, afin d'arbitrer entre production immédiate et efficacité.
42. En tant que participant, je veux mettre une machine au rebut ou la vendre à une autre équipe, afin de me séparer d'un équipement inutile.

### Ressources humaines

43. En tant que participant, je veux recruter des opérateurs et des logisticiens dans le bassin d'emploi de ma région, afin de faire tourner production et livraisons.
44. En tant que participant, je veux connaître le salaire de base régional et le délai d'arrivée d'un recrutement, afin d'évaluer son coût.
45. En tant que participant, je veux savoir quand le bassin d'emploi est épuisé, afin de comprendre pourquoi je ne peux plus recruter.
46. En tant que participant, je veux que les salaires soient versés automatiquement tous les 30 jours simulés, afin de ne pas gérer chaque paie.
47. En tant que participant, je veux voir le rendement de chaque employé et depuis combien de temps il n'a pas été augmenté, afin de décider des augmentations.
48. En tant que participant, je veux accorder une augmentation d'au moins 5 %, afin de rétablir progressivement le rendement et de relancer le délai de 60 jours.
49. En tant que participant, je veux être prévenu que mes employés feront grève si la paie ne peut pas être versée, afin de protéger ma trésorerie.
50. En tant que participant, je veux licencier un employé contre une indemnité, afin de réduire mes coûts en connaissant l'impact social.

### Progression et spécialisation

51. En tant que participant, je veux voir les trois paliers de produits, le jalon de ventes et le coût du projet de développement de chacun, afin de planifier ma progression.
52. En tant que participant, je veux financer le projet de développement du palier suivant une fois le jalon atteint, afin de débloquer de nouveaux produits après le délai prévu.
53. En tant que participant, je veux choisir définitivement la branche Tech ou Loisirs au moment d'investir dans le palier 3, afin d'assumer ma spécialisation.
54. En tant que participant, je veux comprendre que la demande des produits avancés apparaît progressivement avec la reprise économique, afin de ne pas investir trop tôt sans clients.

### Ventes et demande

55. En tant que participant, je veux fixer un prix de vente par produit et par région, afin d'adapter mon offre au pouvoir d'achat local.
56. En tant que participant, je veux recevoir les commandes des clients simulés dans une boîte de réception (produit, quantité, région, échéance), afin de choisir lesquelles honorer.
57. En tant que participant, je veux accepter une commande lorsque les produits sont disponibles dans mon entrepôt, ce qui les réserve, afin de m'engager à la livrer.
58. En tant que participant, je veux être empêché d'accepter une commande sans stock disponible, afin de ne pas m'engager sur une production incertaine.
59. En tant que participant, je veux laisser expirer une commande que je ne peux pas honorer, afin d'éviter une pénalité.
60. En tant que participant, je veux activer l'acceptation automatique par produit, afin de ne pas cliquer toute la journée.
61. En tant que participant, je veux être payé à la livraison, afin de comprendre le décalage entre vente et encaissement.
62. En tant que participant, je veux subir une remise et une baisse de réputation en cas de retard, et ne pas être payé en cas d'échec, afin de mesurer le coût d'un engagement non tenu.
63. En tant que participant, je veux voir les commandes reçues par région et par produit dans le temps, afin d'évaluer ma position et l'effet de mes décisions.
64. En tant que participant, je veux ne recevoir aucune demande au-delà du prix maximal d'une région, afin de comprendre la limite du pouvoir d'achat.

### Livraison

65. En tant que participant, je veux choisir pour chaque expédition l'option standard, express ou verte avec son coût, son délai et son impact, afin d'arbitrer.
66. En tant que participant, je veux connaître le coût et le délai entre ma région et chaque région de destination, afin d'évaluer la rentabilité d'une vente lointaine.
67. En tant que participant, je veux voir la file des expéditions en attente de préparation, afin de savoir si je manque de logisticiens.
68. En tant que participant, je veux suivre mes livraisons en cours et être informé d'un retard causé par un événement, afin de réagir.

### Marketing

69. En tant que participant, je veux lancer une campagne en choisissant une région ou toutes les régions, un produit ou toute la gamme, et une durée de 7, 14 ou 30 jours, afin de gagner des parts de marché.
70. En tant que participant, je veux connaître le coût d'une campagne avant de la lancer, afin de décider.
71. En tant que participant, je veux être empêché de lancer une seconde campagne sur une cible déjà couverte, afin de ne pas payer pour rien.
72. En tant que participant, je veux voir mes campagnes actives et leur date de fin, afin de planifier la suite.

### News

73. En tant que participant, je veux lire un fil de news régulier avec sa source (quotidien sérieux ou tabloïd) et sa région éventuelle, afin d'anticiper l'évolution du monde.
74. En tant que participant, je veux consulter les news passées, afin de relier les indices entre eux.
75. En tant que salle, je veux voir les news s'afficher sur l'écran projeté, afin de partager l'ambiance de la journée.

### Événements et enchères

76. En tant que participant, je veux subir les effets d'événements annoncés par les news (demande, approvisionnement, scandale, crise régionale, coûts, reprise, panne), afin de devoir m'adapter.
77. En tant que participant, je veux être informé de l'ouverture d'une enchère, de l'objet proposé et de sa date de clôture, afin de décider si je participe.
78. En tant que participant, je veux déposer une offre scellée et l'augmenter tant que l'enchère est ouverte, afin de tenter de remporter l'objet.
79. En tant que participant, je veux que le montant de mon offre soit réservé et me soit rendu si je perds, afin de comprendre mon engagement.
80. En tant que participant gagnant, je veux recevoir l'objet et payer mon offre, afin d'en profiter.
81. En tant que salle, je veux voir le nom de l'équipe gagnante d'une enchère sans le montant, afin de suivre la compétition.

### Marché noir

82. En tant que participant, je veux acheter certaines matières premières moins cher au marché noir, dans la limite de son stock, afin de réduire mes coûts en acceptant le risque.
83. En tant que participant, je veux vendre des produits plus cher au marché noir avec paiement immédiat, dans la limite d'un volume quotidien, afin d'augmenter mes revenus.
84. En tant que participant implanté à Port-Libre, je veux un accès plus large au marché noir, en sachant que les contrôles douaniers peuvent me démasquer, afin d'exploiter l'avantage de ma région.
85. En tant que participant, je veux financer une enquête sur une autre équipe et recevoir un résultat privé, afin de vérifier mes soupçons.
86. En tant que participant, je veux accuser publiquement une équipe, avec ou sans preuve, afin de la faire sanctionner.
87. En tant qu'équipe accusée à raison, je veux connaître la sanction reçue (amende, réputation, impact social, exclusion du marché noir pendant 30 jours), afin d'en mesurer les conséquences.
88. En tant qu'équipe accusatrice, je veux savoir qu'une accusation infondée me coûtera une amende et de la réputation, afin de ne pas accuser à la légère.
89. En tant que salle, je veux voir les scandales confirmés apparaître dans les news, afin de suivre les affaires.

### Cartes secrètes

90. En tant que participant, je veux voir la carte secrète de mon équipe et son effet, afin de choisir le bon moment pour l'utiliser.
91. En tant que participant, je veux rédiger une fausse news et choisir sa source, afin d'induire les autres équipes en erreur.
92. En tant que participant, je veux espionner le tableau de bord complet d'un concurrent une fois, afin de mieux le connaître.
93. En tant que participant, je veux saboter une machine d'un concurrent pendant cinq jours, afin de le ralentir.
94. En tant que participant, je veux un jour d'accès exclusif au prochain réapprovisionnement d'un fournisseur, afin de sécuriser une ressource rare.
95. En tant que participant, je veux remettre tous mes employés à 100 % et geler leur baisse pendant 60 jours, afin d'économiser sur les augmentations.
96. En tant que participant, je veux effacer mes traces de marché noir et annuler une accusation, afin de me protéger.
97. En tant qu'équipe ciblée, je veux savoir que j'ai subi une carte sans savoir qui l'a jouée, afin que la méfiance fasse partie du jeu.
98. En tant qu'organisateur, je veux supprimer une fausse news inappropriée, afin de garder un cadre respectueux.

### Échanges entre entreprises

99. En tant que participant, je veux proposer à une autre équipe des marchandises ou une machine à un prix négocié, avec une option de transport et la prise en charge du transport, afin de formaliser un accord conclu en personne.
100. En tant que participant, je veux accepter ou refuser une offre reçue, afin de décider de l'échange.
101. En tant que participant, je veux retirer une offre tant qu'elle n'est pas acceptée, afin de changer d'avis.
102. En tant que participant, je veux que le paiement soit bloqué à l'acceptation et versé au vendeur à l'arrivée des marchandises, afin qu'aucune partie ne puisse tricher sur un contrat.
103. En tant que participant, je veux envoyer de l'argent ou des marchandises à une autre équipe sans contrepartie, afin de donner, prêter ou avancer un paiement selon un accord de confiance.
104. En tant que participant, je veux que mes échanges restent privés entre les équipes concernées et l'organisateur, afin de garder mes alliances secrètes.

### Finance

105. En tant que participant, je veux voir ma trésorerie, ma dette et mes dépenses et recettes récentes, afin de piloter mon entreprise.
106. En tant que participant, je veux emprunter jusqu'à un plafond, afin de financer ma croissance.
107. En tant que participant, je veux connaître les intérêts prélevés tous les 30 jours et rembourser à tout moment, afin de maîtriser ma dette.
108. En tant que participant, je veux qu'une dépense volontaire soit refusée si ma trésorerie est insuffisante, afin de ne jamais passer en négatif.
109. En tant que participant en difficulté, je veux continuer à jouer, vendre, emprunter et recevoir de l'aide, afin de pouvoir me redresser jusqu'à la fin.

### Impact social et environnemental

110. En tant que participant, je veux voir mes indicateurs environnemental et social sur 100, afin de connaître mon impact.
111. En tant que participant, je veux comprendre ce qui dégrade ou améliore chaque indicateur (fournisseurs, produits, région, transport, salaires, grèves, licenciements, marché noir), afin d'ajuster mes choix.
112. En tant que participant, je veux voir la note éthique d'un fournisseur et l'impact d'une option de transport avant de décider, afin de choisir en connaissance de cause.

### Score, fin de partie et classement

113. En tant que participant, je veux connaître la règle du score final (70 % économie relative à la meilleure équipe, 30 % impact), afin d'orienter ma stratégie.
114. En tant que participant, je veux savoir comment sont traités les engagements en cours à la clôture, afin de préparer la fin.
115. En tant que participant, je ne veux pas voir le classement pendant la partie, afin de préserver le suspense.
116. En tant qu'organisateur, je veux suivre le classement en direct, afin d'animer la journée.
117. En tant que salle, je veux découvrir le classement final puis le détail par équipe sur l'écran projeté, afin de vivre la révélation ensemble.
118. En tant que participant, je veux voir le détail de mon score final, afin de comprendre mon résultat.

### Journal d'activité

119. En tant que participant, je veux un journal de ce qui arrive à mon entreprise (ventes, livraisons, paies, événements, actions de mes coéquipiers avec leur prénom), afin de rester synchronisé avec mon équipe.
120. En tant que participant revenant après une déconnexion, je veux voir ce qui s'est passé pendant mon absence, afin de reprendre rapidement.

### Easter eggs

121. En tant que participant curieux, je veux découvrir des secrets cachés dans la plateforme, afin de m'amuser et d'être récompensé.
122. En tant que première équipe à trouver un secret, je veux recevoir un petit bonus, et les suivantes un badge, afin que la découverte compte sans décider du gagnant.
123. En tant que salle, je veux voir annoncer anonymement qu'une équipe a découvert un secret, afin d'éveiller la curiosité de tous.

### Guide

124. En tant que participant, je veux un guide découpé par module, afin d'apprendre les règles au fil de la partie.
125. En tant que participant, je veux des info-bulles sur les indicateurs clés, afin de comprendre ce que je lis.

### Organisateur

126. En tant qu'organisateur, je veux une vue d'ensemble en direct de chaque entreprise (trésorerie, impact, stocks, machines, employés, activité de marché noir), afin de suivre la journée et d'expliquer les résultats au débriefing.
127. En tant qu'organisateur, je veux que les événements et les news se déroulent automatiquement selon le scénario, afin de ne pas devoir les piloter.

### Écran projeté

128. En tant que salle, je veux voir l'horloge, les news, les événements, l'état de pause et le compte à rebours final, afin de partager le rythme de la journée.
129. En tant qu'organisateur, je veux ouvrir l'écran projeté sans connexion, afin de l'afficher rapidement sur n'importe quel ordinateur relié au projecteur.
130. En tant qu'organisateur, je veux que l'écran projeté n'affiche jamais le classement avant la fin, afin de respecter le secret.

### Pannes et déconnexions

131. En tant qu'équipe entièrement déconnectée, je veux que mon entreprise continue de fonctionner sans décision automatique, afin que l'horloge commune reste juste pour tous.
132. En tant qu'organisateur, je veux reprendre une partie en pause depuis la dernière sauvegarde après une panne du serveur, afin de perdre au plus environ un jour simulé.
133. En tant qu'organisateur, je veux lancer le jeu sur un ordinateur du réseau local en une commande si l'internet de la salle est défaillant, afin que la journée ait lieu.
134. En tant que participant, je veux que deux membres de mon équipe agissant en même temps ne provoquent pas d'incohérence, afin de décider à plusieurs sans risque.

## Scope

La v1 rend jouables toutes les mécaniques décrites dans `product.md`, avec un volume de contenu limité :

- 4 régions fictives : Azura, Nordhaven, Ferronia, Port-Libre.
- 3 paliers et 8 produits finis : pain, eau en bouteille, savon ; vêtements, plats préparés, petit électroménager ; ordinateurs portables (branche Tech) ou consoles de jeu (branche Loisirs).
- Environ 8 à 10 matières premières, 2 à 3 fournisseurs par matière et des fournisseurs d'équipement.
- 2 métiers : opérateurs et logisticiens.
- 3 options de transport.
- Environ 15 événements, environ 100 news, 3 enchères, 6 cartes secrètes et 4 easter eggs.
- Une partie de référence de 4 équipes de 4 participants ; le nombre d'équipes reste configurable.
- Trois interfaces : participant, organisateur et écran projeté.

Le contenu et toutes les valeurs chiffrées sont rédigés par l'assistant, testés par des parties simulées avec des bots, relus par le porteur du projet, puis ajustés après une répétition avec de vraies personnes.

## Constraints

- Jeu en présentiel sur une journée, environ 10 h–18 h, début et fin communs.
- Un jour simulé par minute réelle pour la partie réelle. Une vitesse différente n'est permise que pour les parties de test.
- Temps unique et commun : il n'attend jamais une équipe ; la pause concerne toute la simulation.
- Ordinateurs portables dans le navigateur, sans installation. Le téléphone n'est pas une cible de conception.
- Interface en français.
- Un seul gagnant ; classement invisible pour les équipes pendant la partie.
- Aucune élimination.
- Les news donnent des indices, jamais d'annonce explicite.
- Les fausses news n'ont aucun effet économique direct.
- Les régions sont fictives et ne décrivent aucun pays réel.
- Réalisation par le porteur du projet et l'assistant uniquement ; priorité à une livraison rapide, sans calendrier fixé.
- Budget d'hébergement faible (environ 0 à 10 € pour le mois).

## Engineering Notes

- Le serveur fait autorité : il fait avancer l'horloge et résout tous les achats, la rareté, la production, la demande, les livraisons et les événements. Les navigateurs envoient des décisions et reçoivent les mises à jour en temps réel.
- Les actions simultanées sur une même ressource sont résolues dans l'ordre d'arrivée au serveur.
- La partie doit supporter au moins 16 participants connectés en même temps, un organisateur et un écran projeté, sans dégradation perceptible.
- Hébergement en ligne par défaut, avec un mode de secours exécutable sur un ordinateur du réseau local en une commande.
- L'état de la partie est sauvegardé régulièrement ; une reprise après panne perd au plus environ un jour simulé et redémarre en pause.
- Le contenu et les paramètres (catalogue, prix, délais, usure, demande, salaires, événements, news, cartes, pondérations du score) sont des données de jeu modifiables sans toucher au code.
- Le moteur de simulation doit pouvoir jouer des parties accélérées avec des bots pour l'équilibrage.
- Dépendance externe : la connexion Google nécessite internet. En mode de secours sans internet, seule la connexion par e-mail et mot de passe reste utilisable.

## Out of Scope

- Application mobile et interface conçue pour téléphone.
- Messagerie ou outil de négociation dans la plateforme : la négociation se fait en personne.
- Objet « alliance » formel.
- Rachat d'entreprises.
- Déclenchement manuel d'événements et correction des données d'une équipe par l'organisateur.
- Affichage du classement en cours de partie sur l'écran projeté ou pour les équipes.
- Tutoriel interactif.
- Valorisation des stocks et des équipements dans le score.
- Réinitialisation du mot de passe par e-mail.
- Coût de stockage par unité et péremption des produits.
- Démissions aléatoires d'employés.
- Pannes aléatoires de machines hors événements.
- Annulation des commandes fournisseurs.
- Livraisons partielles.
- Déménagement de l'entreprise dans une autre région.
- Plusieurs scénarios : un seul scénario fixe en v1.
- Prix fournisseurs dynamiques selon l'offre et la demande.

## Open Questions

Aucune question de règle ne reste ouverte : les précisions O1–O4 sont intégrées aux user stories et consignées dans `product.md`. La stack technique et l'organisation du dépôt sont définies dans `product.md` §18.

## Further Notes

- Toutes les décisions de cette PRD sont consignées comme acquises dans `product.md` (séries P1–P12, R1–R24 et O1–O4).
- La stack et l’organisation du dépôt sont définies dans `product.md` §18 ; l’hébergement cible est un VPS Contabo.
- Démarche convenue : `write-a-prd` → `prd-to-issues` → `start-next-issue` → `start-implementation`. Premier objectif recommandé : une tranche verticale jouable (connexion, équipe, lobby, horloge, achat, production, vente, pause), puis une mécanique par ticket.
- Une répétition complète en mode accéléré avec de vraies personnes précède la journée réelle.
