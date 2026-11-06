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
bun run dev:server        # serveur sur http://localhost:3000 (rechargement à chaud)
curl localhost:3000/health
```

Les migrations de la base sont appliquées automatiquement au démarrage du serveur.

## Commandes

| Commande | Rôle |
| --- | --- |
| `bun run dev:server` | Lance le serveur en mode développement |
| `bun run db:up` / `bun run db:down` | Démarre ou arrête Postgres |
| `bun run db:generate` | Génère une migration SQL à partir du schéma Drizzle |
| `bun run db:migrate` | Applique les migrations sans lancer le serveur |
| `bun run check` | Typecheck strict, Biome et tests : à lancer avant chaque PR |
| `bun run format` | Formate et corrige automatiquement avec Biome |

## Structure

```
apps/server/       serveur Hono sur Bun : API, temps réel, authentification, exécution des parties
apps/web/          application React (configurée dans l'issue #24)
packages/engine/   règles du jeu, TypeScript pur sans entrées-sorties
packages/content/  données de jeu validées par Zod
```

## Skills inclus

Les skills de cadrage de Matt Pocock (`grill-me`, `grilling`, `grill-with-docs`, `domain-modeling`) sont dans [.agents/skills](.agents/skills). Origine, version et licence : [THIRD_PARTY.md](THIRD_PARTY.md).
