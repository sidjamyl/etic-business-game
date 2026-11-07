#!/usr/bin/env bash
# Manual deployment (S8): refuses while a game is in progress, dumps the database,
# rebuilds the image and restarts the stack. Run from anywhere: ./deploy/deploy.sh
# FORCE=1 skips the game-in-progress check (emergency fix only).
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "deploy/.env manquant : cp deploy/.env.example deploy/.env puis remplir les valeurs." >&2
  exit 1
fi

compose() { docker compose "$@"; }
psql_db() { compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -v ON_ERROR_STOP=1'; }

# The database is started first so the check and the dump always run.
compose up -d --wait db

# 1. No deployment during a game (running or paused).
if [[ "$(echo "select to_regclass('public.game') is not null;" | psql_db)" == "t" ]]; then
  active=$(echo "select string_agg(name || ' (' || status || ')', ', ') from game where status in ('running', 'paused');" | psql_db)
  if [[ -n "$active" ]]; then
    if [[ "${FORCE:-}" == "1" ]]; then
      echo "ATTENTION : partie en cours ($active), déploiement forcé."
    else
      echo "Partie en cours : $active." >&2
      echo "Terminer la partie avant de déployer (ou FORCE=1 en cas d'urgence)." >&2
      exit 1
    fi
  fi
fi

# 2. Build first: the running app keeps serving while the image builds.
compose build app

# 3. Pre-deploy dump, 7 kept.
mkdir -p backups
dump="backups/predeploy-$(date +%Y%m%d-%H%M%S).dump"
compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' >"$dump"
if [[ ! -s "$dump" ]]; then
  echo "Sauvegarde vide : déploiement interrompu ($dump)." >&2
  exit 1
fi
echo "Sauvegarde : deploy/$dump"
ls -1t backups/predeploy-*.dump | tail -n +8 | xargs -r rm -f --

# 4. Restart (migrations run at server start-up) and wait for /health. Compose does not
# always notice a rebuilt image, so app and backup are recreated explicitly; db and
# caddy keep running.
compose up -d --remove-orphans --force-recreate app backup
compose up -d --remove-orphans
echo -n "Démarrage"
for _ in $(seq 1 60); do
  if compose exec -T app bun -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))" 2>/dev/null; then
    echo " : OK"
    compose ps
    exit 0
  fi
  echo -n "."
  sleep 2
done
echo
echo "Le serveur ne répond pas sur /health. Journaux : docker compose -f deploy/compose.yml logs app" >&2
exit 1
