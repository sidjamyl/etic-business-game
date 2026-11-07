# ETIC Business Game

Business game du mini-projet d'intégration du club ETIC : quatre équipes dirigent chacune une entreprise dans un même monde économique, en temps réel, pendant une journée.

## Documents

- [product.md](product.md) : vision, règles du jeu et décisions (Q, P, R, O, S).
- [docs/prd-v1.md](docs/prd-v1.md) : PRD de la v1, publiée dans l'issue GitHub #1 et découpée en issues #2 à #47.
- [DESIGN.md](DESIGN.md) : identité visuelle et application aux interfaces.
- [AGENTS.md](AGENTS.md) : conventions pour les agents et la réalisation.

## Prérequis

- [Bun](https://bun.com) 1.4 ou plus récent
- Docker (pour Postgres)

## Démarrer en développement

```sh
bun install
cp .env.example .env      # valeurs par défaut adaptées au Postgres local
bun run db:up             # Postgres 17 dans Docker, exposé sur le port 5433
bun run dev               # serveur (port 3000) et application web (port 5173)
```

Ouvrir http://localhost:5173. Le serveur Vite transmet `/api` au serveur sur le port 3000. Les migrations de la base sont appliquées automatiquement au démarrage du serveur.

Pour organiser une partie, ajouter son adresse e-mail à `ORGANIZER_EMAILS` dans `.env` puis relancer le serveur : le rôle est recalculé à chaque requête, il n'est pas nécessaire de recréer le compte.

| Écran | Adresse |
| --- | --- |
| Accueil et connexion | `/` |
| Rejoindre une équipe avec un code | `/join` |
| Jeu des participants | `/play` |
| Parties et salle de contrôle de l'organisateur | `/admin` |
| Écran projeté (sans connexion) | `/screen/<identifiant de la partie>` |

Pour une répétition, l'organisateur peut créer une partie accélérée (durée d'un jour simulé et nombre de jours réglables).

## Commandes

Pour une présentation avec quatre entreprises déjà actives : `bun run db:up`, puis `bun run demo`. Comptes, mot de passe et déroulé dans [le guide de démonstration](docs/demo.md).

| Commande | Rôle |
| --- | --- |
| `bun run dev` | Lance le serveur et l'application web en mode développement |
| `bun run dev:server` / `bun run dev:web` | Lance l'un des deux seulement |
| `bun run build` | Construit l'application web dans `apps/web/dist`, servie par le serveur en production |
| `bun run demo` | Prépare quatre entreprises au jour 131 et démarre la démonstration locale, en pause |
| `bun run sim` | Simule des parties entre bots et affiche le rapport d'équilibrage ([docs/balancing.md](docs/balancing.md)) |
| `bun run db:up` / `bun run db:down` | Démarre ou arrête Postgres |
| `bun run db:generate` | Génère une migration SQL à partir du schéma Drizzle |
| `bun run db:migrate` | Applique les migrations sans lancer le serveur |
| `bun run check` | Typecheck strict, Biome et tests : à lancer avant chaque PR |
| `bun run format` | Formate et corrige automatiquement avec Biome |

## Déploiement

Image Docker unique, Postgres, HTTPS par Caddy et sauvegardes quotidiennes, avec `deploy/compose.yml` ; déploiement manuel par `./deploy/deploy.sh`, refusé pendant une partie. Guide du VPS et du mode de secours sur le réseau local : [docs/deploy.md](docs/deploy.md).

## Structure

```
apps/server/       serveur Hono sur Bun : API, temps réel, authentification, exécution des parties
apps/web/          application React : écrans des participants, de l'organisateur et du projecteur
packages/engine/   règles du jeu, TypeScript pur sans entrées-sorties
packages/content/  données de jeu validées par Zod
```

## Skills inclus

Les skills de cadrage de Matt Pocock (`grill-me`, `grilling`, `grill-with-docs`, `domain-modeling`) sont dans [.agents/skills](.agents/skills). Origine, version et licence : [THIRD_PARTY.md](THIRD_PARTY.md).
