#!/usr/bin/env bash
# One-time: create a Turso DB and print Render env values (secrets not committed).
set -euo pipefail
export PATH="${HOME}/.turso:${PATH}"

if ! command -v turso >/dev/null 2>&1; then
  echo "Install Turso CLI: curl -fsSL https://get.tur.so/install.sh | bash"
  exit 1
fi

if ! turso auth whoami >/dev/null 2>&1; then
  echo "Login required (browser):"
  echo "  turso auth login"
  exit 1
fi

DB_NAME="${1:-paypilot}"
echo "Creating/using database: ${DB_NAME}"
turso db create "${DB_NAME}" --yes 2>/dev/null || true
URL="$(turso db show "${DB_NAME}" --url)"
TOKEN="$(turso db tokens create "${DB_NAME}")"

echo ""
echo "Set these on Render service paypilot-docker (Environment):"
echo "  DATABASE_URL=${URL}"
echo "  DATABASE_AUTH_TOKEN=<token printed above — do not commit>"
echo ""
echo "Then redeploy and run: npm run demo:stage-ledger"
echo "Or POST /api/demo/stage-ledger with unlock cookie."
echo ""
echo "DATABASE_URL=${URL}"
echo "DATABASE_AUTH_TOKEN=${TOKEN}"
