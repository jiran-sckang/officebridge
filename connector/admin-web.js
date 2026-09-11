// Local admin web UI for this connector. Runs on its own port, separate
// from the outbound tunnel. Lets the person operating this connector manage
// which internal systems (domains) it forwards to, and flip each on/off —
// a local policy layer independent of the relay's own admin console.
const http = require('http');
const { URL } = require('url');

const config = require('./config');
const state = require('./state');
const relayClient = require('./relay-client');

function escapeHtml(v) {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CSS = `
  :root {
    --blue: #0c51a1; --blue-dark: #08386f; --blue-tint: #eaf1fb;
    --bg: #f8fafc; --border: #e3e7ee; --text: #1a1a1a; --muted: #666666;
    --ok: #1a8a5f; --deny: #c73434;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Malgun Gothic', 'Nanum Barun Gothic', -apple-system, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); }
  .topbar { background: #fff; color: var(--blue); padding: 14px 24px; font-weight: 700; font-size: 16px; border-bottom: 1px solid var(--border); }
  .topbar span { color: var(--muted); font-weight: 400; margin-left: 8px; font-size: 12px; }
  .main { max-width: 780px; margin: 0 auto; padding: 24px 20px 60px; }
  h1 { font-size: 18px; margin: 0 0 4px; color: var(--text); }
  .sub { color: var(--muted); font-size: 13px; margin-bottom: 20px; }
  .card { background: #fff; border: 1px solid var(--border); border-radius: 4px; padding: 20px; margin-bottom: 18px; }
  .status { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; }
  .status.on { background: #e5f3ec; color: var(--ok); }
  .status.off { background: #fdeaea; color: var(--deny); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-size: 11px; text-transform: uppercase; background: var(--bg); }
  .pill { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 12px; border: 1px solid var(--border); cursor: pointer; background: #fff; }
  .pill.on { background: var(--blue-tint); color: var(--blue); border-color: #bcd3ef; }
  .pill.off { background: #f4f4f4; color: var(--muted); }
  form.inline { display: inline; }
  button { font: inherit; cursor: pointer; }
  .btn { background: var(--blue); color: #fff; border: none; padding: 8px 16px; border-radius: 4px; font-size: 13px; }
  .btn:hover { background: var(--blue-dark); }
  .btn.danger { background: var(--deny); }
  input[type=text] { padding: 8px 10px; border: 1px solid var(--border); border-radius: 4px; width: 100%; margin-bottom: 10px; }
  .row { display: flex; gap: 10px; }
  .row > div { flex: 1; }
  .tag { display: inline-block; padding: 2px 8px; margin: 2px 3px 2px 0; border-radius: 4px; font-size: 12px; background: var(--blue-tint); color: var(--blue-dark); }
  .badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .badge.ALLOW, .badge.OK { background: #e5f3ec; color: var(--ok); }
  .badge.DENY, .badge.FAIL { background: #fdeaea; color: var(--deny); }
  .muted { color: var(--muted); font-size: 13px; }
`;

function policyCard(policy, policyError) {
  if (policyError) {
    return `<div class="card"><span class="muted">릴레이에서 정책을 가져오지 못했습니다 (${escapeHtml(policyError)})</span></div>`;
  }
  const names = Object.keys(policy || {});
  if (!names.length) {
    return `<div class="card"><span class="muted">이 커넥터가 릴레이에 등록한 서비스가 없습니다.</span></div>`;
  }
  const rows = names
    .map((name) => {
      const s = policy[name];
      const depts = s.depts.length ? s.depts.map((d) => `<span class="tag">${escapeHtml(d)}</span>`).join('') : '<span class="muted">-</span>';
      const users = s.users.length ? s.users.map((u) => `<span class="tag">${escapeHtml(u)}</span>`).join('') : '<span class="muted">-</span>';
      return `<tr><td>${escapeHtml(s.label)} (${escapeHtml(name)})</td><td>${depts}</td><td>${users}</td></tr>`;
    })
    .join('');
  return `<div class="card">
    <table>
      <thead><tr><th>서비스</th><th>허용 부서</th><th>개인 허용</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function logsCard(logs, logsError) {
  if (logsError) {
    return `<div class="card"><span class="muted">릴레이에서 로그를 가져오지 못했습니다 (${escapeHtml(logsError)})</span></div>`;
  }
  if (!logs || !logs.length) {
    return `<div class="card"><span class="muted">최근 접속 기록이 없습니다.</span></div>`;
  }
  const rows = logs
    .map(
      (e) => `<tr>
        <td>${escapeHtml(new Date(e.ts).toLocaleString('ko-KR'))}</td>
        <td>${escapeHtml(e.user)}</td>
        <td>${escapeHtml(e.service)}</td>
        <td><span class="badge ${escapeHtml(e.verdict)}">${escapeHtml(e.verdict)}</span></td>
        <td>${escapeHtml(e.ip)}</td>
        <td>${escapeHtml(e.reason || '')}</td>
      </tr>`
    )
    .join('');
  return `<div class="card">
    <table>
      <thead><tr><th>시각</th><th>사용자</th><th>서비스</th><th>결과</th><th>IP</th><th>사유</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function page(services, connected, policy, policyError, logs, logsError) {
  const rows = services
    .map(
      (s) => `<tr>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.internalAddress)}</td>
        <td>
          <form class="inline" method="POST" action="/services/toggle">
            <input type="hidden" name="name" value="${escapeHtml(s.name)}">
            <input type="hidden" name="enabled" value="${s.enabled ? '0' : '1'}">
            <button class="pill ${s.enabled ? 'on' : 'off'}" type="submit">${s.enabled ? 'ON' : 'OFF'}</button>
          </form>
        </td>
        <td>
          <form class="inline" method="POST" action="/services/delete" onsubmit="return confirm('${escapeHtml(s.name)} 매핑을 삭제할까요?')">
            <input type="hidden" name="name" value="${escapeHtml(s.name)}">
            <button class="btn danger" type="submit">삭제</button>
          </form>
        </td>
      </tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>커넥터 관리</title><style>${CSS}</style></head>
<body>
  <div class="topbar">OfficeBridge 커넥터 관리<span>local admin</span></div>
  <div class="main">
    <h1>이 커넥터의 릴레이 연결 상태</h1>
    <div class="sub">릴레이: ${escapeHtml(config.RELAY_HOST)}:${escapeHtml(config.RELAY_PORT)}</div>
    <div class="card">
      <span class="status ${connected ? 'on' : 'off'}">${connected ? '연결됨' : '연결 안됨'}</span>
    </div>

    <h1>릴레이할 도메인(사내 시스템) 관리</h1>
    <div class="sub">여기서 끈(OFF) 서비스는 릴레이가 허용해도 이 커넥터가 전달하지 않습니다 — 로컬 정책입니다.</div>
    <div class="card">
      <table>
        <thead><tr><th>서비스명</th><th>내부주소</th><th>상태</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4">등록된 서비스 없음</td></tr>'}</tbody>
      </table>
    </div>

    <div class="card">
      <div style="margin-bottom:10px;font-weight:600">새 서비스(도메인) 추가</div>
      <form method="POST" action="/services">
        <div class="row">
          <div><input type="text" name="name" placeholder="서비스명 (릴레이에 등록된 이름과 동일해야 함, 예: erp)" required></div>
          <div><input type="text" name="internalAddress" placeholder="내부주소 (예: http://127.0.0.1:8081, SSH 등은 tcp://127.0.0.1:22)" required></div>
        </div>
        <button class="btn" type="submit">추가</button>
      </form>
    </div>

    <h1>정책 조회 <span class="sub" style="display:inline;font-weight:400">(릴레이 관리, 읽기 전용)</span></h1>
    <div class="sub">부서/개인별 허용 여부는 릴레이 관리자 콘솔에서만 변경할 수 있습니다. 여기서는 조회만 됩니다.</div>
    ${policyCard(policy, policyError)}

    <h1>최근 접속 로그 <span class="sub" style="display:inline;font-weight:400">(릴레이 감사로그, 읽기 전용)</span></h1>
    <div class="sub">이 커넥터가 담당하는 서비스로의 접속만 표시됩니다.</div>
    ${logsCard(logs, logsError)}
  </div>
</body></html>`;
}

function checkAuth(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  const [user, pass] = Buffer.from(header.slice(6), 'base64').toString('utf8').split(':');
  return user === config.ADMIN_USER && pass === config.ADMIN_PASSWORD;
}

function readFormBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const params = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
      resolve(Object.fromEntries(params));
    });
  });
}

function start({ isConnected }) {
  const server = http.createServer(async (req, res) => {
    if (!checkAuth(req)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="OfficeBridge Connector"' });
      return res.end('Authentication required');
    }

    const { pathname } = new URL(req.url, 'http://x');

    if (pathname === '/api/status' && req.method === 'GET') {
      const services = state.getAll().map((s) => ({
        ...s,
        url: `https://${s.name}.${config.PUBLIC_DOMAIN}/`,
      }));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({
        connected: isConnected(),
        relay: `${config.RELAY_HOST}:${config.RELAY_PORT}`,
        services,
      }));
    }

    if (pathname === '/' && req.method === 'GET') {
      const [policyResult, logsResult] = await Promise.allSettled([relayClient.getPolicy(), relayClient.getLogs(20)]);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(
        page(
          state.getAll(),
          isConnected(),
          policyResult.status === 'fulfilled' ? policyResult.value : null,
          policyResult.status === 'rejected' ? policyResult.reason.message : null,
          logsResult.status === 'fulfilled' ? logsResult.value : null,
          logsResult.status === 'rejected' ? logsResult.reason.message : null
        )
      );
    }

    if (pathname === '/services' && req.method === 'POST') {
      const { name, internalAddress } = await readFormBody(req);
      state.upsert(name, internalAddress, true);
      res.writeHead(302, { Location: '/' });
      return res.end();
    }

    if (pathname === '/services/toggle' && req.method === 'POST') {
      const { name, enabled } = await readFormBody(req);
      state.setEnabled(name, enabled === '1');
      res.writeHead(302, { Location: '/' });
      return res.end();
    }

    if (pathname === '/services/delete' && req.method === 'POST') {
      const { name } = await readFormBody(req);
      state.remove(name);
      res.writeHead(302, { Location: '/' });
      return res.end();
    }

    res.writeHead(404);
    res.end('not found');
  });

  server.listen(config.ADMIN_PORT, config.ADMIN_HOST, () => {
    console.log(`[connector] local admin UI on http://${config.ADMIN_HOST}:${config.ADMIN_PORT}/ (user: ${config.ADMIN_USER})`);
    if (config.ADMIN_PASSWORD === 'changeme') {
      console.warn('[connector] WARNING: ADMIN_PASSWORD is still the default "changeme" — change it in config.js');
    }
  });

  return server;
}

module.exports = start;
