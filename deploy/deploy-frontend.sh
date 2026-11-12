#!/bin/bash
###############################################################################
# Publish this project's latest code so the website can pick it up.
#
#   bash deploy/deploy-frontend.sh "version comment"
#
# Bumps the app version, commits everything with that comment and pushes to GitHub,
# then prints what to run in the website repo, which builds the frontend from
# GitHub and puts it live at /hvac/.
###############################################################################
set -euo pipefail

if [ $# -ne 1 ] || [ -z "${1// /}" ]; then
    echo 'Usage: bash deploy/deploy-frontend.sh "version comment"'
    exit 1
fi
COMMENT="$1"

cd "$(dirname "$0")/.."

# Use this machine's local date. Same-day releases advance a, b, ... z, aa, ab, ...
VERSION_FILE="frontend/src/version.ts"
TODAY="$(date +%y.%m.%d)"
CURRENT="$(sed -nE "s/^export const APP_VERSION = '([0-9]{2}\\.[0-9]{2}\\.[0-9]{2}[a-z]*)';\r?$/\1/p" "$VERSION_FILE")"
if [ -z "$CURRENT" ]; then
    echo "Cannot read APP_VERSION from $VERSION_FILE. Nothing was committed."
    exit 1
fi

VERSION="$TODAY"
if [[ "$CURRENT" == "$TODAY"* ]]; then
    SUFFIX="${CURRENT#"$TODAY"}"
    CARRY=""
    while [[ "$SUFFIX" == *z ]]; do
        SUFFIX="${SUFFIX%z}"
        CARRY="a$CARRY"
    done
    if [ -z "$SUFFIX" ]; then
        SUFFIX="a$CARRY"
    else
        ALPHABET="abcdefghijklmnopqrstuvwxyz"
        LAST="${SUFFIX: -1}"
        FOLLOWING="${ALPHABET#*"$LAST"}"
        SUFFIX="${SUFFIX%?}${FOLLOWING:0:1}$CARRY"
    fi
    VERSION="$TODAY$SUFFIX"
fi
printf "/** Release date (YY.MM.DD), followed by a letter for additional releases that day. */\nexport const APP_VERSION = '%s';\n" "$VERSION" > "$VERSION_FILE"
echo "App version: $CURRENT -> $VERSION"

git add -A

# Keys and local settings are git-ignored; stop if one is staged anyway.
if git diff --cached --name-only | grep -qiE '(^|/)\.env$|\.pem$|deploy/deploy\.env$'; then
    echo "A key or .env file is staged. Nothing was committed:"
    git diff --cached --name-only | grep -iE '(^|/)\.env$|\.pem$|deploy/deploy\.env$'
    git reset -q
    exit 1
fi

if git diff --cached --quiet; then
    echo "Nothing new to commit."
else
    git commit -q -m "$COMMENT"
    echo "Committed: $COMMENT"
fi

git push
echo "Pushed $(git rev-parse --short HEAD) to $(git remote get-url origin)"

cat <<'EOF'

-------------------------------------------------------------------------------
Next: put it live. On the machine with the hypercard.ai-homepage repo, run:

  1. bash# scripts/update-hvac.sh      # rebuilds public/hvac/ from GitHub
  2. bash# deploy2azure.sh             # publishes the website

Then hard-refresh https://hypercard.ai/hvac/ (Ctrl+Shift+R).

If the backend changed too, run this here first:  bash deploy/deploy-backend.sh
-------------------------------------------------------------------------------
EOF
