#!/usr/bin/env node
// ── T3Code CORS Proxy ──────────────────────────────────────────────
// A minimal reverse proxy that adds CORS headers to T3Code HTTP
// responses and transparently forwards WebSocket connections.
//
// Usage:
//   node cors-proxy.mjs                     # proxy :3774 → :3773
//   node cors-proxy.mjs 4000 3773           # proxy :4000 → :3773
//   T3_PORT=3773 PROXY_PORT=3774 node cors-proxy.mjs
//
// Then point your HTTPS tunnel at the proxy port instead of T3Code:
//   cloudflared tunnel --url http://localhost:3774
//   # or: tailscale funnel --bg 3774

import { createServer, request as httpRequest } from 'node:http';
import { createConnection } from 'node:net';

const PROXY_PORT = parseInt(process.argv[2] || process.env.PROXY_PORT || '3774', 10);
const T3_PORT    = parseInt(process.argv[3] || process.env.T3_PORT    || '3773', 10);
const T3_HOST    = '127.0.0.1';

const server = createServer((req, res) => {
  // ── CORS preflight ───────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }

  // ── Proxy HTTP to T3Code ─────────────────────────────────────────
  const proxyReq = httpRequest(
    {
      hostname: T3_HOST,
      port: T3_PORT,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `${T3_HOST}:${T3_PORT}` },
    },
    (proxyRes) => {
      const headers = { ...proxyRes.headers, ...corsHeaders(req) };
      res.writeHead(proxyRes.statusCode ?? 200, headers);
      proxyRes.pipe(res, { end: true });
    },
  );

  proxyReq.on('error', (err) => {
    console.error(`[http] ${req.method} ${req.url} → ${err.message}`);
    res.writeHead(502, corsHeaders(req));
    res.end(JSON.stringify({ error: 'T3Code unreachable', detail: err.message }));
  });

  req.pipe(proxyReq, { end: true });
});

// ── WebSocket upgrade — raw TCP passthrough ────────────────────────
// Instead of parsing/reconstructing the HTTP upgrade, we open a raw
// TCP socket to T3Code and forward the original upgrade request bytes
// verbatim. This avoids any header mangling issues.

server.on('upgrade', (req, socket, head) => {
  const proxySocket = createConnection({ host: T3_HOST, port: T3_PORT }, () => {
    // Reconstruct the original HTTP upgrade request from rawHeaders
    // to preserve exact header casing and order.
    const headerLines = [];
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const name = req.rawHeaders[i];
      const value = req.rawHeaders[i + 1];
      // Rewrite Host header to point at T3Code
      if (name.toLowerCase() === 'host') {
        headerLines.push(`Host: ${T3_HOST}:${T3_PORT}`);
      } else {
        headerLines.push(`${name}: ${value}`);
      }
    }

    const requestLine = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
    proxySocket.write(requestLine + headerLines.join('\r\n') + '\r\n\r\n');

    // Forward any buffered data from the client
    if (head && head.length) {
      proxySocket.write(head);
    }

    // Pipe everything bidirectionally — the 101 response from T3Code
    // flows back to the browser, then WebSocket frames flow both ways.
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxySocket.on('error', (err) => {
    console.error(`[ws] upgrade ${req.url} → ${err.message}`);
    socket.destroy();
  });

  socket.on('error', () => proxySocket.destroy());
});

server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`[T3Code CORS Proxy]`);
  console.log(`  Proxy:  http://0.0.0.0:${PROXY_PORT}`);
  console.log(`  Target: http://${T3_HOST}:${T3_PORT}`);
  console.log(``);
  console.log(`  Point your HTTPS tunnel at port ${PROXY_PORT}:`);
  console.log(`    cloudflared tunnel --url http://localhost:${PROXY_PORT}`);
  console.log(`    # or: tailscale funnel --bg ${PROXY_PORT}`);
  console.log(``);
});

// ── Helpers ────────────────────────────────────────────────────────

function corsHeaders(req) {
  return {
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}
