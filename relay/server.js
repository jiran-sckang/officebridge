const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const WebSocket = require('ws');

const auth = require('./auth');
const policy = require('./policy');
const rules = require('./rules');
const audit = require('./audit');
const tunnel = require('./tunnel');
const portal = require('./portal');
const admin = require('./admin');
const connectorApi = require('./connectorApi');
const { loginPage, blockPage } = require('./theme');
const { DOMAIN, PORT, COOKIE_NAME, TENANT_NAME } = require('./config');

const CERT_DIR = path.join(__dirname, '..', 'certs');
const DOWNLOADS_DIR = path.join(__dirname, '..', 'downloads');
// Both apps are safe to serve publicly: neither installer embeds a secret
// (no per-employee config baked in, no shared static token) — the real
// security boundary is login, at /_ob/api/bridge/register and
// /_ob/api/connector/register respectively.
const DOWNLOADABLE_FILES = {
  'officebridge-bridge-mac.zip': 'application/zip',
  'officebridge-connector-app-mac.zip': 'application/zip',
};

// ---- small HTTP helpers ------------------------------------------------

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readFormBody(req) {
  const buf = await readBody(req);
  const params = new URLSearchParams(buf.toString('utf8'));
  const out = {};
  for (const [k, v] of params) out[k] = v;
  return out;
}

function clientIp(req) {
  return (req.socket.remoteAddress || '').replace('::ffff:', '');
}

// Strips only our own session cookie before forwarding to the internal
// system — any other cookies (e.g. a real app's own login session) pass
// through untouched, since they're not ours to remove.
function sanitizeHeaders(headers, cookies) {
  const out = { ...headers };
  delete out.host;
  delete out.connection;
  const rest = { ...cookies };
  delete rest[COOKIE_NAME];
  const kept = Object.entries(rest).map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  if (kept.length) out.cookie = kept.join('; ');
  else delete out.cookie;
  return out;
}

// An upstream app's Set-Cookie often carries its own Domain=its-real-host,
// which the browser will reject outright since it doesn't match the
// <service>.sslip.io host it thinks it's talking to. Stripping Domain lets
// the cookie default-scope to the current (relay) host instead.
function stripCookieDomain(headers) {
  if (!headers['set-cookie']) return headers;
  const list = Array.isArray(headers['set-cookie']) ? headers['set-cookie'] : [headers['set-cookie']];
  return { ...headers, 'set-cookie': list.map((c) => c.replace(/;\s*Domain=[^;]*/i, '')) };
}

function setCookie(res, sessionId) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${sessionId}; Domain=.${DOMAIN}; Path=/; HttpOnly; SameSite=Lax`);
}

function clearCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Domain=.${DOMAIN}; Path=/; HttpOnly; Max-Age=0`);
}

function sendHtml(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function sendBlockPage(res, status, opts) {
  sendHtml(res, status, blockPage(opts));
}

function redirectToLogin(res, hostHeader, originalUrl) {
  const next = encodeURIComponent(`https://${hostHeader}${originalUrl}`);
  res.writeHead(302, { Location: `https://${hostHeader}/_ob/login?next=${next}` });
  res.end();
}

// ---- internal /_ob/* routes --------------------------------------------

async function handleInternal(req, res, ctx) {
  const { pathname, parsedUrl, sessionId, ip, hostHeader } = ctx;

  if (pathname === '/_ob/login' && req.method === 'GET') {
    const next = parsedUrl.searchParams.get('next') || `https://portal.${DOMAIN}/`;
    return sendHtml(res, 200, loginPage({ next, error: parsedUrl.searchParams.get('error') ? '로그인에 실패했습니다.' : '' }));
  }

  if (pathname === '/_ob/login' && req.method === 'POST') {
    const body = await readFormBody(req);
    const result = auth.login(body.email, body.password, ip);
    if (!result.ok) {
      audit.log({ type: 'LOGIN', verdict: 'FAIL', user: body.email, service: '-', ip, reason: result.reason });
      return sendHtml(res, 401, loginPage({ next: body.next, error: result.reason }));
    }
    audit.log({ type: 'LOGIN', verdict: 'OK', user: body.email, service: '-', ip, reason: '로그인 성공' });
    setCookie(res, result.sessionId);
    res.writeHead(302, { Location: body.next || `https://portal.${DOMAIN}/` });
    return res.end();
  }

  if (pathname === '/_ob/logout') {
    const session = auth.getSession(sessionId);
    if (session) {
      audit.log({ type: 'LOGOUT', verdict: 'OK', user: session.email, service: '-', ip, reason: '로그아웃' });
      auth.destroySession(sessionId);
    }
    clearCookie(res);
    res.writeHead(302, { Location: `https://portal.${DOMAIN}/_ob/login` });
    return res.end();
  }

  if (pathname === '/_ob/api/logs') {
    const session = auth.getSession(sessionId);
    if (!session || session.role !== 'admin') {
      res.writeHead(403);
      return res.end('forbidden');
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const unsubscribe = audit.subscribe((event) => {
      const cls = event.verdict === 'ALLOW' || event.verdict === 'OK' ? 'badge-ok' : (event.verdict === 'DENY' || event.verdict === 'FAIL' ? 'badge-deny' : 'badge-warn');
      const html = `<div class="log-line">[${new Date(event.ts).toLocaleString('ko-KR')}] <b>${event.type}</b> <span class="${cls}">${event.verdict}</span> ${event.user} → ${event.service} (${event.ip}) ${event.reason || ''}</div>`;
      res.write(`data: ${html}\n\n`);
    });
    req.on('close', unsubscribe);
    return;
  }

  // F-11 개인 브릿지: exchanges a personal bridge token (issued from the org
  // chart page) for a real session — no password, but otherwise identical to
  // a normal login. Public by design: the token itself is the credential.
  if (pathname === '/_ob/api/bridge/exchange' && req.method === 'POST') {
    let body;
    try {
      body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    } catch {
      res.writeHead(400);
      return res.end('bad request');
    }
    const result = auth.exchangeBridgeToken(body.token, ip);
    if (!result.ok) {
      audit.log({ type: 'LOGIN', verdict: 'FAIL', user: '-', service: '-', ip, reason: `개인 브릿지 토큰 인증 실패: ${result.reason}` });
      res.writeHead(401);
      return res.end('unauthorized');
    }
    audit.log({ type: 'LOGIN', verdict: 'OK', user: result.email, service: '-', ip, reason: '개인 브릿지 로그인' });
    const allowed = policy.effectiveServices(result.user);
    const services = Object.entries(policy.getServices())
      .filter(([name]) => allowed.has(name))
      .map(([name, s]) => ({ name, label: s.label, url: `https://${name}.${DOMAIN}/` }));
    return sendJson(res, 200, {
      sessionId: result.sessionId,
      name: result.user.name,
      dept: result.user.dept,
      services,
    });
  }

  // F-11 bridge app one-time setup: the app itself asks for company code +
  // email + password and trades them directly for a personal bridge token —
  // no admin has to generate and hand over a file. Public by design, same
  // as the exchange endpoint above; the password itself is the credential.
  if (pathname === '/_ob/api/bridge/register' && req.method === 'POST') {
    let body;
    try {
      body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    } catch {
      res.writeHead(400);
      return res.end('bad request');
    }
    if (body.companyCode !== TENANT_NAME) {
      audit.log({ type: 'LOGIN', verdict: 'FAIL', user: body.email || '-', service: '-', ip, reason: `브릿지 앱 등록 실패: 회사코드 불일치 (${body.companyCode})` });
      res.writeHead(401);
      return res.end('회사코드가 올바르지 않습니다.');
    }
    const result = auth.registerBridge(body.email, body.password);
    if (!result.ok) {
      audit.log({ type: 'LOGIN', verdict: 'FAIL', user: body.email || '-', service: '-', ip, reason: `브릿지 앱 등록 실패: ${result.reason}` });
      res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(result.reason);
    }
    audit.log({ type: 'ADMIN', verdict: 'OK', user: body.email, service: '-', ip, reason: '브릿지 앱 최초 등록' });
    return sendJson(res, 200, { bridgeToken: result.bridgeToken, name: result.user.name, dept: result.user.dept });
  }

  // Connector operator login: an admin authenticates directly (same
  // company code + portal credentials) and gets back a personal connector
  // token. This replaces the old single hardcoded shared CONNECTOR_TOKEN —
  // operating a connector now requires an actual admin login, and each
  // login is individually attributable (tunnel.js records who) and
  // revocable (org chart / dashboard can kill it).
  if (pathname === '/_ob/api/connector/register' && req.method === 'POST') {
    let body;
    try {
      body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    } catch {
      res.writeHead(400);
      return res.end('bad request');
    }
    if (body.companyCode !== TENANT_NAME) {
      audit.log({ type: 'LOGIN', verdict: 'FAIL', user: body.email || '-', service: '-', ip, reason: `커넥터 앱 등록 실패: 회사코드 불일치 (${body.companyCode})` });
      res.writeHead(401);
      return res.end('회사코드가 올바르지 않습니다.');
    }
    const result = auth.registerConnector(body.email, body.password);
    if (!result.ok) {
      audit.log({ type: 'LOGIN', verdict: 'FAIL', user: body.email || '-', service: '-', ip, reason: `커넥터 앱 등록 실패: ${result.reason}` });
      res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(result.reason);
    }
    audit.log({ type: 'ADMIN', verdict: 'OK', user: body.email, service: '-', ip, reason: '커넥터 앱 로그인' });
    return sendJson(res, 200, { connectorToken: result.connectorToken, name: result.user.name });
  }

  // Hands a session already created via the bridge exchange above to the
  // browser as a cookie, then redirects on — the bridge app never handles
  // the browser's cookie jar directly, it just opens this URL.
  if (pathname === '/_ob/bridge-enter') {
    const sid = parsedUrl.searchParams.get('sid');
    const session = auth.getSession(sid);
    if (!session) {
      return sendBlockPage(res, 401, { code: 401, title: '세션 만료', message: '브릿지 세션이 유효하지 않습니다. 앱에서 다시 시도해주세요.' });
    }
    setCookie(res, sid);
    const next = parsedUrl.searchParams.get('next') || `https://portal.${DOMAIN}/`;
    res.writeHead(302, { Location: next });
    return res.end();
  }

  // Connector-facing read-only API: auth is the shared connector token (the
  // same one used to open the tunnel), not a browser session, since the
  // caller is the connector's own local admin web UI, not a logged-in user.
  if (pathname.startsWith('/_ob/api/connector/')) {
    const token = parsedUrl.searchParams.get('token');
    if (!tunnel.validateToken(token)) {
      res.writeHead(401);
      return res.end('unauthorized');
    }
    const action = pathname.replace('/_ob/api/connector/', '');
    if (action === 'policy') {
      return sendJson(res, 200, connectorApi.policySnapshot());
    }
    if (action === 'logs') {
      const limit = Number(parsedUrl.searchParams.get('limit') || '50');
      return sendJson(res, 200, connectorApi.recentLogs(limit));
    }
    res.writeHead(404);
    return res.end('not found');
  }

  // Public file downloads (the bridge app installer). No session required —
  // the installer itself carries no secrets (no per-employee config baked
  // in), so it's safe to link directly. The real gate is
  // /_ob/api/bridge/register (company code + password) once it's running.
  if (pathname.startsWith('/_ob/downloads/')) {
    const fileName = pathname.replace('/_ob/downloads/', '');
    const contentType = DOWNLOADABLE_FILES[fileName];
    if (!contentType) {
      res.writeHead(404);
      return res.end('not found');
    }
    const filePath = path.join(DOWNLOADS_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('파일이 아직 서버에 준비되지 않았습니다.');
    }
    audit.log({ type: 'SYSTEM', verdict: 'OK', user: '-', service: '-', ip, reason: `설치파일 다운로드: ${fileName}` });
    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    return fs.createReadStream(filePath).pipe(res);
  }

  if (pathname.startsWith('/_ob/api/admin/')) {
    const session = auth.getSession(sessionId);
    if (!session || session.role !== 'admin') {
      res.writeHead(403);
      return res.end('forbidden');
    }
    const actionKey = pathname.replace('/_ob/api/admin/', '');
    const fn = admin.actions[actionKey];
    if (!fn) {
      res.writeHead(404);
      return res.end('not found');
    }
    const body = await readFormBody(req);
    fn(body, session, ip);
    res.writeHead(302, { Location: req.headers.referer || `https://admin.${DOMAIN}/dashboard` });
    return res.end();
  }

  res.writeHead(404);
  res.end('not found');
}

// ---- main request pipeline ---------------------------------------------

async function mainHandler(req, res) {
  const hostHeader = (req.headers.host || '').split(':')[0];
  const label = hostHeader.split('.')[0];
  const parsedUrl = new URL(req.url, `https://${hostHeader}`);
  const pathname = parsedUrl.pathname;
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[COOKIE_NAME];
  const ip = clientIp(req);

  if (pathname.startsWith('/_ob/')) {
    return handleInternal(req, res, { pathname, parsedUrl, sessionId, ip, hostHeader });
  }

  const session = auth.getSession(sessionId);
  if (!session) {
    return redirectToLogin(res, hostHeader, req.url);
  }

  const violation = rules.checkContinuous(session, ip);
  if (violation) {
    audit.log({ type: 'ACCESS', verdict: 'DENY', user: session.email, service: label, ip, reason: violation.reason });
    if (violation.terminateSession) {
      auth.destroySession(sessionId);
      clearCookie(res);
    }
    return sendBlockPage(res, 403, { code: 403, title: '접근 차단', message: violation.reason });
  }

  if (label === 'admin') {
    if (session.role !== 'admin') {
      audit.log({ type: 'ACCESS', verdict: 'DENY', user: session.email, service: 'admin', ip, reason: '관리자 권한 없음' });
      return sendBlockPage(res, 403, { code: 403, title: '접근 차단', message: '관리자 권한이 없습니다.' });
    }
    const page = admin.renderPage(pathname, session, Object.fromEntries(parsedUrl.searchParams));
    if (!page) {
      res.writeHead(302, { Location: `https://admin.${DOMAIN}/dashboard` });
      return res.end();
    }
    return sendHtml(res, 200, page);
  }

  if (label === 'portal') {
    return sendHtml(res, 200, portal.renderPortal(session));
  }

  const service = policy.getService(label);
  if (!service) {
    return sendBlockPage(res, 404, { code: 404, icon: '❓', title: '알 수 없는 시스템', message: `"${label}" 은(는) 등록되지 않은 시스템입니다.` });
  }

  if (!policy.isAllowed(session, label)) {
    audit.log({ type: 'ACCESS', verdict: 'DENY', user: session.email, service: label, ip, reason: '정책 미허용' });
    return sendBlockPage(res, 403, {
      code: 403,
      title: '접근 차단',
      message: '이 시스템에 대한 접근 권한이 없습니다.',
      detail: '권한 없는 시스템엔 요청이 사내망에 도달조차 하지 않습니다.',
    });
  }

  if (!tunnel.servesService(label)) {
    audit.log({ type: 'SYSTEM', verdict: 'FAIL', user: session.email, service: label, ip, reason: '커넥터 연결 없음' });
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('503 Service Unavailable: 커넥터가 연결되어 있지 않습니다.');
  }

  const bodyBuffer = await readBody(req);
  try {
    const result = await tunnel.forward(label, req.method, req.url, sanitizeHeaders(req.headers, cookies), bodyBuffer);
    audit.log({ type: 'ACCESS', verdict: 'ALLOW', user: session.email, service: label, ip, reason: '허용' });
    res.writeHead(result.status, stripCookieDomain(result.headers || {}));
    res.end(result.body ? Buffer.from(result.body, 'base64') : undefined);
  } catch (err) {
    audit.log({ type: 'SYSTEM', verdict: 'FAIL', user: session.email, service: label, ip, reason: err.message });
    if (err.code === 'TIMEOUT') {
      res.writeHead(504, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('504 Gateway Timeout: 사내 시스템이 응답하지 않습니다.');
    }
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('503 Service Unavailable');
  }
}

// ---- bootstrap ----------------------------------------------------------

const server = https.createServer(
  {
    cert: fs.readFileSync(path.join(CERT_DIR, 'cert.pem')),
    key: fs.readFileSync(path.join(CERT_DIR, 'key.pem')),
  },
  (req, res) => {
    mainHandler(req, res).catch((err) => {
      console.error('[relay] request handler error:', err);
      res.writeHead(500);
      res.end('500 Internal Server Error');
    });
  }
);

const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const parsedUrl = new URL(req.url, 'https://x');
  if (parsedUrl.pathname !== '/tunnel') {
    socket.destroy();
    return;
  }
  const token = parsedUrl.searchParams.get('token');
  if (!tunnel.validateToken(token)) {
    console.log('[relay] rejected connector: bad token');
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => tunnel.acceptConnection(ws, token));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[relay] OfficeBridge listening on https://*.${DOMAIN}:${PORT} (0.0.0.0:${PORT})`);
});
