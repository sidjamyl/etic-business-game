# DESIGN — Identité visuelle de Business Game

Source : charte graphique fournie par le porteur du projet, conservée dans [`docs/brand/charte-graphique.png`](docs/brand/charte-graphique.png).

Ce document décrit l'identité visuelle et la manière de l'appliquer aux trois interfaces du jeu : participant, organisateur et écran projeté (PRD, issue #1). Il distingue ce qui vient de la charte (**charte**) et ce qui est une proposition d'application à valider (**proposition**).

## 1. Esprit

**Charte** : un mélange assumé de jeu vidéo et de monde de l'entreprise, avec un ton décontracté et complice (« Le logo (so peak) », « Let us cook »). Aplats francs, contrastes forts, titres massifs.

**Proposition** : dans l'application, l'esprit se traduit par des titres affirmés, des aplats de couleur par zone et quelques clins d'œil dans les textes (états vides, confirmations, easter eggs), tandis que les écrans de gestion restent sobres et lisibles. Le jeu est dense en données : la lisibilité prime sur la décoration.

## 2. Logo

**Charte** : une manette, ses boutons, un câble et une cravate intégrés dans le **B** de Business.

| Version | Usage | Rendu |
| --- | --- | --- |
| Principale | Sur fond clair | Logo **Night** sur fond **Milk** |
| Inversée | Sur fond rouge | Logo **Milk** sur fond **Power red** |

Une version horizontale réduite (pictogramme + « BUSINESS GAME » en capitales) sert de signature, par exemple en pied de page.

**Proposition** :
- Barre de navigation : version horizontale réduite.
- Écran projeté : logo inversé en grand pendant le lobby et la révélation finale.
- Favicon : pictogramme seul.
- Zone de protection : au moins la largeur d'un bouton de la manette autour du logo ; ne jamais déformer, recolorer hors des deux versions ni ajouter d'effet.

## 3. Couleurs

### Palette officielle — charte

| # | Nom | Hex | Intention |
| --- | --- | --- | --- |
| 01 | **Cacao** | `#3A1D10` | Ancrage et sophistication |
| 02 | **Power red** | `#C62A2A` | Action et énergie |
| 03 | **Cloud** | `#BCBCBC` | Équilibre et structure |
| 04 | **Night** | `#23282A` | Contraste et lisibilité |
| 05 | **Milk** | `#F5F5EF` | Respiration et clarté |

### Rôles dans l'application — proposition

| Rôle | Couleur |
| --- | --- |
| Fond principal de l'application participant | Milk |
| Texte principal | Night |
| Action principale (boutons, lien actif, élément sélectionné) | Power red, texte Milk |
| Surfaces secondaires, séparateurs, états désactivés | Cloud |
| Navigation latérale, en-têtes de tableaux denses, interface organisateur | Night, texte Milk |
| Moments forts : enchères, révélation, scandales, fond de l'écran projeté | Cacao ou Power red |

### Contrastes vérifiés

| Texte sur fond | Rapport | Usage autorisé |
| --- | --- | --- |
| Night sur Milk | ≈ 13 : 1 | Tout texte |
| Milk sur Night | ≈ 13,6 : 1 | Tout texte |
| Milk sur Cacao | ≈ 14 : 1 | Tout texte |
| Night sur Cloud | ≈ 7,9 : 1 | Tout texte |
| Power red sur Milk | ≈ 5,1 : 1 | Texte et liens |
| Milk sur Power red | ≈ 5,1 : 1 | Texte des boutons et bandeaux |
| Power red sur Night ou Cacao | ≈ 2,7 : 1 | **Décoratif uniquement** (numéros de section, grands chiffres d'ornement), jamais pour une information |
| Power red sur Cloud | ≈ 2,9 : 1 | À éviter |

### Couleurs fonctionnelles — validées (D1)

La charte ne prévoit pas de couleur de réussite ni d'avertissement. Le porteur du projet a validé l'ajout de deux couleurs fonctionnelles sourdes, accordées à Cacao et Milk, **réservées aux variations, aux alertes et aux graphiques**. Elles ne servent jamais aux boutons, aux fonds de section ni à l'identité.

| Nom | Rôle | Thème clair (sur Milk) | Thème sombre (sur Night) |
| --- | --- | --- | --- |
| **Pousse** | Gain, réussite, indicateur favorable | `#2F7D4F` (≈ 4,6 : 1) | `#6FBF8A` (≈ 6,7 : 1) |
| **Ocre** | Avertissement, attention requise | `#9A5B12` (≈ 4,9 : 1) | `#E0A64A` (≈ 6,9 : 1) |

Règles :
- Les **pertes** et les erreurs utilisent Power red, toujours avec le signe − ou une icône, pour ne pas être confondues avec un bouton d'action.
- Une information n'est **jamais portée par la couleur seule** : signe (+ / −) ou icône obligatoire.
- Les valeurs hexadécimales sont un premier réglage ; elles pourront être ajustées à l'écran sans descendre sous 4,5 : 1 pour du texte.

## 4. Typographie

**Charte** :

| Usage | Police | Graisses |
| --- | --- | --- |
| Titres et logo | **Popping Cute** | Display, Bold |
| Texte courant | **Coolvetica** | Regular, Medium |

Signatures typographiques de la charte :
- Grands titres en **capitales**, très serrés, parfois en deux tons (Milk puis Cacao sur fond Power red).
- **Surtitres** minuscules en capitales espacées (« LET US COOK », « PALETTE OFFICIELLE »).
- **Numéros de section** en Power red (« 01 », « 02 », « 03 ») accompagnés d'une étiquette en petites capitales.

**Proposition** :
- Les données chiffrées (trésorerie, prix, stocks, horloge) utilisent des **chiffres à chasse fixe** pour éviter que les colonnes et l'horloge ne sautent.
- Échelle indicative : surtitre 11–12 px, texte 14–16 px, titre de page 28–36 px, titres de l'écran projeté 64 px et plus.
- Polices de secours en attendant les fichiers : une sans-serif géométrique arrondie pour les titres, puis `system-ui`.

## 5. Formes et effets

**Charte** :
- **Cartes** à coins arrondis (environ 12 px), à plat.
- **Ombre tramée** : une ombre en motif de points, décalée vers le bas à droite, qui donne un relief « imprimé » ou « pixel ».
- **Boutons ronds** blancs avec une flèche, pour une action unique.
- **Grille éditoriale** : une colonne étroite à gauche pour le numéro de section, séparée du contenu par un filet vertical fin.
- **Fond Cacao en dégradé** avec un reflet diagonal, réservé aux sections spectaculaires.
- **Aplats pleine largeur** qui changent de couleur à chaque section.

**Proposition** :
- L'ombre tramée signale les éléments **importants ou interactifs mis en avant** : carte secrète, offre d'enchère, offre d'échange reçue, confirmation de décision engageante. Elle n'est pas appliquée à toutes les cartes, pour garder sa force.
- Le dégradé Cacao est réservé à l'écran projeté (révélation finale, enchères, scandales).
- La grille à colonne numérotée structure la page « Guide » et l'écran de fin de partie.

## 6. Application aux interfaces — proposition

### Participant

- Fond Milk, navigation latérale Night avec le logo réduit, les modules (Achats, Production, RH, Ventes, Livraisons, Marketing, News, Marché noir, Échanges, Finance, Impact, Guide) et l'horloge toujours visible en haut.
- Tableaux sobres : en-têtes Night ou Cloud, lignes Milk, valeurs numériques alignées à droite.
- Actions engageantes (commande, prêt, enchère, accusation) : bouton Power red et confirmation avec ombre tramée.
- Pause : bandeau pleine largeur Power red « Jeu en pause », décisions désactivées.
- Marché noir : seul module en thème sombre (fond Night ou Cacao) pour marquer le changement d'univers.

### Organisateur

- Thème sombre Night pour distinguer immédiatement l'interface d'animation de celle d'un participant.
- Commandes de partie (lancer, pause, reprendre, clôturer) en Power red, regroupées et toujours visibles.

### Écran projeté

- Lisible à plusieurs mètres : fond Power red ou Cacao, textes Milk, horloge et titres en Popping Cute en très grande taille.
- Les news défilent en cartes Milk avec la source en surtitre.
- Les annonces fortes (événement, scandale, enchère remportée, secret découvert, compte à rebours final, classement) prennent tout l'écran avec un aplat de couleur.

## 7. Jetons de design — proposition

Correspondance prévue avec les variables de thème de shadcn/ui (Tailwind CSS v4) :

| Jeton | Thème clair | Thème sombre |
| --- | --- | --- |
| `background` | Milk | Night |
| `foreground` | Night | Milk |
| `primary` | Power red | Power red |
| `primary-foreground` | Milk | Milk |
| `secondary` / `muted` | Cloud | Cacao |
| `border` | Cloud | Cacao |
| `accent` | Cacao | Power red |
| `destructive` | Power red | Power red |
| `success` (ajouté) | Pousse `#2F7D4F` | Pousse `#6FBF8A` |
| `warning` (ajouté) | Ocre `#9A5B12` | Ocre `#E0A64A` |
| `radius` | 12 px | 12 px |

## 8. Ressources à fournir

- Logo en **SVG** : versions principale, inversée et horizontale réduite.
- Fichiers des polices **Popping Cute** et **Coolvetica** (formats web WOFF2) et vérification que leurs licences autorisent l'intégration dans une application web.
- Slogan : la charte affiche « small slogan » comme texte provisoire ; le slogan définitif reste à fournir.
