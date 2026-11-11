#!/bin/bash
###############################################################################
# Publish this project's latest code so the website can pick it up.
#
#   bash deploy/deploy-frontend.sh "version comment"
#
# Commits everything in this repo with that comment and pushes it to GitHub,
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

  1. bash scripts/update-hvac.sh      # rebuilds public/hvac/ from GitHub
  2. git add -A && git commit -m "Update HVAC-Sim" && git push
  3. bash deploy2azure.sh             # publishes the website

Then hard-refresh https://hypercard.ai/hvac/ (Ctrl+Shift+R).

If the backend changed too, run this here first:  bash deploy/deploy-backend.sh
-------------------------------------------------------------------------------
EOF
