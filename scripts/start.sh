#!/bin/bash
# Starts this box's OfficeBridge processes: the relay, plus the 4 local mock
# apps used for testing. This box is RELAY-ONLY — the connector runs
# elsewhere (see connector-kit/) and connects in to this relay over the
# network. Run stop.sh first if anything is already running.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN_DIR="$ROOT/run"
mkdir -p "$RUN_DIR"

start_proc() {
  local name="$1"; shift
  nohup "$@" > "$RUN_DIR/$name.log" 2>&1 &
  echo $! > "$RUN_DIR/$name.pid"
  echo "started $name (pid $(cat "$RUN_DIR/$name.pid"))"
}

start_proc mock-erp        node "$ROOT/mock-apps/erp.js"
start_proc mock-gitlab     node "$ROOT/mock-apps/gitlab.js"
start_proc mock-groupware  node "$ROOT/mock-apps/groupware.js"
start_proc mock-acct       node "$ROOT/mock-apps/acct.js"
sleep 0.5
start_proc relay           node "$ROOT/relay/server.js"

echo ""
echo "OfficeBridge relay is starting. Logs: $RUN_DIR/*.log"
echo "Portal:  https://portal.10-52-249-21.sslip.io/"
echo "Admin:   https://admin.10-52-249-21.sslip.io/dashboard"
echo ""
echo "No connector is running on this box. Deploy connector-kit/ elsewhere and"
echo "point it at wss://10.52.249.21:443/tunnel — until then the dashboard"
echo "will show the connector as disconnected and app requests will 503."
