// OfficeBridge connector menu bar companion.
// Reads the connector's local admin API (http://127.0.0.1:8090/api/status,
// same Basic Auth as the admin web) and shows tunnel status + a clickable
// list of registered internal systems. Clicking a system opens it in the
// default browser, going through the normal portal login/policy flow —
// this app has no knowledge of who's allowed into what, it's just a launcher.
const path = require('path');
const { menubar } = require('menubar');
const { ipcMain, shell } = require('electron');

const ADMIN_URL = process.env.OB_ADMIN_URL || 'http://127.0.0.1:8090';
const ADMIN_USER = process.env.OB_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.OB_ADMIN_PASSWORD || 'changeme';

const mb = menubar({
  index: `file://${path.join(__dirname, 'index.html')}`,
  icon: path.join(__dirname, 'assets', 'iconTemplate.png'),
  browserWindow: {
    width: 320,
    height: 420,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  },
  tooltip: 'OfficeBridge 커넥터',
});

mb.on('ready', () => {
  console.log('[menubar] ready');
});

ipcMain.handle('ob:getStatus', async () => {
  try {
    const auth = Buffer.from(`${ADMIN_USER}:${ADMIN_PASSWORD}`).toString('base64');
    const res = await fetch(`${ADMIN_URL}/api/status`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) throw new Error(`admin API responded ${res.status}`);
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('ob:openExternal', async (_event, url) => {
  await shell.openExternal(url);
});

ipcMain.handle('ob:openAdminWeb', async () => {
  await shell.openExternal(ADMIN_URL);
});
