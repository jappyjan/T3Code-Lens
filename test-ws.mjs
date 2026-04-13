#!/usr/bin/env node
// ── WebSocket Connection Tester ─────────────────────────────────────
// Tests WebSocket connectivity to T3Code directly and through the proxy.
//
// Usage: node test-ws.mjs [session-token]
// If no token provided, it tries to get one via the auth endpoint.

import { request } from 'node:http';
import { createConnection } from 'node:net';

const T3_PORT    = parseInt(process.env.T3_PORT    || '3773', 10);
const PROXY_PORT = parseInt(process.env.PROXY_PORT || '3774', 10);
const HOST       = '127.0.0.1';
const TOKEN      = process.argv[2] || '';

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log(' WebSocket Connection Tester');
  console.log('═══════════════════════════════════════════════\n');

  // 1. Test HTTP on both ports
  console.log('1. HTTP connectivity');
  const t3Http = await testHttp(HOST, T3_PORT, '/');
  console.log(`   T3Code  (${T3_PORT}): ${t3Http}`);
  const proxyHttp = await testHttp(HOST, PROXY_PORT, '/');
  console.log(`   Proxy   (${PROXY_PORT}): ${proxyHttp}`);

  // 2. Get a WS token (requires session token first)
  if (!TOKEN) {
    console.log('\n2. No session token provided — cannot test WebSocket');
    console.log('   Usage: node test-ws.mjs <session-token>');
    return;
  }
  console.log(`\n2. Session token: ${TOKEN.slice(0, 30)}...`);

  // Get a short-lived WS token from T3Code directly
  console.log('   Getting WS token via T3Code...');
  const wsTokenDirect = await getWsToken(T3_PORT);
  if (wsTokenDirect) {
    console.log(`   ✓ Got WS token (direct): ${wsTokenDirect.slice(0, 30)}...`);
  } else {
    console.log('   ✗ Could not get WS token from T3Code');
  }

  // Also try via proxy
  console.log('   Getting WS token via proxy...');
  const wsTokenProxy = await getWsToken(PROXY_PORT);
  if (wsTokenProxy) {
    console.log(`   ✓ Got WS token (proxy):  ${wsTokenProxy.slice(0, 30)}...`);
  } else {
    console.log('   ✗ Could not get WS token from proxy');
  }

  const wsToken = wsTokenDirect || wsTokenProxy;
  if (!wsToken) {
    console.log('   No WS token available — cannot test WebSocket');
    return;
  }

  // 3. Test WebSocket directly to T3Code
  console.log(`\n3. WebSocket direct to T3Code (:${T3_PORT})`);
  await testWebSocket(HOST, T3_PORT, wsToken, '   ');

  // 4. Test WebSocket through proxy
  console.log(`\n4. WebSocket through proxy (:${PROXY_PORT})`);
  await testWebSocket(HOST, PROXY_PORT, wsToken, '   ');

  console.log('\n═══════════════════════════════════════════════\n');
}

function testHttp(host, port, path) {
  return new Promise((resolve) => {
    const req = request({ hostname: host, port, path, method: 'GET', timeout: 3000 }, (res) => {
      resolve(`HTTP ${res.statusCode}`);
      res.resume();
    });
    req.on('error', (e) => resolve(`error: ${e.message}`));
    req.on('timeout', () => { req.destroy(); resolve('timeout'); });
    req.end();
  });
}

function getWsToken(port) {
  // Get a ws-token from T3Code (or proxy) using the session token
  return new Promise((resolve) => {
    const req = request({
      hostname: HOST,
      port,
      path: '/api/auth/ws-token',
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}` },
      timeout: 5000,
    }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve(data.token || null);
        } catch {
          console.log(`   Response body: ${body.slice(0, 200)}`);
          resolve(null);
        }
      });
    });
    req.on('error', (e) => { console.log(`   Error: ${e.message}`); resolve(null); });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function testWebSocket(host, port, token, prefix) {
  return new Promise((resolve) => {
    const path = `/ws?wsToken=${encodeURIComponent(token)}`;
    // Sec-WebSocket-Key must be a base64-encoded 16-byte value (RFC 6455)
    const keyBytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) keyBytes[i] = Math.floor(Math.random() * 256);
    const key = Buffer.from(keyBytes).toString('base64');

    const socket = createConnection({ host, port }, () => {
      console.log(`${prefix}TCP connected`);

      // Send WebSocket upgrade request
      const upgrade = [
        `GET ${path} HTTP/1.1`,
        `Host: ${host}:${port}`,
        `Upgrade: websocket`,
        `Connection: Upgrade`,
        `Sec-WebSocket-Key: ${key}`,
        `Sec-WebSocket-Version: 13`,
        ``,
        ``,
      ].join('\r\n');

      socket.write(upgrade);
    });

    let responseData = Buffer.alloc(0);
    let upgraded = false;
    let timeout = setTimeout(() => {
      console.log(`${prefix}✗ Timeout — no response after 5s`);
      console.log(`${prefix}  Raw bytes received: ${responseData.length}`);
      if (responseData.length > 0) {
        console.log(`${prefix}  Data: ${responseData.toString('utf8').slice(0, 300)}`);
      }
      socket.destroy();
      resolve();
    }, 5000);

    socket.on('data', (chunk) => {
      responseData = Buffer.concat([responseData, chunk]);

      if (!upgraded) {
        const text = responseData.toString('utf8');
        const headerEnd = text.indexOf('\r\n\r\n');
        if (headerEnd === -1) return; // wait for full headers

        const headers = text.slice(0, headerEnd);
        const statusLine = headers.split('\r\n')[0];
        console.log(`${prefix}Response: ${statusLine}`);

        // Show response body for non-101 responses
        if (!statusLine.includes('101')) {
          const body = text.slice(headerEnd + 4);
          if (body.length > 0) console.log(`${prefix}  Body: ${body.slice(0, 200)}`);
        }

        if (statusLine.includes('101')) {
          upgraded = true;
          console.log(`${prefix}✓ WebSocket upgraded!`);

          // Send a Ping message in the Effect RPC format
          const pingMsg = JSON.stringify({ _tag: 'Ping' });
          const pingFrame = encodeWsFrame(pingMsg);
          socket.write(pingFrame);
          console.log(`${prefix}  Sent: {"_tag":"Ping"}`);

          // Wait a bit for Pong
          setTimeout(() => {
            const remaining = responseData.slice(headerEnd + 4);
            if (remaining.length > 0) {
              const decoded = tryDecodeWsFrame(remaining);
              console.log(`${prefix}  Received: ${decoded || `${remaining.length} bytes (raw)`}`);
              console.log(`${prefix}✓ Data flowing — proxy works!`);
            } else {
              console.log(`${prefix}⚠ No data received after upgrade`);
            }
            clearTimeout(timeout);
            socket.destroy();
            resolve();
          }, 2000);
        } else {
          console.log(`${prefix}✗ Upgrade failed`);
          console.log(`${prefix}  ${headers.replace(/\r\n/g, `\n${prefix}  `)}`);
          clearTimeout(timeout);
          socket.destroy();
          resolve();
        }
      }
    });

    socket.on('error', (err) => {
      console.log(`${prefix}✗ Connection error: ${err.message}`);
      clearTimeout(timeout);
      resolve();
    });

    socket.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

// Encode a WebSocket text frame (no masking — server-to-client only needs
// this for testing, but client frames SHOULD be masked per RFC 6455)
function encodeWsFrame(text) {
  const payload = Buffer.from(text, 'utf8');
  const mask = Buffer.from([0x12, 0x34, 0x56, 0x78]); // arbitrary mask
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) {
    masked[i] = payload[i] ^ mask[i % 4];
  }

  let header;
  if (payload.length < 126) {
    header = Buffer.alloc(6);
    header[0] = 0x81; // FIN + text opcode
    header[1] = 0x80 | payload.length; // MASK bit + length
    mask.copy(header, 2);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(8);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
    mask.copy(header, 4);
  } else {
    header = Buffer.alloc(14);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
    mask.copy(header, 10);
  }

  return Buffer.concat([header, masked]);
}

function tryDecodeWsFrame(buf) {
  if (buf.length < 2) return null;
  const opcode = buf[0] & 0x0f;
  const isMasked = (buf[1] & 0x80) !== 0;
  let payloadLen = buf[1] & 0x7f;
  let offset = 2;

  if (payloadLen === 126) {
    if (buf.length < 4) return null;
    payloadLen = buf.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buf.length < 10) return null;
    payloadLen = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }

  if (isMasked) offset += 4;
  if (buf.length < offset + payloadLen) return null;

  const payload = buf.slice(offset, offset + payloadLen);
  if (opcode === 1) return payload.toString('utf8'); // text frame
  return `[opcode=${opcode}, ${payloadLen} bytes]`;
}

main().catch(console.error);
