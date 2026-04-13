#!/bin/bash
# ── T3Code Lens Connection Diagnostic ────────────────────────────────
# Run this on the T3Code machine to diagnose connection issues.
# Usage: bash diagnose.sh [t3code-host] [port]
#   e.g. bash diagnose.sh 0.0.0.0 3773

HOST="${1:-127.0.0.1}"
PORT="${2:-3773}"
TS_HOSTNAME=$(tailscale status --json 2>/dev/null | grep -o '"DNSName":"[^"]*"' | head -1 | cut -d'"' -f4 | sed 's/\.$//')

echo "═══════════════════════════════════════════════"
echo " T3Code Lens — Connection Diagnostic"
echo "═══════════════════════════════════════════════"
echo ""

# 1. Check if T3Code is running
echo "1. T3Code process"
if pgrep -f "t3.*serve" > /dev/null 2>&1; then
  echo "   ✓ t3 serve is running"
  ps aux | grep "[t]3.*serve" | head -1 | awk '{print "     "$11" "$12" "$13" "$14" "$15}'
else
  echo "   ✗ t3 serve is NOT running"
  echo "   → Start it: t3 serve --host 0.0.0.0 --port $PORT"
fi
echo ""

# 2. Check what interfaces T3Code is listening on
echo "2. Listening interfaces (port $PORT)"
if command -v lsof > /dev/null 2>&1; then
  LISTENERS=$(lsof -i ":$PORT" -sTCP:LISTEN 2>/dev/null | tail -n +2)
elif command -v ss > /dev/null 2>&1; then
  LISTENERS=$(ss -tlnp "sport = :$PORT" 2>/dev/null | tail -n +2)
elif command -v netstat > /dev/null 2>&1; then
  LISTENERS=$(netstat -tlnp 2>/dev/null | grep ":$PORT ")
fi

if [ -n "$LISTENERS" ]; then
  echo "   $LISTENERS" | head -3
  if echo "$LISTENERS" | grep -qE '(\*:|0\.0\.0\.0:)'; then
    echo "   ✓ Listening on ALL interfaces (0.0.0.0)"
  elif echo "$LISTENERS" | grep -q '127\.0\.0\.1:'; then
    echo "   ✓ Listening on localhost (127.0.0.1)"
    echo "     Tailscale funnel/cloudflared can reach this"
  else
    echo "   ⚠ Listening on a SPECIFIC interface only"
    echo "     Tailscale funnel proxies to 127.0.0.1 — this won't work!"
    echo "   → Restart with: t3 serve --host 0.0.0.0 --port $PORT"
  fi
else
  echo "   ✗ Nothing listening on port $PORT"
fi
echo ""

# 3. Test localhost HTTP
echo "3. HTTP reachability (localhost:$PORT)"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/" --connect-timeout 3 2>/dev/null)
if [ "$HTTP_STATUS" != "000" ]; then
  echo "   ✓ http://127.0.0.1:$PORT → HTTP $HTTP_STATUS"
else
  echo "   ✗ http://127.0.0.1:$PORT → no response"
  echo "   → T3Code may not be listening on localhost"
  echo "   → Try: t3 serve --host 0.0.0.0"
fi
echo ""

# 4. Test WebSocket upgrade on localhost
echo "4. WebSocket upgrade (localhost:$PORT/ws)"
WS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Sec-WebSocket-Version: 13" \
  "http://127.0.0.1:$PORT/ws" --connect-timeout 3 2>/dev/null)
if [ "$WS_RESPONSE" = "101" ]; then
  echo "   ✓ WebSocket upgrade succeeded (101)"
elif [ "$WS_RESPONSE" = "401" ] || [ "$WS_RESPONSE" = "403" ]; then
  echo "   ✓ WebSocket endpoint exists (got $WS_RESPONSE — needs auth, which is expected)"
elif [ "$WS_RESPONSE" != "000" ]; then
  echo "   ~ WebSocket endpoint responded with HTTP $WS_RESPONSE"
else
  echo "   ✗ No response on /ws"
fi
echo ""

# 5. Test auth endpoint
echo "5. Auth endpoint (localhost:$PORT/api/auth/session)"
AUTH_RESPONSE=$(curl -s "http://127.0.0.1:$PORT/api/auth/session" --connect-timeout 3 2>/dev/null)
if [ -n "$AUTH_RESPONSE" ]; then
  echo "   ✓ Auth endpoint responds"
  echo "   $AUTH_RESPONSE" | head -1 | cut -c1-80
else
  echo "   ✗ No response from auth endpoint"
fi
echo ""

# 6. Check Tailscale status
echo "6. Tailscale"
if command -v tailscale > /dev/null 2>&1; then
  TS_STATUS=$(tailscale status --self --json 2>/dev/null)
  if [ -n "$TS_STATUS" ]; then
    echo "   ✓ Tailscale is running"
    [ -n "$TS_HOSTNAME" ] && echo "   Hostname: $TS_HOSTNAME"
  else
    echo "   ✗ Tailscale is not connected"
  fi

  # Check serve/funnel status
  echo ""
  echo "   Serve status:"
  tailscale serve status 2>&1 | sed 's/^/   /'
else
  echo "   ✗ tailscale CLI not found"
fi
echo ""

# 7. Test Tailscale funnel URL
if [ -n "$TS_HOSTNAME" ]; then
  FUNNEL_URL="https://$TS_HOSTNAME"
  echo "7. Tailscale Funnel ($FUNNEL_URL)"
  FUNNEL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FUNNEL_URL/" --connect-timeout 5 2>/dev/null)
  if [ "$FUNNEL_STATUS" != "000" ]; then
    echo "   ✓ Funnel responds → HTTP $FUNNEL_STATUS"

    # Test WebSocket through funnel
    FUNNEL_WS=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Upgrade: websocket" \
      -H "Connection: Upgrade" \
      -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
      -H "Sec-WebSocket-Version: 13" \
      "$FUNNEL_URL/ws" --connect-timeout 5 2>/dev/null)
    echo "   Funnel /ws → HTTP $FUNNEL_WS"

    # Test CORS headers
    CORS_HEADERS=$(curl -s -I -X OPTIONS \
      -H "Origin: https://jappyjan.github.io" \
      -H "Access-Control-Request-Method: POST" \
      "$FUNNEL_URL/api/auth/ws-token" --connect-timeout 5 2>/dev/null | grep -i "access-control\|cors")
    if [ -n "$CORS_HEADERS" ]; then
      echo "   CORS headers present:"
      echo "$CORS_HEADERS" | sed 's/^/     /'
    else
      echo "   ⚠ No CORS headers — cross-origin HTTP will be blocked"
      echo "     (WebSocket should still work — it doesn't need CORS)"
    fi
  else
    echo "   ✗ Funnel URL not reachable"
    echo "   → Run: tailscale funnel --bg $PORT"
  fi
fi

echo ""
echo "═══════════════════════════════════════════════"
echo " Summary"
echo "═══════════════════════════════════════════════"
echo ""
echo " For the app to work from GitHub Pages, you need:"
echo "  1. t3 serve --host 0.0.0.0 --port $PORT"
echo "     (must listen on 0.0.0.0 or 127.0.0.1)"
echo "  2. An HTTPS tunnel — pick one:"
echo "     a) cloudflared tunnel --url http://localhost:$PORT"
echo "     b) tailscale funnel --bg $PORT"
echo "     c) ngrok http $PORT"
echo "  3. Use the tunnel's https:// URL in the app settings"
echo "  4. Get a session token: t3 auth session issue --token-only"
echo ""
