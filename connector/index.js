// OfficeBridge connector — run this on a machine inside YOUR OWN network.
// It makes ONE outbound WSS connection to the relay and never opens an
// inbound port. Configure via config.js (or matching env vars); manage
// domain mappings either by editing services.json or via the local admin
// web UI (admin-web.js) started alongside it.
const http = require('http');
const https = require('https');
const WebSocket = require('ws');

const config = require('./config');
const state = require('./state');
const startAdminWeb = require('./admin-web');

const RECONNECT_MS = 3000;

let ws;

function register() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const entries = Array.from(state.enabledAddresses().entries()).map(([name, internalAddress]) => ({ name, internalAddress }));
  ws.send(JSON.stringify({ type: 'register', services: entries }));
  console.log('[connector] registered with relay:', entries.map((e) => e.name).join(', ') || '(none enabled)');
}

function connect() {
  const url = `wss://${config.RELAY_HOST}:${config.RELAY_PORT}/tunnel?token=${config.CONNECTOR_TOKEN}`;
  console.log(`[connector] connecting to ${url}`);
  ws = new WebSocket(url, { rejectUnauthorized: config.REJECT_UNAUTHORIZED });

  ws.on('open', () => {
    console.log('[connector] tunnel established');
    register();
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type === 'request') return handleRequest(msg);
  });

  ws.on('close', () => {
    console.log(`[connector] tunnel closed, reconnecting in ${RECONNECT_MS}ms`);
    setTimeout(connect, RECONNECT_MS);
  });

  ws.on('error', (err) => {
    console.error('[connector] tunnel error:', err.message);
  });
}

// If the upstream app redirects to its own real hostname (common for real
// internal apps, e.g. its own login page), rewrite that back onto the
// relay's public domain — otherwise the browser's next request would go
// straight to the real host, bypassing the relay entirely.
function rewriteLocation(headers, target, service) {
  if (!headers.location) return headers;
  try {
    const loc = new URL(headers.location, target);
    if (loc.hostname === target.hostname) {
      loc.protocol = 'https:';
      loc.hostname = `${service}.${config.PUBLIC_DOMAIN}`;
      loc.port = '';
      return { ...headers, location: loc.toString() };
    }
  } catch {
    // not a parseable URL — leave as-is
  }
  return headers;
}

function handleRequest(envelope) {
  const { id, service, method, path: reqPath, headers } = envelope;
  const base = state.enabledAddresses().get(service);

  if (!base) {
    console.error(`[connector] no enabled local mapping for "${service}" (missing, or disabled via local admin page)`);
    return sendResponse(id, 502, {}, Buffer.from('connector: service unavailable'));
  }

  const target = new URL(base);
  const client = target.protocol === 'https:' ? https : http;
  const body = envelope.body ? Buffer.from(envelope.body, 'base64') : null;

  const requestOptions = {
    hostname: target.hostname,
    path: reqPath,
    method,
    headers: { ...headers, host: target.host },
  };
  if (target.port) requestOptions.port = target.port;

  const outbound = client.request(requestOptions, (res) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => {
      sendResponse(id, res.statusCode, rewriteLocation(res.headers, target, service), Buffer.concat(chunks));
    });
  });

  outbound.on('error', (err) => {
    console.error(`[connector] upstream error for "${service}" (${base}):`, err.message);
    sendResponse(id, 504, {}, Buffer.from('connector: upstream unreachable'));
  });

  if (body) outbound.write(body);
  outbound.end();
}

function sendResponse(id, status, headers, bodyBuffer) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(
    JSON.stringify({
      type: 'response',
      id,
      status,
      headers,
      body: bodyBuffer.toString('base64'),
    })
  );
}

// Any change made through the local admin web UI (add/remove/toggle) is
// re-announced to the relay immediately.
state.onChange(register);

startAdminWeb({ isConnected: () => !!ws && ws.readyState === WebSocket.OPEN });
connect();
