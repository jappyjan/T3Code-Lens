#!/usr/bin/env bash
set -euo pipefail

# ── T3Code Lens — One-Command Launcher ──────────────────────────────
# Starts T3Code, the CORS proxy, and a Tailscale Funnel, then prints
# connection details (with QR code) for the Lens app.
#
# Usage:
#   bash <(curl -fsSL https://raw.githubusercontent.com/jappyjan/T3Code-Lens/main/start.sh)
#
# Requirements:
#   - node (Node.js >= 18) + npx
#   - tailscale (with Funnel enabled on your tailnet)
#
# Environment variables (all optional):
#   T3_PORT       T3Code port              (default: 3773)
#   PROXY_PORT    CORS proxy port          (default: 3774)
#   T3_HOST       T3Code bind address      (default: 0.0.0.0)
#   T3_CWD        Working directory for t3 (default: current dir)

T3_PORT="${T3_PORT:-3773}"
PROXY_PORT="${PROXY_PORT:-3774}"
T3_HOST="${T3_HOST:-0.0.0.0}"
T3_CWD="${T3_CWD:-.}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}" 2>/dev/null)" && pwd 2>/dev/null || echo ".")"
PROXY_SCRIPT="$SCRIPT_DIR/cors-proxy.mjs"

# If started via curl pipe, download the proxy script to a temp dir
if [ ! -f "$PROXY_SCRIPT" ]; then
  TMPDIR_LENS="$(mktemp -d)"
  PROXY_SCRIPT="$TMPDIR_LENS/cors-proxy.mjs"
  echo "[setup] Downloading cors-proxy.mjs..."
  curl -fsSL "https://raw.githubusercontent.com/jappyjan/T3Code-Lens/main/cors-proxy.mjs" \
    -o "$PROXY_SCRIPT"
fi

# ── Preflight checks ───────────────────────────────────────────────

fail() { echo "ERROR: $1" >&2; exit 1; }

command -v node  >/dev/null 2>&1 || fail "Node.js not found. Install: https://nodejs.org"
command -v npx   >/dev/null 2>&1 || fail "npx not found. Install Node.js >= 18: https://nodejs.org"
command -v tailscale >/dev/null 2>&1 || fail "Tailscale CLI not found. Install: https://tailscale.com/download"

# Check Tailscale is connected
tailscale status >/dev/null 2>&1 || fail "Tailscale is not connected. Run: tailscale up"

# Get Tailscale hostname
TS_DNS=$(tailscale status --json 2>/dev/null | node -e "
  let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
    try{console.log(JSON.parse(d).Self.DNSName.replace(/\.$/,''))}
    catch{process.exit(1)}
  })
" 2>/dev/null) || fail "Could not determine Tailscale hostname"

FUNNEL_URL="https://$TS_DNS"

# ── Cleanup on exit ────────────────────────────────────────────────

PIDS=()
cleanup() {
  echo ""
  echo "[shutdown] Stopping all services..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  done
  tailscale funnel --bg off 2>/dev/null || true
  [ -n "${TMPDIR_LENS:-}" ] && rm -rf "$TMPDIR_LENS"
  echo "[shutdown] Done."
}
trap cleanup EXIT INT TERM

# ── Start T3Code ────────────────────────────────────────────────────

echo "[1/3] Starting T3Code on port $T3_PORT..."
npx t3 serve --host "$T3_HOST" --port "$T3_PORT" --no-browser "$T3_CWD" &
PIDS+=($!)

# Wait for T3Code to be ready
echo -n "      Waiting for T3Code..."
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$T3_PORT/" -o /dev/null 2>/dev/null; then
    echo " ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo " timeout!"
    fail "T3Code did not start within 30 seconds"
  fi
  sleep 1
  echo -n "."
done

# ── Start CORS proxy ───────────────────────────────────────────────

echo "[2/3] Starting CORS proxy ($PROXY_PORT → $T3_PORT)..."
node "$PROXY_SCRIPT" "$PROXY_PORT" "$T3_PORT" &
PIDS+=($!)
sleep 1

# ── Start Tailscale Funnel ─────────────────────────────────────────

echo "[3/3] Starting Tailscale Funnel on port $PROXY_PORT..."
tailscale funnel --bg "$PROXY_PORT" 2>/dev/null || fail "Failed to start Tailscale Funnel. Is Funnel enabled for your tailnet?"

# ── Generate session token ─────────────────────────────────────────

echo ""
echo "      Generating session token..."
SESSION_TOKEN=$(npx t3 auth session issue --token-only --ttl 30d 2>/dev/null) || {
  echo "      ⚠ Could not auto-generate token."
  echo "      Run manually: npx t3 auth session issue --token-only"
  SESSION_TOKEN=""
}

# ── Print connection details ────────────────────────────────────────

APP_URL="https://jappyjan.github.io/T3Code-Lens/"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║               T3Code Lens — Ready!                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  App:     $APP_URL"
echo "  Server:  $FUNNEL_URL"
if [ -n "$SESSION_TOKEN" ]; then
  echo "  Token:   $SESSION_TOKEN"
fi
echo ""
echo "  Settings page → paste Server URL and Session Token"
echo ""

# ── QR code ─────────────────────────────────────────────────────────
# Encode: app URL + server + token as a simple text block the user
# can scan and copy from. Or encode just the server URL for quick entry.

QR_TEXT="$FUNNEL_URL"

if command -v qrencode >/dev/null 2>&1; then
  echo "  ┌─ Scan to copy server URL ─┐"
  qrencode -t ANSIUTF8 -m 1 "$QR_TEXT" 2>/dev/null | sed 's/^/  │ /' || true
  echo "  └────────────────────────────┘"
elif command -v python3 >/dev/null 2>&1; then
  # Fallback: generate QR with Python
  python3 -c "
import sys
try:
    import qrcode
    qr = qrcode.QRCode(box_size=1, border=1)
    qr.add_data(sys.argv[1])
    qr.make()
    lines = []
    for r in range(0, qr.modules_count, 2):
        line = ''
        for c in range(qr.modules_count):
            top = qr.modules[r][c] if r < qr.modules_count else False
            bot = qr.modules[r+1][c] if r+1 < qr.modules_count else False
            if top and bot: line += '█'
            elif top: line += '▀'
            elif bot: line += '▄'
            else: line += ' '
        lines.append(line)
    print('  ┌─ Scan to copy server URL ─┐')
    for l in lines:
        print(f'  │ {l} │')
    print('  └────────────────────────────┘')
except ImportError:
    pass
" "$QR_TEXT" 2>/dev/null || true
fi

if [ -n "$SESSION_TOKEN" ]; then
  echo ""
  echo "  Session token (select & copy):"
  echo "  ┌──────────────────────────────────────────────────────┐"
  echo "  │ $SESSION_TOKEN"
  echo "  └──────────────────────────────────────────────────────┘"
fi

echo ""
echo "  Press Ctrl+C to stop all services."
echo ""

# ── Keep running ────────────────────────────────────────────────────

wait
