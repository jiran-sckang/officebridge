// OfficeBridge Agent Bridge — personal desktop client (F-11).
// One-time setup: the employee enters their company code + normal portal
// email/password, and the app trades that directly for a personal bridge
// token — no admin has to generate and hand over a per-employee file.
// After that, every click does a fresh token exchange, so there's no local
// session to keep valid or expire — only the bridgeToken needs to persist.
const path = require('path');
const fs = require('fs');
const https = require('https');
const { app, ipcMain, shell } = require('electron');
const { menubar } = require('menubar');

// The relay this app talks to — baked in at build time for this prototype.
// A real multi-tenant build would resolve this from the company code via a
// directory service instead of hardcoding one relay.
const RELAY_DOMAIN = process.env.OB_RELAY_DOMAIN || '10-52-249-21.sslip.io';

const CONFIG_PATH = path.join(app.getPath('userData'), 'bridge-config.json');

function loadConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (raw && raw.relayDomain && raw.bridgeToken) return raw;
  } catch {
    // no config yet, or unreadable — treat as not set up
  }
  return null;
}

function saveConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

let config = loadConfig();

const mb = menubar({
  index: `file://${path.join(__dirname, 'index.html')}`,
  icon: path.join(__dirname, 'assets', 'iconTemplate.png'),
  browserWindow: {
    width: 300,
    height: 420,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  },
  tooltip: 'OfficeBridge',
});

// Self-signed relay cert in this prototype — scoped to just this outbound
// call, not process-wide, unlike a blunt NODE_TLS_REJECT_UNAUTHORIZED=0.
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
          try {
            resolve(JSON.parse(text));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function exchange() {
  if (!config) return { needsAuth: true };
  const result = await postJson(config.relayDomain, '/_ob/api/bridge/exchange', { token: config.bridgeToken });
  return { name: result.name, dept: result.dept, services: result.services };
}

ipcMain.handle('bridge:getStatus', async () => {
  try {
    return await exchange();
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('bridge:openService', async (_event, serviceUrl) => {
  // Fresh exchange right before opening — the sessionId only needs to be
  // valid for this one handoff, so there's nothing to keep fresh locally.
  const result = await postJson(config.relayDomain, '/_ob/api/bridge/exchange', { token: config.bridgeToken });
  const enterUrl = `https://${config.relayDomain}/_ob/bridge-enter?sid=${encodeURIComponent(result.sessionId)}&next=${encodeURIComponent(serviceUrl)}`;
  await shell.openExternal(enterUrl);
});

ipcMain.handle('bridge:register', async (_event, { companyCode, email, password }) => {
  const result = await postJson(RELAY_DOMAIN, '/_ob/api/bridge/register', { companyCode, email, password });
  config = { relayDomain: RELAY_DOMAIN, bridgeToken: result.bridgeToken };
  saveConfig(config);
  return { name: result.name, dept: result.dept };
});

ipcMain.handle('bridge:forget', async () => {
  config = null;
  try { fs.unlinkSync(CONFIG_PATH); } catch {}
});
