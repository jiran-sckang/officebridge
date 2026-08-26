#!/bin/bash
# Stops every process started by start.sh.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN_DIR="$ROOT/run"

for pidfile in "$RUN_DIR"/*.pid; do
  [ -e "$pidfile" ] || continue
  name="$(basename "$pidfile" .pid)"
  pid="$(cat "$pidfile")"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid"
    echo "stopped $name (pid $pid)"
  else
    echo "$name (pid $pid) not running"
  fi
  rm -f "$pidfile"
done
