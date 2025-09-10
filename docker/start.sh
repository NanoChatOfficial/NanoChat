#!/usr/bin/env bash
set -euo pipefail

TORRC=/etc/tor/torrc
HOSTFILE=/var/lib/tor/hidden_service/hostname
TIMEOUT=300
CHECK_INTERVAL=1
VITE_PORT=4173
FRONTEND_DIR=/app/frontend
FRONTEND_ENV_FILE="$FRONTEND_DIR/.env.local"

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

export TOR_ONION="$ONION"
export __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS="$ONION"

cat > "$FRONTEND_ENV_FILE" <<EOF
VITE_WS_BASE=ws://$ONION:8000
VITE_ONION_URL=http://$ONION:8000
EOF

( cd "$FRONTEND_DIR" && pnpm build >/dev/null 2>&1 )

( cd "$FRONTEND_DIR" && pnpm run preview -- --host 0.0.0.0 --port "$VITE_PORT" ) &

export DJANGO_SETTINGS_MODULE=backend.settings

python manage.py makemigrations || true
python manage.py migrate --noinput

daphne backend.asgi:application --port 8000 --bind 0.0.0.0 &

wait
