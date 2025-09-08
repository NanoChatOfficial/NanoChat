#!/usr/bin/env bash
set -euo pipefail

TORRC=/etc/tor/torrc
HOSTFILE=/var/lib/tor/hidden_service/hostname
TIMEOUT=300
CHECK_INTERVAL=1
VITE_PORT=4173

tor -f "$TORRC" >/dev/null 2>&1 &

i=0
ONION=""
while [ $i -lt $TIMEOUT ]; do
  if [ -s "$HOSTFILE" ]; then
    ONION=$(cat "$HOSTFILE")
    printf '%s\n' "NanoChat onion service available at: $ONION"
    break
  fi
  sleep "$CHECK_INTERVAL"
  i=$((i + CHECK_INTERVAL))
done

if [ -z "$ONION" ]; then
  echo "ERROR: Tor hostname not found after ${TIMEOUT}s" >&2
  exit 1
fi

export __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS="$ONION"
export TOR_ONION="$ONION"

FRONTEND_ENV_FILE="/app/frontend/.env.local"
echo "VITE_ONION_URL=http://$ONION:8000" > "$FRONTEND_ENV_FILE"

( cd /app/frontend && pnpm build >/dev/null 2>&1 ) 

( cd /app/frontend && pnpm run preview -- --host 0.0.0.0 --port "$VITE_PORT" >/dev/null 2>&1 ) &

exec python3 manage.py runserver 0.0.0.0:8000 >/dev/null 2>&1
