# Démonstration locale

## Lancer

Depuis la racine du dépôt, avec Bun installé et Docker démarré :

```sh
bun install
# Seulement si .env n'existe pas encore : cp .env.example .env
bun run db:up
bun run demo
```

Ouvrir [l'application](http://localhost:5173). La commande prépare quatre entreprises avec le vrai moteur jusqu'au jour 131, enregistre la partie **en pause**, puis démarre le serveur et Vite (ou réutilise Vite s'il tourne déjà sur 5173). Garder ce terminal ouvert pendant la présentation. Les ports 3000 et 5173 sont ceux de la démo.

Les stocks, machines, salariés, ventes, grand livre, news, indicateurs et enchères viennent d'une simulation déterministe. Les cartes restent en main pour pouvoir montrer leur activation. Deux offres d'échange sont préparées entre les premières entreprises. Le jour simulé dure 10 secondes après la reprise ; la clôture automatique est prévue après le jour 161. L'organisateur peut clôturer plus tôt.

## Comptes de démonstration

Ces comptes sont fictifs et réservés à la base de développement locale. Mot de passe commun par défaut : `DemoETIC2026!`.

| Rôle | E-mail | Entreprise |
| --- | --- | --- |
| Organisateur | `demo.organisateur@etic.local` | Toutes les entreprises |
| Équipe 1 | `demo.equipe1@etic.local` | Les Fourneaux — Ferronia |
| Équipe 2 | `demo.equipe2@etic.local` | Azura Industries — Azura |
| Équipe 3 | `demo.equipe3@etic.local` | Port & Compagnie — Port-Libre |
| Équipe 4 | `demo.equipe4@etic.local` | Nord Éthique — Nordhaven |

`DEMO_PASSWORD` permet de choisir un autre mot de passe à la première création. Les relances vérifient le mot de passe des comptes existants ; elles ne le réinitialisent pas. Le rôle organisateur de démonstration est ajouté à l'environnement du processus de démo, sans modifier `.env`.

Pour montrer simultanément organisateur et participant, utiliser deux navigateurs ou une fenêtre normale et une fenêtre privée. Deux onglets du même profil partagent la connexion. Le projecteur est public et peut être ouvert dans n'importe lequel.

## Déroulé conseillé — cinq à dix minutes

1. **Organisateur** : ouvrir la partie « Démo ETIC — quatre trajectoires », puis « Écran de la salle » sur le projecteur. Garder la partie en pause pendant l'introduction.
2. **Participant, équipe 1** : montrer le tableau de bord, les fournisseurs et l'entrepôt, les machines et leurs opérateurs, puis les prix, commandes et livraisons. Les valeurs sont déjà remplies. La pause bloque les décisions et laisse la consultation disponible.
3. **Organisateur** : cliquer sur **Reprendre**. L'horloge et les news évoluent sur les écrans connectés. Une enchère est déjà ouverte ; montrer son montant réservé dans Finance. Repasser en pause si l'explication doit durer.
4. **Participant** : dans Échanges, accepter l'offre reçue pour voir le transport et le séquestre. Montrer Marketing, Progression, Impact et la carte secrète. Sur l'équipe 3, le Marché noir comporte déjà un historique et des sanctions.
5. **Guide** : rechercher une règle, puis revenir au jeu. Les info-bulles donnent le sens des indicateurs.
6. **Organisateur** : cliquer sur **Clôturer** et confirmer. Sur le projecteur, le classement reste caché jusqu'à la révélation. Révéler les places de la quatrième à la première, puis **Afficher le détail des scores**.

Pour une démonstration de la création d'une partie et du lobby, utiliser « Parties » → « Nouvelle partie ». Les comptes des entreprises de la démo sont déjà dans une partie active ; utiliser de nouveaux comptes pour rejoindre un autre lobby avant sa clôture.

## Repartir du début

Arrêter le processus de démo avec `Ctrl+C`, puis relancer `bun run demo`. Une nouvelle partie est préparée au jour 131. Les anciennes parties créées par le compte organisateur de démo sont clôturées et conservées ; les autres comptes et parties ne sont pas modifiés. Le terminal affiche le nouveau lien du projecteur.

Cette commande refuse le mode production et les bases dont l'hôte n'est pas local.

## Vérifications de livraison

- `bun --env-file=.env run check` : TypeScript strict, Biome et 675 tests réussis, y compris authentification, persistance PostgreSQL et parcours HTTP connexion → équipe → achat → production → vente → livraison.
- `bun run build` : application de production construite.
- Navigation des modules participants vérifiée dans le navigateur intégré, sans Playwright ni extension Chrome.
- Connexion organisateur, salle de contrôle, pause/reprise, clôture, révélation des quatre places et détail des scores vérifiés dans le navigateur.
- Logo et polices officiels à remplacer lorsqu'ils seront fournis ; la démo utilise les ressources de secours prévues dans `DESIGN.md`.
- Connexion Google non essayée avec de vraies clés ; e-mail/mot de passe disponible pour la démo.
- Équilibrage final à confirmer après une répétition humaine (`docs/balancing.md`).

Le déploiement, HTTPS et le mode de secours réseau restent dans l'issue #47 et ne font pas partie de cette livraison locale.
