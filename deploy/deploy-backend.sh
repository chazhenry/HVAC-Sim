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

REMOTE_ENV=""
if [ -f backend/.env ]; then
    echo "  uploading API keys (backend/.env)"
    REMOTE_ENV="/tmp/hvac-sim-env.$$"
    ssh "${SSH_OPTS[@]}" "$TARGET" "umask 077; cat > '$REMOTE_ENV'" < <(sed 's/\r$//' backend/.env)
else
    echo "  no backend/.env - the chat tutor will be disabled on the server"
fi

echo "  installing"
ssh "${SSH_OPTS[@]}" "$TARGET" \
    "sudo bash /tmp/hvac-sim-install.sh '$APP_PORT' '$API_DOMAIN' '$SITE_ORIGINS' /tmp/hvac-sim-bundle.tgz '$SERVICE_NAME' '$REMOTE_ENV'; rc=\$?; rm -f /tmp/hvac-sim-install.sh; exit \$rc"

# First Principles videos: mirror docs/1stPrinciples into /var/lib/<name>/videos, outside the release
# folders so they survive each deploy. Only new or changed files (by name and size) are uploaded;
# videos removed locally are removed from the server.
VIDEO_SRC="docs/1stPrinciples"
VIDEO_DEST="/var/lib/${SERVICE_NAME}/videos"
if [ -d "$VIDEO_SRC" ]; then
    echo "  syncing videos -> ${VIDEO_DEST}"
    REMOTE_LIST="$(ssh "${SSH_OPTS[@]}" "$TARGET" \
        "sudo mkdir -p '$VIDEO_DEST' && sudo chmod 755 '$VIDEO_DEST' && sudo find '$VIDEO_DEST' -maxdepth 1 -type f -printf '%s %f\n'")"
    declare -A LOCAL_SIZE=()
    uploaded=0
    for path in "$VIDEO_SRC"/*; do
        [ -f "$path" ] || continue
        name="$(basename "$path")"
        case "$name" in
            .*|*\'*) echo "    skipped (unsupported name): $name"; continue ;;
        esac
        # Only the video types the API serves (backend/app/videos.py); README etc. stay local.
        case "${name,,}" in
            *.mp4|*.m4v|*.webm|*.mov|*.ogv) ;;
            *) continue ;;
        esac
        size="$(wc -c < "$path" | tr -d ' ')"
        LOCAL_SIZE["$name"]="$size"
        if ! grep -qxF "$size $name" <<< "$REMOTE_LIST"; then
            echo "    uploading $name ($((size / 1000000)) MB)"
            scp -q "${SSH_OPTS[@]}" "$path" "${TARGET}:/tmp/hvac-sim-video.$$"
            ssh "${SSH_OPTS[@]}" "$TARGET" \
                "sudo install -m 644 -o root -g '$SERVICE_NAME' /tmp/hvac-sim-video.$$ '$VIDEO_DEST/$name'; rc=\$?; rm -f /tmp/hvac-sim-video.$$; exit \$rc"
            uploaded=$((uploaded + 1))
        fi
    done
    removed=0
    while IFS= read -r line; do
        [ -n "$line" ] || continue
        name="${line#* }"
        if [ -z "${LOCAL_SIZE[$name]+set}" ] && [[ "$name" != *\'* ]]; then
            echo "    removing $name (no longer in $VIDEO_SRC)"
            ssh "${SSH_OPTS[@]}" "$TARGET" "sudo rm -f '$VIDEO_DEST/$name'"
            removed=$((removed + 1))
        fi
    done <<< "$REMOTE_LIST"
    echo "  videos: ${#LOCAL_SIZE[@]} in $VIDEO_SRC, $uploaded uploaded, $removed removed"
else
    echo "  no $VIDEO_SRC folder - First Principles videos not synced"
fi

echo ""
echo "Backend deployed. Checking https://${API_DOMAIN}/api/health ..."
if curl -fsS --max-time 10 "https://${API_DOMAIN}/api/health" >/dev/null 2>&1; then
    echo "  OK - the API answers over HTTPS."
else
    echo "  Not reachable over HTTPS yet. First time? Make ${API_DOMAIN} public - see"
    echo "  'Making the API public' in deploy/README.md (Cloudflare Tunnel or DNS + certbot)."
fi
