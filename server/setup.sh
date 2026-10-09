#!/usr/bin/env bash
# Local PocketBase bootstrap for Journeybook.
# Downloads the binary (if missing), creates the admin + the two app users,
# and serves. Dev-only defaults are used unless overridden by env vars.
set -euo pipefail
cd "$(dirname "$0")"

PB_VERSION="0.40.5"
PB_URL="http://127.0.0.1:8090"

ADMIN_EMAIL="${PB_ADMIN_EMAIL:-admin@journeybook.local}"
ADMIN_PASSWORD="${PB_ADMIN_PASSWORD:-journeybook-admin}"
USER1_NAME="${JB_USER1_NAME:-You}"
USER1_EMAIL="${JB_USER1_EMAIL:-you@journeybook.local}"
USER1_PASSWORD="${JB_USER1_PASSWORD:-journeybook-you}"
USER2_NAME="${JB_USER2_NAME:-Her}"
USER2_EMAIL="${JB_USER2_EMAIL:-her@journeybook.local}"
USER2_PASSWORD="${JB_USER2_PASSWORD:-journeybook-her}"

if [ ! -x ./pocketbase ]; then
  echo "Downloading PocketBase v${PB_VERSION}…"
  curl -sL -o /tmp/pocketbase.zip \
    "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m).zip"
  unzip -o /tmp/pocketbase.zip -d . >/dev/null
fi

./pocketbase superuser upsert "$ADMIN_EMAIL" "$ADMIN_PASSWORD" >/dev/null

./pocketbase serve --http=127.0.0.1:8090 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  curl -s -o /dev/null "$PB_URL/api/health" && break
  sleep 0.25
done

TOKEN=$(curl -s -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

create_user() {
  local name="$1" email="$2" password="$3"
  curl -s -o /dev/null -X POST "$PB_URL/api/collections/users/records" \
    -H "Authorization: $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"name\":\"$name\",\"email\":\"$email\",\"password\":\"$password\",\"passwordConfirm\":\"$password\",\"verified\":true}" || true
}
create_user "$USER1_NAME" "$USER1_EMAIL" "$USER1_PASSWORD"
create_user "$USER2_NAME" "$USER2_EMAIL" "$USER2_PASSWORD"

echo ""
echo "PocketBase ready."
echo "  Admin:  $PB_URL/_/  ($ADMIN_EMAIL)"
echo "  Users:  $USER1_EMAIL / $USER2_EMAIL"
echo "  API:    $PB_URL"
wait $PID
