#!/usr/bin/env bash
# Start the retro Gemini app against either gemini-web2api or the Gemini API.
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

USE=""
PORT=""
BUILD=0
START_BRIDGE=1

usage() {
  cat <<'USAGE'
Usage: ./start.sh [options]

Starts the retro Gemini app. With no options it uses the backend remembered in
the browser and starts gemini-web2api when it is not already running.

Options:
  --use bridge|api   Pin the backend for this run.
                       bridge  local gemini-web2api service (default)
                       api     Google Gemini API, key read from .env
  --port <number>    Port for the web app (default 5173, or 4173 with --build)
  --build            Build first and serve the production bundle
  --no-bridge        Never start gemini-web2api automatically
  -h, --help         Show this help

.env is loaded automatically (copy .env.example to .env):
  GEMINI_API_KEY     Required by --use api. Added by the local proxy, so it is
                     never sent to the browser or inlined into the bundle.
  BRIDGE_URL         Bridge address to check and start (default
                     http://127.0.0.1:8081/v1)
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --use)
      [ $# -ge 2 ] || { echo "start.sh: --use needs 'bridge' or 'api'" >&2; exit 2; }
      USE="$2"; shift 2 ;;
    --use=*)
      USE="${1#*=}"; shift ;;
    --port)
      [ $# -ge 2 ] || { echo "start.sh: --port needs a number" >&2; exit 2; }
      PORT="$2"; shift 2 ;;
    --port=*)
      PORT="${1#*=}"; shift ;;
    --build)
      BUILD=1; shift ;;
    --no-bridge)
      START_BRIDGE=0; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "start.sh: unknown option '$1'" >&2
      usage >&2
      exit 2 ;;
  esac
done

case "$USE" in
  web2api) USE="bridge" ;;
  ai-studio) USE="api" ;;
esac

case "$USE" in
  ""|bridge|api) ;;
  *)
    echo "start.sh: --use must be 'bridge' or 'api', not '$USE'" >&2
    exit 2 ;;
esac

if [ -n "$PORT" ] && ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
  echo "start.sh: --port must be a number" >&2
  exit 2
fi

# Load .env. It must contain plain KEY=value lines.
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ROOT_DIR/.env"
  set +a
fi

if [ "$USE" = "api" ] && [ -z "${GEMINI_API_KEY:-}" ]; then
  cat >&2 <<'MISSING'
start.sh: --use api needs GEMINI_API_KEY.

  1. Copy .env.example to .env
  2. Add a key from https://aistudio.google.com/apikey
  3. Run ./start.sh --use api again

Use ./start.sh --use bridge (or no flags) for the local bridge instead.
MISSING
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "start.sh: npm was not found. Install Node.js 20 or newer." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing frontend dependencies…"
  npm install
fi

PYTHON_BIN=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1; then
    PYTHON_BIN="$candidate"
    break
  fi
done

BRIDGE_URL="${BRIDGE_URL:-http://127.0.0.1:8081/v1}"
BRIDGE_URL="${BRIDGE_URL%/}"
BRIDGE_PID=""
APP_PID=""

listening() {
  [ -n "$PYTHON_BIN" ] || return 1
  "$PYTHON_BIN" - "$BRIDGE_URL" <<'PY'
import socket
import sys
from urllib.parse import urlparse

url = urlparse(sys.argv[1])
host = url.hostname or "127.0.0.1"
port = url.port or (443 if url.scheme == "https" else 80)
sock = socket.socket()
sock.settimeout(0.4)
try:
    sock.connect((host, port))
except OSError:
    sys.exit(1)
finally:
    sock.close()
PY
}

cleanup() {
  if [ -n "$APP_PID" ]; then
    kill "$APP_PID" 2>/dev/null || true
  fi
  if [ -n "$BRIDGE_PID" ]; then
    kill "$BRIDGE_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if [ "$USE" != "api" ] && [ "$START_BRIDGE" = 1 ]; then
  if listening; then
    echo "Bridge already listening at $BRIDGE_URL"
  elif [ -z "$PYTHON_BIN" ]; then
    echo "Note: Python was not found, so gemini-web2api was not started."
  elif [[ "$BRIDGE_URL" =~ ^https?://(127\.0\.0\.1|localhost)(:([0-9]+))? ]]; then
    BRIDGE_PORT="${BASH_REMATCH[3]:-8081}"
    if [ ! -f gemini-web2api/gemini_web2api.py ]; then
      echo "Note: gemini-web2api/ is missing, so the bridge was not started." >&2
    else
      echo "Starting gemini-web2api on port $BRIDGE_PORT…"
      # Background the Python process itself (not a subshell), so $! is the PID
      # the cleanup trap must stop and a Ctrl+C does not orphan the bridge.
      pushd gemini-web2api >/dev/null
      "$PYTHON_BIN" gemini_web2api.py --port "$BRIDGE_PORT" > bridge.log 2>&1 &
      BRIDGE_PID=$!
      popd >/dev/null

      ready=0
      for _ in $(seq 1 30); do
        if listening; then
          ready=1
          break
        fi
        if ! kill -0 "$BRIDGE_PID" 2>/dev/null; then
          break
        fi
        sleep 0.5
      done

      if [ "$ready" = 1 ]; then
        echo "Bridge ready at $BRIDGE_URL"
      else
        echo "Bridge did not come up. See gemini-web2api/bridge.log" >&2
        echo "The web app will still start so you can fix the settings." >&2
      fi
    fi
  else
    echo "Bridge URL is remote ($BRIDGE_URL); not starting a local copy."
  fi
fi

if [ "$USE" = "api" ]; then
  export VITE_GEMINI_PROXY=1
  export VITE_DEFAULT_PROVIDER=api
  echo "Backend: Google Gemini API (key from .env, added by the local proxy)"
elif [ "$USE" = "bridge" ]; then
  export VITE_GEMINI_PROXY=0
  export VITE_DEFAULT_PROVIDER=bridge
  echo "Backend: gemini-web2api bridge at $BRIDGE_URL"
else
  echo "Backend: using the choice saved in the browser"
fi

VITE_BIN="$ROOT_DIR/node_modules/.bin/vite"
if [ ! -x "$VITE_BIN" ]; then
  echo "start.sh: $VITE_BIN is missing. Run npm install first." >&2
  exit 1
fi

if [ "$BUILD" = 1 ]; then
  PORT="${PORT:-4173}"
  echo
  echo "Building the production bundle…"
  npm run build
  echo
  echo "Serving the build on http://127.0.0.1:$PORT/"
  "$VITE_BIN" preview --port "$PORT" &
else
  PORT="${PORT:-5173}"
  echo
  echo "Starting the dev server on http://127.0.0.1:$PORT/"
  "$VITE_BIN" --port "$PORT" &
fi

# Vite runs as a direct child so Ctrl+C and the cleanup trap stop it too.
APP_PID=$!
wait "$APP_PID" || true
