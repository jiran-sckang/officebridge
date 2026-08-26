const auth = require('./auth');
const policy = require('./policy');
const rules = require('./rules');
const audit = require('./audit');
const tunnel = require('./tunnel');
const { shell } = require('./theme');
const { TENANT_NAME, DOMAIN } = require('./config');

const ICON = {
  dashboard: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  apps: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/></svg>',
  access: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/></svg>',
  rules: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 12 8 12 10 6 14 18 16 12 21 12"/></svg>',
  sessions: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  logSystem: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>',
  logAdmin: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>',
};

const NAV = [
  { path: '/dashboard', label: '대시보드', icon: ICON.dashboard },
  { group: '정책 설정' },
  { path: '/policy/apps', label: '사내시스템 현황', icon: ICON.apps },
  { path: '/policy/access', label: '정책 접근관리', icon: ICON.access },
  { path: '/policy/rules', label: '행위 기반 제어', icon: ICON.rules },
  { path: '/policy/sessions', label: '활성세션·계정통제', icon: ICON.sessions },
  { group: '로그 조회' },
  { path: '/logs/system', label: '시스템 접속로그', icon: ICON.logSystem },
  { path: '/logs/admin', label: '관리자 로그', icon: ICON.logAdmin },
];

function initial(name) {
  return (name || '?').trim().slice(0, 1).toUpperCase();
}

function adminShell(activePath, session, title, bodyHtml) {
  const nav = NAV.map((item) =>
    item.group
      ? `<div class="group">${item.group}</div>`
      : `<a href="${item.path}" class="${item.path === activePath ? 'active' : ''}">${item.icon}<span>${item.label}</span></a>`
  ).join('');

  const activeItem = NAV.find((item) => item.path === activePath);
  const activeGroup = activeItem ? [...NAV].slice(0, NAV.indexOf(activeItem)).reverse().find((i) => i.group) : null;

  return shell(title, `
    <div class="topbar">
      <div class="brand">Office<span>Bridge</span> <span class="tenant-badge">${TENANT_NAME} 관리자 콘솔</span></div>
      <details class="user-menu">
        <summary><span class="avatar">${initial(session.name)}</span>${session.name}</summary>
        <div class="menu">
          <div class="who-line">${session.name} · ${session.dept}</div>
          <a href="https://portal.${DOMAIN}/">임직원 포털</a>
          <a href="/_ob/logout">로그아웃</a>
        </div>
      </details>
    </div>
    <div class="layout">
      <div class="sidebar">${nav}</div>
      <div class="main">
        <div class="breadcrumb">${activeGroup ? `${activeGroup.group} / ` : ''}<b>${title}</b></div>
        <h1>${title}</h1>
        ${bodyHtml}
      </div>
    </div>
  `);
}

function fmtTime(ms) {
  if (!ms) return '-';
  return new Date(ms).toLocaleString('ko-KR');
}

// ---- Page renderers -------------------------------------------------

function renderDashboard(session) {
  const activeSessions = auth.listActiveSessions().length;
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const todayBlocked = audit.getRecent({ limit: 1000 }).filter(
    (e) => new Date(e.ts).getTime() >= startOfDay.getTime() && (e.verdict === 'DENY' || e.verdict === 'FAIL')
  ).length;
  const connectorState = tunnel.isConnected()
    ? `<span class="badge-ok">연결됨</span> (${tunnel.getRegisteredServices().join(', ') || '서비스 없음'})`
    : `<span class="badge-deny">연결 안됨</span>`;

  const recent = audit.getRecent({ limit: 40 })
    .map((e) => logLineHtml(e))
    .join('');

  return adminShell('/dashboard', session, '대시보드', `
    <div class="tiles">
      <div class="tile"><div class="tile-icon">${ICON.sessions}</div><div><div class="num">${activeSessions}</div><div class="label">활성 세션</div></div></div>
      <div class="tile"><div class="tile-icon">${ICON.rules}</div><div><div class="num">${todayBlocked}</div><div class="label">오늘 차단/실패 건수</div></div></div>
      <div class="tile"><div class="tile-icon">${ICON.apps}</div><div><div class="num" style="font-size:16px">${connectorState}</div><div class="label">커넥터 상태</div></div></div>
    </div>
    <div class="card">
      <div style="margin-bottom:10px;color:var(--muted);font-size:12px">실시간 접속 로그</div>
      <div id="log">${recent}</div>
    </div>
    <script>
      const log = document.getElementById('log');
      const es = new EventSource('/_ob/api/logs');
      es.onmessage = (ev) => {
        const div = document.createElement('div');
        div.innerHTML = ev.data;
        log.prepend(div.firstChild);
      };
    </script>
  `);
}

function logLineHtml(e) {
  const cls = e.verdict === 'ALLOW' || e.verdict === 'OK' ? 'badge-ok' : (e.verdict === 'DENY' || e.verdict === 'FAIL' ? 'badge-deny' : 'badge-warn');
  return `<div class="log-line">[${fmtTime(new Date(e.ts).getTime())}] <b>${e.type}</b> <span class="${cls}">${e.verdict}</span> ${e.user} → ${e.service} (${e.ip}) ${e.reason || ''}</div>`;
}

function renderPolicyApps(session) {
  const services = policy.getServices();
  const names = Object.keys(services);

  const rows = names
    .map((name) => {
      const s = services[name];
      const live = tunnel.servesService(name);
      const address = tunnel.getRegisteredServiceAddress(name);
      const status = live
        ? `<span class="tag-ok">연결 가능</span>`
        : `<span class="tag-deny">연결 안됨</span>`;
      return `<tr>
        <td>${name}</td>
        <td>
          <form class="inline" method="POST" action="/_ob/api/admin/services/label">
            <input type="hidden" name="name" value="${name}">
            <input type="text" name="label" value="${s.label}" style="width:140px;display:inline-block;margin:0" onchange="this.form.requestSubmit()">
          </form>
        </td>
        <td>${address ? address : '<span class="muted">커넥터 미보고</span>'}</td>
        <td>${status}</td>
      </tr>`;
    })
    .join('');

  return adminShell('/policy/apps', session, '사내시스템 현황', `
    <div class="card">
      <div style="margin-bottom:10px;color:var(--muted);font-size:12px">
        서비스명·내부주소·연결가능 여부는 커넥터가 실시간으로 보고하는 값입니다 — 여기서는 등록/추가할 수 없고,
        표시용 라벨만 고칠 수 있습니다. 새 시스템을 열려면 그 시스템을 담당하는 커넥터의 로컬 관리 웹에서 추가하세요.
      </div>
      <table>
        <thead><tr><th>서비스명</th><th>라벨</th><th>내부주소 (커넥터 보고)</th><th>상태</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4">커넥터가 보고한 시스템이 아직 없습니다.</td></tr>'}</tbody>
      </table>
    </div>
  `);
}

function renderPolicyAccess(session) {
  const services = policy.getServices();
  const deptPolicy = policy.getDeptPolicy();
  const grants = policy.getGrants();
  const users = auth.listUsers();
  const serviceNames = Object.keys(services);

  const deptRows = Object.keys(deptPolicy)
    .map((dept) => {
      const cells = serviceNames.map((name) => {
        const on = (deptPolicy[dept] || []).includes(name);
        return chipForm('/policy/dept', { dept, service: name, allow: on ? '0' : '1' }, `${services[name].label} ${on ? '✓' : ''}`, on);
      }).join(' ');
      return `<tr><td>${dept}</td><td>${cells}</td></tr>`;
    }).join('');

  const userRows = Object.entries(users)
    .filter(([, u]) => u.role !== 'admin')
    .map(([email, u]) => {
      const cells = serviceNames.map((name) => {
        const on = (grants[email] || []).includes(name);
        return chipForm('/policy/individual', { email, service: name, allow: on ? '0' : '1' }, `${services[name].label} ${on ? '✓' : ''}`, on);
      }).join(' ');
      return `<tr><td>${u.name} (${email})</td><td>${cells}</td></tr>`;
    }).join('');

  return adminShell('/policy/access', session, '정책 접근관리', `
    <div class="card">
      <div style="margin-bottom:10px;font-weight:600">부서 정책</div>
      <table><thead><tr><th>부서</th><th>허용 시스템</th></tr></thead><tbody>${deptRows}</tbody></table>
    </div>
    <div class="card">
      <div style="margin-bottom:10px;font-weight:600">개인 추가 권한 (부서 정책 위에 더해짐)</div>
      <table><thead><tr><th>사용자</th><th>개인 허용</th></tr></thead><tbody>${userRows}</tbody></table>
    </div>
  `);
}

function chipForm(actionPath, fields, label, on) {
  const hidden = Object.entries(fields).map(([k, v]) => `<input type="hidden" name="${k}" value="${v}">`).join('');
  return `<form class="inline" method="POST" action="/_ob/api/admin${actionPath}">${hidden}<button class="chip ${on ? 'on' : 'off'}" type="submit">${label}</button></form>`;
}

const RULE_LABELS = {
  businessHours: '업무시간 외 접속 차단',
  rateLimit: '과도한 요청 차단 (10초 내 다회 반복)',
  sessionIpPin: '세션 IP 고정 (탈취 방지, 위반 시 세션 종료)',
  loginLockout: '로그인 연속 실패 계정 잠금',
  sessionMaxAge: '세션 최대 수명 제한',
  endpointSecurityScore: '엔드포인트 연동 (OfficeKeeper PC 보안점수) — UI만 구현, 판정 로직 연동 예정',
};

function renderPolicyRules(session) {
  const config = rules.getConfig();
  const rows = Object.entries(RULE_LABELS)
    .map(([key, label]) => {
      const c = config[key];
      const on = c.enabled;
      const uiOnly = c.uiOnly ? ' <span class="badge-warn">(uiOnly)</span>' : '';
      return `<tr>
        <td>${label}${uiOnly}</td>
        <td>${chipForm('/rules', { rule: key, enabled: on ? '0' : '1' }, on ? 'ON' : 'OFF', on)}</td>
      </tr>`;
    }).join('');

  return adminShell('/policy/rules', session, '행위 기반 제어', `
    <div class="card">
      <table><thead><tr><th>룰</th><th>상태</th></tr></thead><tbody>${rows}</tbody></table>
    </div>
  `);
}

function renderSessions(session) {
  const sessions = auth.listActiveSessions();
  const sessRows = sessions.map((s) => `
    <tr>
      <td>${s.name} (${s.email})</td><td>${s.ip}</td><td>${fmtTime(s.loginAt)}</td><td>${fmtTime(s.lastSeenAt)}</td>
      <td><form class="inline" method="POST" action="/_ob/api/admin/sessions/terminate">
        <input type="hidden" name="sessionId" value="${s.id}">
        <button class="btn danger" type="submit">세션 종료</button>
      </form></td>
    </tr>`).join('');

  const users = auth.listUsers();
  const userRows = Object.entries(users).map(([email, u]) => {
    const locked = u.lockedUntil && Date.now() < u.lockedUntil;
    return `<tr>
      <td>${u.name} (${email})</td><td>${u.dept}</td>
      <td>${u.blocked ? '<span class="badge-deny">차단됨</span>' : '<span class="badge-ok">정상</span>'}</td>
      <td>${locked ? `<span class="badge-warn">잠김 (~${fmtTime(u.lockedUntil)})</span>` : '-'}</td>
      <td>
        <form class="inline" method="POST" action="/_ob/api/admin/users/${u.blocked ? 'unblock' : 'block'}">
          <input type="hidden" name="email" value="${email}">
          <button class="btn ${u.blocked ? 'ghost' : 'danger'}" type="submit">${u.blocked ? '차단 해제' : '계정 차단'}</button>
        </form>
        ${locked ? `<form class="inline" method="POST" action="/_ob/api/admin/users/unlock">
          <input type="hidden" name="email" value="${email}">
          <button class="btn ghost" type="submit">잠금 해제</button>
        </form>` : ''}
      </td>
    </tr>`;
  }).join('');

  return adminShell('/policy/sessions', session, '활성세션·계정통제', `
    <div class="card">
      <div style="margin-bottom:10px;font-weight:600">활성 세션</div>
      <table><thead><tr><th>사용자</th><th>IP</th><th>로그인</th><th>최근활동</th><th></th></tr></thead><tbody>${sessRows || '<tr><td colspan="5">활성 세션 없음</td></tr>'}</tbody></table>
    </div>
    <div class="card">
      <div style="margin-bottom:10px;font-weight:600">계정 통제</div>
      <table><thead><tr><th>사용자</th><th>부서</th><th>상태</th><th>잠금</th><th></th></tr></thead><tbody>${userRows}</tbody></table>
    </div>
  `);
}

function renderLogsSystem(session, filter) {
  const all = audit.getRecent({ limit: 500 }).filter((e) => e.type !== 'ADMIN');
  const isAllow = (v) => v === 'ALLOW' || v === 'OK';
  const isDeny = (v) => v === 'DENY' || v === 'FAIL';
  let rows = all;
  if (filter === 'allow') rows = all.filter((e) => isAllow(e.verdict));
  if (filter === 'deny') rows = all.filter((e) => isDeny(e.verdict));

  const trs = rows.map((e) => `<tr><td>${fmtTime(new Date(e.ts).getTime())}</td><td>${e.type}</td>
    <td class="${isAllow(e.verdict) ? 'badge-ok' : (isDeny(e.verdict) ? 'badge-deny' : 'badge-warn')}">${e.verdict}</td>
    <td>${e.user}</td><td>${e.service}</td><td>${e.ip}</td><td>${e.reason || ''}</td></tr>`).join('');

  const f = (key, label) => `<a href="/logs/system${key ? '?f=' + key : ''}" class="${filter === key || (!filter && !key) ? 'active' : ''}">${label}</a>`;

  return adminShell('/logs/system', session, '시스템 접속로그', `
    <div class="filters" style="margin-bottom:14px">${f('', '전체')} ${f('allow', '허용')} ${f('deny', '차단')}</div>
    <div class="card">
      <table><thead><tr><th>시각</th><th>종류</th><th>판정</th><th>사용자</th><th>시스템</th><th>IP</th><th>사유</th></tr></thead><tbody>${trs}</tbody></table>
    </div>
  `);
}

function renderLogsAdmin(session) {
  const rows = audit.getRecent({ type: 'ADMIN', limit: 500 })
    .map((e) => `<tr><td>${fmtTime(new Date(e.ts).getTime())}</td><td>${e.user}</td><td>${e.reason}</td></tr>`)
    .join('');

  return adminShell('/logs/admin', session, '관리자 로그', `
    <div class="card">
      <table><thead><tr><th>시각</th><th>관리자</th><th>조치 내용</th></tr></thead><tbody>${rows}</tbody></table>
    </div>
  `);
}

function renderPage(pathname, session, query) {
  switch (pathname) {
    case '/dashboard': return renderDashboard(session);
    case '/policy/apps': return renderPolicyApps(session);
    case '/policy/access': return renderPolicyAccess(session);
    case '/policy/rules': return renderPolicyRules(session);
    case '/policy/sessions': return renderSessions(session);
    case '/logs/system': return renderLogsSystem(session, query.f);
    case '/logs/admin': return renderLogsAdmin(session);
    default: return null;
  }
}

// ---- Actions (mutations triggered from admin forms) ------------------

const actions = {
  'services/label'(body, session, ip) {
    const { name, label } = body;
    policy.setLabel(name, label);
    audit.log({ type: 'ADMIN', verdict: 'OK', user: session.email, service: name, ip, reason: `라벨 변경: ${name} → ${label}` });
  },
  'policy/dept'(body, session, ip) {
    const { dept, service, allow } = body;
    policy.toggleDeptAccess(dept, service, allow === '1');
    audit.log({ type: 'ADMIN', verdict: 'OK', user: session.email, service, ip, reason: `부서 정책 변경: ${dept} → ${service} ${allow === '1' ? '부여' : '회수'}` });
  },
  'policy/individual'(body, session, ip) {
    const { email, service, allow } = body;
    policy.toggleIndividualGrant(email, service, allow === '1');
    audit.log({ type: 'ADMIN', verdict: 'OK', user: session.email, service, ip, reason: `개인 권한 변경: ${email} → ${service} ${allow === '1' ? '부여' : '회수'}` });
  },
  rules(body, session, ip) {
    const { rule, enabled } = body;
    const current = rules.getConfig();
    rules.setConfig({ [rule]: { ...current[rule], enabled: enabled === '1' } });
    audit.log({ type: 'ADMIN', verdict: 'OK', user: session.email, service: rule, ip, reason: `행위 기반 룰 ${rule} ${enabled === '1' ? 'ON' : 'OFF'}` });
  },
  'sessions/terminate'(body, session, ip) {
    const { sessionId } = body;
    const target = auth.listActiveSessions().find((s) => s.id === sessionId);
    auth.destroySession(sessionId);
    audit.log({ type: 'ADMIN', verdict: 'OK', user: session.email, service: '-', ip, reason: `세션 강제 종료: ${target ? target.email : sessionId}` });
  },
  'users/block'(body, session, ip) {
    auth.blockUser(body.email);
    audit.log({ type: 'ADMIN', verdict: 'OK', user: session.email, service: '-', ip, reason: `계정 차단: ${body.email}` });
  },
  'users/unblock'(body, session, ip) {
    auth.unblockUser(body.email);
    audit.log({ type: 'ADMIN', verdict: 'OK', user: session.email, service: '-', ip, reason: `계정 차단 해제: ${body.email}` });
  },
  'users/unlock'(body, session, ip) {
    auth.unlockUser(body.email);
    audit.log({ type: 'ADMIN', verdict: 'OK', user: session.email, service: '-', ip, reason: `계정 잠금 해제: ${body.email}` });
  },
};

module.exports = { renderPage, actions };
