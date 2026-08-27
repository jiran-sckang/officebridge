// OfficeBridge Agent Bridge — personal desktop client (F-11).
// Imports a per-employee bridge config (issued from the relay's admin
// console org chart page) and lets the employee open their allowed
// internal systems with one click, without a separate portal login.
// Every click does a fresh token exchange, so there's no local session to
// keep valid or expire — the config file's bridgeToken is the only thing
// that needs to stay around.
const path = require('path');
const fs = require('fs');
const https = require('https');
const { app, ipcMain, shell, dialog } = require('electron');
const { menubar } = require('menubar');

const CONFIG_PATH = path.join(app.getPath('userData'), 'bridge-config.json');

function loadConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (raw && raw.relayDomain && raw.bridgeToken) return raw;
  } catch {
    // no config yet, or unreadable — treat as not configured
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
    height: 400,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  },
  tooltip: 'OfficeBridge',
});

function promptImportConfig() {
  const files = dialog.showOpenDialogSync(mb.window, {
    title: 'OfficeBridge 브릿지 설정파일 선택',
    filters: [{ name: 'OfficeBridge 브릿지 설정', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (!files || !files[0]) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(files[0], 'utf8'));
    if (!raw.relayDomain || !raw.bridgeToken) throw new Error('missing fields');
    config = raw;
    saveConfig(config);
    return true;
  } catch {
    dialog.showErrorBox('가져오기 실패', '유효한 OfficeBridge 브릿지 설정파일이 아닙니다.');
    return false;
  }
}

mb.on('ready', () => {
  if (!config) promptImportConfig();
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
          if (res.statusCode !== 200) return reject(new Error(`relay responded ${res.statusCode}`));
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
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
  if (!config) return { needsConfig: true };
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
  try {
    const result = await postJson(config.relayDomain, '/_ob/api/bridge/exchange', { token: config.bridgeToken });
    const enterUrl = `https://${config.relayDomain}/_ob/bridge-enter?sid=${encodeURIComponent(result.sessionId)}&next=${encodeURIComponent(serviceUrl)}`;
    await shell.openExternal(enterUrl);
  } catch (err) {
    dialog.showErrorBox('접속 실패', err.message);
  }
});

ipcMain.handle('bridge:importConfig', async () => {
  return promptImportConfig();
});

ipcMain.handle('bridge:forget', async () => {
  config = null;
  try { fs.unlinkSync(CONFIG_PATH); } catch {}
});
