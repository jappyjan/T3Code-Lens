#!/usr/bin/env node
// ── T3Code CORS Proxy ──────────────────────────────────────────────
// A minimal reverse proxy that adds CORS headers to T3Code responses.
// Run alongside T3Code so the Lens app (on a different origin) can
// reach the HTTP auth endpoints.
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
import { URL } from 'node:url';

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

  // ── Proxy to T3Code ──────────────────────────────────────────────
  const proxyReq = httpRequest(
    {
      hostname: T3_HOST,
      port: T3_PORT,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `${T3_HOST}:${T3_PORT}`,
      },
    },
    (proxyRes) => {
      // Merge CORS headers into the response
      const headers = { ...proxyRes.headers, ...corsHeaders(req) };
      res.writeHead(proxyRes.statusCode ?? 200, headers);
      proxyRes.pipe(res, { end: true });
    },
  );

  proxyReq.on('error', (err) => {
    console.error(`[proxy] ${req.method} ${req.url} → error: ${err.message}`);
    res.writeHead(502, corsHeaders(req));
    res.end(JSON.stringify({ error: 'T3Code unreachable', detail: err.message }));
  });

  req.pipe(proxyReq, { end: true });
});

// ── WebSocket upgrade — pass through to T3Code ────────────────────
server.on('upgrade', (req, socket, head) => {
  const proxyReq = httpRequest({
    hostname: T3_HOST,
    port: T3_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${T3_HOST}:${T3_PORT}`,
    },
  });

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    // Forward the 101 Switching Protocols response
    const statusLine = `HTTP/${proxyRes.httpVersion} ${proxyRes.statusCode} ${proxyRes.statusMessage}\r\n`;
    const headerLines = Object.entries(proxyRes.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');
    socket.write(statusLine + headerLines + '\r\n\r\n');

    if (proxyHead.length) socket.write(proxyHead);

    proxySocket.pipe(socket);
    socket.pipe(proxySocket);

    proxySocket.on('error', () => socket.destroy());
    socket.on('error', () => proxySocket.destroy());
  });

  proxyReq.on('error', () => {
    socket.destroy();
  });

  proxyReq.end();
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
