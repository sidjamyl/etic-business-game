# Équilibrage — simulations par bots (#23)

Commande : `bun run sim [parties] [jours]` (par défaut 10 parties de 420 jours). Les cibles ont été validées en N24.

Statut : **5 cibles sur 7 atteintes**. Le porteur du projet a choisi d'arrêter l'équilibrage par bots à ce stade (N26) ; le réglage final se fera après la répétition avec de vrais joueurs (R23).

## Rapport d'équilibrage — 10 parties de 420 jours

| Bot | Rang moyen | Trésorerie nette moy. | Score moy. | Env. | Social | Palier 2 | Palier 3 | Victoires |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cautious | 1.0 | 236 037 | 85.2 | 45 | 57 | 29 | — | 10 |
| aggressive | 3.4 | -18 461 | 10.3 | 52 | 13 | 27 | 151 | 0 |
| smuggler | 3.6 | -10 452 | 9.2 | 52 | 0 | 31 | 160 | 0 |
| responsible | 2.0 | 48 370 | 37.5 | 79 | 65 | 92 | 380 | 0 |

### Cibles

- ❌ **1. Aucun bot compétent en trésorerie nette négative à la fin** — minimum final : -30 722
- ❌ **2. Aucune stratégie > 70 % des victoires ; Responsable ≥ 1 victoire** — cautious 10
- ✅ **3. Palier 2 vers les jours 40–80, palier 3 vers les jours 150–230** — palier 2 moyen : 45, palier 3 moyen : 178
- ✅ **4. Trésorerie nette du gagnant entre ₢150 000 et ₢600 000** — de 198 246 à 281 562
- ✅ **5. Impact : Responsable > 65, Contrebande < 30** — responsable 72, contrebande 26
- ✅ **6. Les événements font bouger la demande (savon, eau)** — savon 300 → 0 / jour, eau 599 → 958 / jour
- ✅ **7. Invariants respectés sur toutes les parties** — aucune violation

## Lecture

- **Économie** : une entreprise qui produit sans interruption gagne entre ₢190 000 et ₢290 000 sur la journée (cible 4). L'économie est rentable à condition de garder les machines en activité : matières disponibles, place libre dans l'entrepôt, opérateurs payés.
- **Paliers** : palier 2 vers le jour 45, palier 3 vers le jour 180 (cible 3).
- **Impact** : la stratégie responsable dépasse 65, la contrebande reste sous 30 (cible 5).
- **Événements** : le scandale du savon vide la demande, la canicule l'augmente de 60 % (cible 6).
- **Invariants** : aucune violation (trésorerie jamais négative, grand livre cohérent, réservations couvertes).

## Cibles non atteintes et pourquoi

- **Cible 1** (aucun bot compétent en trésorerie nette négative) et **cible 2** (aucune stratégie au-delà de 70 % des victoires) échouent pour une raison commune : les bots « expansion » (Agressive, Contrebande, Responsable) n'anticipent pas leurs investissements. Par exemple, l'Agressive débloque le palier 3 mais ne peut jamais acheter sa ligne de production, faute d'arbitrer entre une enchère et la machine. La stratégie régulière (Prudente) gagne donc systématiquement.
- Ce sont des limites des bots, pas du contenu. Les échanges de régions montrent que la stratégie régulière gagne aussi à Nordhaven et à Port-Libre ; seule Azura était trop faible (corrigée).

## Pièges observés, utiles pour le briefing des joueurs

1. **Entrepôt saturé de matières** : la production termine son cycle mais ne peut pas déposer ses produits.
2. **Expansion trop tôt** : acheter les machines du palier 2 avant que leur demande n'existe double les salaires pour zéro vente.
3. **Spirale de grève** : sans trésorerie pour la paie, la production s'arrête, donc les ventes aussi. Depuis N25, une démission collective après 10 jours permet de repartir.
4. **Express systématique** : il divise la marge par deux ; à réserver aux commandes urgentes.
5. **Une matière rare bloque toute une ligne** : surveiller la couverture de chaque matière, pas seulement les plus consommées.

## Ajustements effectués

Voir `product.md`, section « Ajustements d'équilibrage (#23, R23) ».
