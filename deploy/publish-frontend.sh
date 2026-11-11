#!/bin/bash
###############################################################################
# Build the HVAC-Sim frontend for the website and copy it into the website
# repo's public/ folder, so the website's own deploy publishes it.
#
#   bash deploy/publish-frontend.sh
#
# It only writes inside <HOMEPAGE_REPO>/public/<SITE_PATH>. It does not commit,
# push or deploy the website - do that from the website repo afterwards.
###############################################################################
set -euo pipefail

cd "$(dirname "$0")/.."
ENV_FILE="deploy/deploy.env"
[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE - copy deploy/deploy.env.example and fill it in."; exit 1; }
set -a
# shellcheck disable=SC1090
source <(sed 's/\r$//' "$ENV_FILE")
set +a

for name in API_DOMAIN SITE_PATH HOMEPAGE_REPO; do
    [ -n "${!name:-}" ] || { echo "$name is empty in $ENV_FILE"; exit 1; }
done
case "$API_DOMAIN" in *example.com) echo "Set API_DOMAIN in $ENV_FILE to a real hostname."; exit 1 ;; esac
case "$SITE_PATH" in /*/) ;; *) echo "SITE_PATH must start and end with a slash, e.g. /hvac/"; exit 1 ;; esac
[ -d "$HOMEPAGE_REPO/public" ] || { echo "No public/ folder in $HOMEPAGE_REPO - is HOMEPAGE_REPO right?"; exit 1; }

FOLDER="${SITE_PATH#/}"
FOLDER="${FOLDER%/}"
case "$FOLDER" in ""|*..*|api|api/*) echo "SITE_PATH '$SITE_PATH' is not a usable folder."; exit 1 ;; esac
DEST="$HOMEPAGE_REPO/public/$FOLDER"

echo "Building frontend for ${SITE_PATH} with API https://${API_DOMAIN}/api"
(
    cd frontend
    [ -d node_modules ] || npm ci
    npm run typecheck
    npm test
    # MSYS_NO_PATHCONV stops Git Bash rewriting /hvac/ into a Windows path.
    MSYS_NO_PATHCONV=1 VITE_API_BASE="https://${API_DOMAIN}/api" npx vite build --base="$SITE_PATH"
)

rm -rf "$DEST"
mkdir -p "$DEST"
cp -R frontend/dist/. "$DEST/"

echo ""
echo "Copied $(find "$DEST" -type f | wc -l) files to $DEST"
echo "Next, in the website repo: review, commit, and run its deploy (bash deploy2azure.sh)."
