#!/bin/bash
# Optional: starts 3 fake internal apps (ERP/GitLab/Groupware) on 127.0.0.1
# so you can test the connector end-to-end before pointing it at real
# internal systems. See README.md step 4.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$ROOT/run"

for app in erp gitlab groupware; do
  nohup node "$ROOT/mock-apps/$app.js" > "$ROOT/run/mock-$app.log" 2>&1 &
  echo $! > "$ROOT/run/mock-$app.pid"
  echo "started mock-$app (pid $(cat "$ROOT/run/mock-$app.pid"))"
done
