#!/usr/bin/env bash
# Stop the brainstorm server and clean up
# Usage: stop-server.sh <session_dir>
#
# Kills the server process. Only deletes session directory if it's
# under /tmp (ephemeral). Persistent directories (.superpowers/) are
# kept so mockups can be reviewed later.

SESSION_DIR="$1"

resolve_path() {
  local path="$1"

  if command -v realpath >/dev/null 2>&1; then
    realpath -m "$path" 2>/dev/null && return 0
    realpath "$path" 2>/dev/null && return 0
  fi

  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import os, sys; print(os.path.realpath(os.path.abspath(sys.argv[1])))' "$path" 2>/dev/null && return 0
  fi

  if [[ -d "$path" ]]; then
    (cd "$path" 2>/dev/null && pwd -P) && return 0
  fi

  return 1
}

if [[ -z "$SESSION_DIR" ]]; then
  echo '{"error": "Usage: stop-server.sh <session_dir>"}'
  exit 1
fi

STATE_DIR="${SESSION_DIR}/state"
PID_FILE="${STATE_DIR}/server.pid"

if [[ -f "$PID_FILE" ]]; then
  pid=$(cat "$PID_FILE")

  # Try to stop gracefully, fallback to force if still alive
  kill "$pid" 2>/dev/null || true

  # Wait for graceful shutdown (up to ~2s)
  for i in {1..20}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      break
    fi
    sleep 0.1
  done

  # If still running, escalate to SIGKILL
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true

    # Give SIGKILL a moment to take effect
    sleep 0.1
  fi

  if kill -0 "$pid" 2>/dev/null; then
    echo '{"status": "failed", "error": "process still running"}'
    exit 1
  fi

  rm -f "$PID_FILE" "${STATE_DIR}/server.log"

  # Only delete canonicalized ephemeral /tmp directories.
  resolved_session_dir="$(resolve_path "$SESSION_DIR")"
  if [[ -n "$resolved_session_dir" && ( "$resolved_session_dir" == "/tmp" || "$resolved_session_dir" == /tmp/* ) ]]; then
    rm -rf "$resolved_session_dir"
  fi

  echo '{"status": "stopped"}'
else
  echo '{"status": "not_running"}'
fi
