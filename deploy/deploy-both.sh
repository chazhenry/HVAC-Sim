#!/bin/bash
# Deploy the backend, then publish the frontend source for the website machine.
# Usage: bash deploy/deploy-both.sh "version comment"
set -euo pipefail

if [ $# -ne 1 ] || [ -z "${1// /}" ]; then
    echo 'Usage: bash deploy/deploy-both.sh "version comment"'
    exit 1
fi

cd "$(dirname "$0")/.."

bash deploy/deploy-backend.sh
bash deploy/deploy-frontend.sh "$1"
