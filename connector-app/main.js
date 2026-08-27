// OfficeBridge Connector — login-gated desktop app.
// Unlike the old always-on background daemon, this app's outbound tunnel
// only runs while an admin is actively authenticated: the admin logs in
// with company code + portal credentials, gets a personal connector token
// back, and the tunnel starts. Quit or log out and it stops. No token is
// cached across restarts — every launch requires a fresh login by design.
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { app, ipcMain, dialog } = require('electron');
const { menubar } = require('menubar');
const WebSocket = require('ws');

const RELAY_DOMAIN = process.env.OB_RELAY_DOMAIN || '10-52-249-21.sslip.io';
const RELAY_PORT = process.env.OB_RELAY_PORT || '443';
const RECONNECT_MS = 3000;
const HEARTBEAT_TIMEOUT_MS = 45000;

// Local service map (name -> {internalAddress, enabled}) — not sensitive,
// so it's fine to persist independent of login state, same as the old
// connector-kit's services.json.
const SERVICES_PATH = path.join(app.getPath('userData'), 'services.json');
function loadServices() {
  try {
    return new Map(Object.entries(JSON.parse(fs.readFileSync(SERVICES_PATH, 'utf8'))));
  } catch {
    return new Map();
  }
}
function saveServices(services) {
  fs.mkdirSync(path.dirname(SERVICES_PATH), { recursive: true });
  fs.writeFileSync(SERVICES_PATH, JSON.stringify(Object.fromEntries(services), null, 2));
}
let services = loadServices();

// ---- tunnel state (only exists while logged in) --------------------------
let ws = null;
let connectorToken = null;
let operatorName = null;
let heartbeatTimer = null;
let lastHeartbeat = 0;
let revokedMessage = null; // set when the relay rejects reconnection — shown once on the login screen

function enabledAddresses() {
  const out = new Map();
  for (const [name, s] of services) if (s.enabled) out.set(name, s.internalAddress);
  return out;
}

function register() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const entries = Array.from(enabledAddresses().entries()).map(([name, internalAddress]) => ({ name, internalAddress }));
  ws.send(JSON.stringify({ type: 'register', services: entries }));
}

function rewriteLocation(headers, target, service) {
  if (!headers.location) return headers;
  try {
    const loc = new URL(headers.location, target);
    if (loc.hostname === target.hostname) {
      loc.protocol = 'https:';
      loc.hostname = `${service}.${RELAY_DOMAIN}`;
      loc.port = '';
      return { ...headers, location: loc.toString() };
    }
  } catch {
    // not parseable — leave as-is
  }
  return headers;
}

function sendResponse(id, status, headers, bodyBuffer) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'response', id, status, headers, body: bodyBuffer.toString('base64') }));
}

function handleRequest(envelope) {
  const { id, service, method, path: reqPath, headers } = envelope;
  const base = enabledAddresses().get(service);
  if (!base) return sendResponse(id, 502, {}, Buffer.from('connector: service unavailable'));

  const target = new URL(base);
  const client = target.protocol === 'https:' ? https : http;
  const body = envelope.body ? Buffer.from(envelope.body, 'base64') : null;
  const requestOptions = { hostname: target.hostname, path: reqPath, method, headers: { ...headers, host: target.host } };
  if (target.port) requestOptions.port = target.port;

  const outbound = client.request(requestOptions, (res) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => sendResponse(id, res.statusCode, rewriteLocation(res.headers, target, service), Buffer.concat(chunks)));
  });
  outbound.on('error', (err) => sendResponse(id, 504, {}, Buffer.from(`connector: upstream unreachable (${err.message})`)));
  if (body) outbound.write(body);
  outbound.end();
}

function connect() {
  const url = `wss://${RELAY_DOMAIN}:${RELAY_PORT}/tunnel?token=${connectorToken}`;
  ws = new WebSocket(url, { rejectUnauthorized: false });

  lastHeartbeat = Date.now();
  clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    if (Date.now() - lastHeartbeat > HEARTBEAT_TIMEOUT_MS) ws.terminate();
  }, 10000);

  ws.on('open', () => {
    lastHeartbeat = Date.now();
    register();
  });
  ws.on('ping', () => { lastHeartbeat = Date.now(); });
  ws.on('message', (raw) => {
    lastHeartbeat = Date.now();
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type === 'request') handleRequest(msg);
  });
  ws.on('unexpected-response', (_req, res) => {
    // The relay rejected the handshake itself (e.g. 401) — our token was
    // revoked from the admin console. Don't just keep retrying forever with
    // a token that will never work again; drop back to the login screen.
    if (res.statusCode === 401) {
      revokedMessage = '관리자가 이 커넥터의 접근 권한을 회수했습니다. 다시 로그인해주세요.';
      connectorToken = null;
      operatorName = null;
    }
  });
  ws.on('close', () => {
    clearInterval(heartbeatTimer);
    if (connectorToken) setTimeout(connect, RECONNECT_MS); // only reconnect while still "logged in"
  });
  ws.on('error', () => {});
}

function stopTunnel() {
  connectorToken = null;
  operatorName = null;
  clearInterval(heartbeatTimer);
  if (ws) { ws.removeAllListeners('close'); ws.close(); ws = null; }
}

// ---- self-signed relay HTTPS helper for the register call ----------------
function postJson(hostname, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body));
    const req = https.request(
      { hostname, path: urlPath, method: 'POST', rejectUnauthorized: false, headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode !== 200) return reject(new Error(text || `relay responded ${res.statusCode}`));
          try { resolve(JSON.parse(text)); } catch (err) { reject(err); }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ---- electron / menubar ----------------------------------------------------
const mb = menubar({
  index: `file://${path.join(__dirname, 'index.html')}`,
  icon: path.join(__dirname, 'assets', 'iconTemplate.png'),
  browserWindow: {
    width: 320,
    height: 460,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  },
  tooltip: 'OfficeBridge Connector',
});

app.on('before-quit', stopTunnel);

ipcMain.handle('connector:register', async (_event, { companyCode, email, password }) => {
  const result = await postJson(RELAY_DOMAIN, '/_ob/api/connector/register', { companyCode, email, password });
  connectorToken = result.connectorToken;
  operatorName = result.name;
  connect();
  return { name: result.name };
});

ipcMain.handle('connector:logout', async () => {
  stopTunnel();
});

ipcMain.handle('connector:getStatus', async () => {
  if (!connectorToken) {
    const revoked = revokedMessage;
    revokedMessage = null; // shown once
    return { loggedOut: true, revokedMessage: revoked };
  }
  return {
    operatorName,
    connected: !!ws && ws.readyState === WebSocket.OPEN,
    services: Array.from(services.entries()).map(([name, s]) => ({ name, ...s })),
  };
});

ipcMain.handle('connector:addService', async (_event, { name, internalAddress }) => {
  services.set(name, { internalAddress, enabled: true });
  saveServices(services);
  register();
});

ipcMain.handle('connector:removeService', async (_event, name) => {
  services.delete(name);
  saveServices(services);
  register();
});

ipcMain.handle('connector:toggleService', async (_event, { name, enabled }) => {
  const s = services.get(name);
  if (s) { s.enabled = enabled; saveServices(services); register(); }
});
