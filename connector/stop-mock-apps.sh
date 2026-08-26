#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
for pidfile in "$ROOT/run"/mock-*.pid; do
  [ -e "$pidfile" ] || continue
  pid="$(cat "$pidfile")"
  kill "$pid" 2>/dev/null && echo "stopped $(basename "$pidfile" .pid) (pid $pid)"
  rm -f "$pidfile"
done
