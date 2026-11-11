#!/bin/bash
###############################################################################
# Deploy the HVAC-Sim API to the server named in deploy/deploy.env.
#
#   bash deploy/deploy-backend.sh
#
# Safe to run again for every update. See deploy/README.md for the one-time
# DNS and certificate steps.
###############################################################################
set -euo pipefail

cd "$(dirname "$0")/.."
ENV_FILE="deploy/deploy.env"
[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE - copy deploy/deploy.env.example and fill it in."; exit 1; }
set -a
# shellcheck disable=SC1090
source <(sed 's/\r$//' "$ENV_FILE")
set +a

SERVICE_NAME="${SERVICE_NAME:-hvac-sim}"
for name in DEPLOY_HOST DEPLOY_USER DEPLOY_KEY API_DOMAIN APP_PORT SITE_ORIGINS; do
    [ -n "${!name:-}" ] || { echo "$name is empty in $ENV_FILE"; exit 1; }
done
[ -f "$DEPLOY_KEY" ] || { echo "SSH key not found at $DEPLOY_KEY"; exit 1; }
case "$API_DOMAIN" in *example.com) echo "Set API_DOMAIN in $ENV_FILE to a real hostname."; exit 1 ;; esac

TARGET="${DEPLOY_USER}@${DEPLOY_HOST}"
SSH_OPTS=(-i "$DEPLOY_KEY" -o StrictHostKeyChecking=accept-new)
BUNDLE="$(mktemp -t hvac-sim-XXXXXX.tgz)"
trap 'rm -f "$BUNDLE"' EXIT

echo "Deploying HVAC-Sim API -> ${TARGET} as service ${SERVICE_NAME} (${API_DOMAIN}, port ${APP_PORT})"

echo "  running backend tests"
if [ -x backend/.venv/Scripts/python.exe ]; then PY="$PWD/backend/.venv/Scripts/python.exe"
elif [ -x backend/.venv/bin/python ]; then PY="$PWD/backend/.venv/bin/python"
else PY=python; fi
(cd backend && "$PY" -m pytest -q)

echo "  packing"
tar -czf "$BUNDLE" --exclude=__pycache__ \
    -C backend app requirements.txt \
    -C ../deploy hvac-sim.service nginx-hvac-sim.conf

echo "  uploading"
scp -q "${SSH_OPTS[@]}" "$BUNDLE" "${TARGET}:/tmp/hvac-sim-bundle.tgz"
scp -q "${SSH_OPTS[@]}" deploy/remote-install.sh "${TARGET}:/tmp/hvac-sim-install.sh"

echo "  installing"
ssh "${SSH_OPTS[@]}" "$TARGET" \
    "sudo bash /tmp/hvac-sim-install.sh '$APP_PORT' '$API_DOMAIN' '$SITE_ORIGINS' /tmp/hvac-sim-bundle.tgz '$SERVICE_NAME'; rc=\$?; rm -f /tmp/hvac-sim-install.sh; exit \$rc"

echo ""
echo "Backend deployed. Checking https://${API_DOMAIN}/api/health ..."
if curl -fsS --max-time 10 "https://${API_DOMAIN}/api/health" >/dev/null 2>&1; then
    echo "  OK - the API answers over HTTPS."
else
    echo "  Not reachable over HTTPS yet. First time? Make ${API_DOMAIN} public - see"
    echo "  'Making the API public' in deploy/README.md (Cloudflare Tunnel or DNS + certbot)."
fi
