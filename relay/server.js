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
const { DOMAIN, PORT, COOKIE_NAME } = require('./config');

const CERT_DIR = path.join(__dirname, '..', 'certs');

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
  wss.handleUpgrade(req, socket, head, (ws) => tunnel.acceptConnection(ws));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[relay] OfficeBridge listening on https://*.${DOMAIN}:${PORT} (0.0.0.0:${PORT})`);
});
