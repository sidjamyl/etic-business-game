#!/bin/sh
# Runs inside the `backup` service (postgres image). Checks every hour whether today's
# dump exists, so a restart never skips a day nor creates duplicates.
set -eu

mkdir -p /backups
while true; do
  today=$(date +%F)
  target="/backups/daily-$today.dump"
  if [ ! -s "$target" ]; then
    if pg_dump -Fc -f "$target.tmp"; then
      mv "$target.tmp" "$target"
      echo "backup: wrote $target"
      # Keep the most recent $BACKUP_KEEP daily dumps.
      ls -1t /backups/daily-*.dump 2>/dev/null | tail -n +"$((BACKUP_KEEP + 1))" | while read -r old; do
        rm -f -- "$old"
        echo "backup: removed $old"
      done
    else
      rm -f "$target.tmp"
      echo "backup: pg_dump failed, retrying in one hour" >&2
    fi
  fi
  sleep 3600
done
