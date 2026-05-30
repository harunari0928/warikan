#!/bin/bash
# Seed: register default users (妻/夫) and fixed-expense templates.
# Idempotent — re-runs are safe (existing users return 409 and are skipped).
set -e

BASE_URL="${1:-http://localhost:3120}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_FILE="${SCRIPT_DIR}/seed-data.json"

echo "Seeding to ${BASE_URL}…"

# 1) Users
jq -c '.users[]' "${DATA_FILE}" | while read -r row; do
  name=$(echo "$row" | jq -r '.name')
  order=$(echo "$row" | jq -r '.display_order')
  echo "  user: ${name}"
  curl -s -X POST "${BASE_URL}/api/users" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${name}\",\"display_order\":${order}}" \
    -o /dev/null
done

USERS_JSON=$(curl -s "${BASE_URL}/api/users")
get_user_id() {
  echo "$USERS_JSON" | jq --arg name "$1" '.[] | select(.name == $name) | .id'
}

# 2) Templates
jq -c '.fixed_expense_templates[]' "${DATA_FILE}" | while read -r row; do
  user_name=$(echo "$row" | jq -r '.user')
  user_id=$(get_user_id "$user_name")
  desc=$(echo "$row" | jq -r '.description')
  amt=$(echo "$row" | jq -r '.amount')
  echo "  template: ${user_name} - ${desc} ¥${amt}"
  curl -s -X POST "${BASE_URL}/api/fixed-expense-templates" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":${user_id},\"description\":\"${desc}\",\"amount\":${amt}}" \
    -o /dev/null
done

echo "Done."
