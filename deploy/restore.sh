#!/usr/bin/env bash
# Restores a dump into the stack's database (replaces all data).
# Usage: ./deploy/restore.sh deploy/backups/daily-2026-11-20.dump
set -euo pipefail

dump=$(cd "$(dirname "${1:?usage: restore.sh <fichier.dump>}")" && pwd)/$(basename "$1")
cd "$(dirname "$0")"
[[ -s "$dump" ]] || { echo "Fichier introuvable ou vide : $dump" >&2; exit 1; }

read -r -p "Remplacer TOUTES les données par $(basename "$dump") ? Taper oui : " answer
[[ "$answer" == "oui" ]] || { echo "Annulé."; exit 1; }

docker compose up -d db
docker compose stop app
until docker compose exec -T db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null; do sleep 1; done
docker compose exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --single-transaction' <"$dump"
docker compose up -d
echo "Restauration terminée. Les parties sont rechargées au démarrage du serveur."
