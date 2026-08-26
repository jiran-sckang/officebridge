#!/bin/bash
# Restores the demo to a pristine pre-demo state: stops everything, resets
# users/policy/rules data from data/seed/, empties the audit log, then
# restarts all processes so the relay reloads the clean data.
# Run this right before a rehearsal or the real demo.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$ROOT/data"
SEED="$DATA/seed"

echo "== stopping processes =="
bash "$ROOT/scripts/stop.sh"

echo "== restoring seed data =="
for f in users.json dept-policy.json grants.json services.json rules-config.json; do
  cp "$SEED/$f" "$DATA/$f"
  echo "restored $f"
done

echo "== clearing audit log =="
: > "$DATA/audit.log"

echo "== clearing old process logs =="
rm -f "$ROOT/run"/*.log

echo "== starting processes =="
bash "$ROOT/scripts/start.sh"

echo ""
echo "Demo reset complete. Relay only shows systems the connector has actually"
echo "announced — add a new one from the connector's local admin web (:8090) to"
echo "demo live onboarding; it appears on the relay's 사내시스템 현황 page immediately."
