#!/bin/bash
# Double-click this file to start the toolkit.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js isn't installed yet."
  echo "Get it from https://nodejs.org (the big green LTS button), then double-click this again."
  read -r -p "Press Enter to close."
  exit 1
fi
exec node packages/bridge/bin/start.js "$@"
