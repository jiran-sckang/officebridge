const fs = require('fs');
const path = require('path');
const auth = require('./auth');
const policy = require('./policy');
const rules = require('./rules');
const audit = require('./audit');
const tunnel = require('./tunnel');
const { shell } = require('./theme');
const { TENANT_NAME, DOMAIN } = require('./config');

const DOWNLOADS_DIR = path.join(__dirname, '..', 'downloads');

const ICON = {
  dashboard: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  apps: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/></svg>',
  access: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/></svg>',
  rules: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 12 8 12 10 6 14 18 16 12 21 12"/></svg>',
  sessions: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  logSystem: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>',
  logAdmin: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>',
  download: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  org: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M12 8v4M12 12H5v4M12 12h7v4"/></svg>',
  company: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="17"/><line x1="4" y1="21" x2="20" y2="21"/><rect x="8" y="8" width="3" height="3"/><rect x="13" y="8" width="3" height="3"/><rect x="8" y="13" width="3" height="3"/><rect x="13" y="13" width="3" height="3"/></svg>',
  folder: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>',
  person: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
};

const AVATAR_COLORS = ['#0c51a1', '#7c3aed', '#059669', '#c2410c', '#be123c', '#0891b2', '#a21caf', '#4d7c0f'];
function avatarColor(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
function avatar(name, size) {
  const initial = (name || '?').trim().slice(0, 1).toUpperCase();
  return `<span class="avatar" style="width:${size}px;height:${size}px;background:${avatarColor(name || '?')};font-size:${Math.round(size * 0.42)}px">${initial}</span>`;
}

const NAV = [
  { path: '/dashboard', label: '대시보드', icon: ICON.dashboard },
  { group: '조직 관리' },
  { path: '/org', label: '조직도', icon: ICON.org },
  { group: '보안' },
  { path: '/security', label: '2차 인증(MFA)', icon: ICON.lock },
  { group: '정책 설정' },
  { path: '/policy/apps', label: '사내시스템 현황', icon: ICON.apps },
  { path: '/policy/access', label: '정책 접근관리', icon: ICON.access },
  { path: '/policy/rules', label: '행위 기반 제어', icon: ICON.rules },
  { path: '/policy/sessions', label: '활성세션·계정통제', icon: ICON.sessions },
  { group: '로그 조회' },
  { path: '/logs/system', label: '시스템 접속로그', icon: ICON.logSystem },
  { path: '/logs/admin', label: '관리자 로그', icon: ICON.logAdmin },
  { group: '설치' },
  { path: '/downloads', label: '커넥터 설치', icon: ICON.download },
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
  const connected = tunnel.isConnected();
  const operator = tunnel.getOperator();
  const connectorState = connected
    ? `<span class="badge-ok">연결됨</span> (${tunnel.getRegisteredServices().join(', ') || '서비스 없음'})`
    : `<span class="badge-deny">연결 안됨</span>`;

  const operatorCard = connected
    ? `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:600;margin-bottom:2px">커넥터 운영자</div>
            <div style="color:var(--muted);font-size:13px">${operator ? `${operator}로 로그인해서 실행 중` : '레거시 고정 토큰으로 연결됨 (운영자 식별 불가)'}</div>
          </div>
          ${operator ? chipForm('/connector/disconnect', { email: operator }, '연결 강제 종료', false) : ''}
        </div>
      </div>`
    : '';

  const recent = audit.getRecent({ limit: 40 })
    .map((e) => logLineHtml(e))
    .join('');

  return adminShell('/dashboard', session, '대시보드', `
    <div class="tiles">
      <div class="tile"><div class="tile-icon">${ICON.sessions}</div><div><div class="num">${activeSessions}</div><div class="label">활성 세션</div></div></div>
      <div class="tile"><div class="tile-icon">${ICON.rules}</div><div><div class="num">${todayBlocked}</div><div class="label">오늘 차단/실패 건수</div></div></div>
      <div class="tile"><div class="tile-icon">${ICON.apps}</div><div><div class="num" style="font-size:16px">${connectorState}</div><div class="label">커넥터 상태</div></div></div>
    </div>
    ${operatorCard}
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

function renderOrgChart(session) {
  const users = auth.listUsers();
  const deptPolicy = policy.getDeptPolicy();
  const byDept = groupByDept(users, { includeAdmins: true });
  const totalCount = Object.keys(users).length;
  const deptCount = Object.keys(deptPolicy).length;
  const installedCount = Object.keys(users).filter((email) => auth.getBridgeTokenFor(email)).length;

  const deptNodes = Object.keys(deptPolicy).map((dept) => {
    const members = byDept.get(dept) || [];
    const memberRows = members.length
      ? members.map(([email, u]) => {
          const token = auth.getBridgeTokenFor(email);
          const bridgeCell = token
            ? `<span class="tag-ok">설치됨</span> ${chipForm('/org/bridge-revoke', { email }, '접근 회수', false)}`
            : '<span class="muted">미설치</span>';
          const searchKey = `${u.name} ${email}`.toLowerCase();
          return `<div class="org-row org-row-person" data-search="${searchKey}">
            <span class="org-tree-cell">${avatar(u.name, 26)} ${u.name}${u.role === 'admin' ? ' <span class="tag-ok">관리자</span>' : ''}</span>
            <span class="muted">${email}</span>
            <span>${u.blocked ? '<span class="tag-deny">차단됨</span>' : '<span class="tag-ok">정상</span>'}</span>
            <span class="org-row-actions">${bridgeCell}</span>
          </div>`;
        }).join('')
      : '<div class="org-row org-row-person"><span class="org-tree-cell muted">소속 임직원 없음</span></div>';

    return `<details class="org-node dept-node">
      <summary class="org-row org-row-dept">
        <span class="org-tree-cell">${avatar(dept, 30)} <span class="dept-name">${dept}</span><span class="dept-count">${members.length}명</span></span>
        <span class="muted">-</span>
        <span class="muted">-</span>
        <span class="org-row-actions">
          <button type="button" class="btn ghost btn-sm" onclick="event.preventDefault();openAddMember('${dept}')">${ICON.plus} 임직원 추가</button>
        </span>
      </summary>
      <div class="org-children">
        ${memberRows}
      </div>
    </details>`;
  }).join('');

  return adminShell('/org', session, '조직도', `
    <div class="tiles">
      <div class="tile"><div class="tile-icon">${ICON.company}</div><div><div class="num">${totalCount}</div><div class="label">전체 임직원</div></div></div>
      <div class="tile"><div class="tile-icon">${avatar(TENANT_NAME, 24)}</div><div><div class="num">${deptCount}</div><div class="label">부서 수</div></div></div>
      <div class="tile"><div class="tile-icon">${ICON.access}</div><div><div class="num">${installedCount} / ${totalCount}</div><div class="label">브릿지 설치</div></div></div>
    </div>

    <div class="org-search">
      <div style="position:relative;max-width:340px">
        <span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--muted)">${ICON.search}</span>
        <input type="text" id="orgSearchInput" placeholder="이름 또는 이메일로 검색" oninput="filterOrgSearch(this.value)">
      </div>
    </div>

    <div class="org-node root-node">
      <div class="org-row org-row-company">
        <span class="org-tree-cell">${ICON.company} <span class="dept-name">${TENANT_NAME}</span><span class="dept-count">${totalCount}명</span></span>
        <span class="muted">-</span>
        <span class="muted">-</span>
        <span class="org-row-actions">
          <button type="button" class="btn ghost btn-sm" onclick="document.getElementById('addDeptDialog').showModal()">${ICON.plus} 부서 추가</button>
        </span>
      </div>
      <div class="org-children" style="padding-left:0">
        ${deptNodes}
      </div>
    </div>

    <div style="color:var(--muted);font-size:12px;margin-top:10px">
      임직원이 [설치 파일] 페이지에서 브릿지 앱을 받아 본인 계정(회사코드·이메일·비밀번호)으로 최초 1회 인증하면
      "설치됨"으로 바뀝니다 — 별도로 설정파일을 만들어 전달할 필요는 없습니다. 퇴사·기기 분실 시엔 "접근 회수"로
      그 앱을 즉시 무효화하세요. 부서/개인 접근 권한은 [정책 접근관리]에서 설정하세요.
    </div>

    <dialog id="addDeptDialog" class="modal-box">
      <form method="POST" action="/_ob/api/admin/org/dept-create">
        <h3>새 부서 추가</h3>
        <label>부서명</label>
        <input type="text" name="dept" placeholder="예: 재무팀" required autofocus>
        <div class="modal-actions">
          <button type="button" class="btn ghost" onclick="document.getElementById('addDeptDialog').close()">취소</button>
          <button class="btn" type="submit">추가</button>
        </div>
      </form>
    </dialog>

    <dialog id="addMemberDialog" class="modal-box">
      <form method="POST" action="/_ob/api/admin/org/create">
        <h3>임직원 추가 <span id="addMemberDeptLabel" class="muted"></span></h3>
        <input type="hidden" name="dept" id="addMemberDeptField">
        <label>이름</label>
        <input type="text" name="name" required>
        <label>이메일</label>
        <input type="email" name="email" required>
        <label>초기 비밀번호</label>
        <input type="text" name="password" required>
        <div class="modal-actions">
          <button type="button" class="btn ghost" onclick="document.getElementById('addMemberDialog').close()">취소</button>
          <button class="btn" type="submit">추가</button>
        </div>
      </form>
    </dialog>

    <script>
      function openAddMember(dept) {
        document.getElementById('addMemberDeptField').value = dept;
        document.getElementById('addMemberDeptLabel').textContent = '· ' + dept;
        document.getElementById('addMemberDialog').showModal();
      }
      function filterOrgSearch(q) {
        q = q.trim().toLowerCase();
        document.querySelectorAll('.dept-node').forEach((node) => {
          let anyMatch = !q;
          node.querySelectorAll('.org-row-person').forEach((row) => {
            const match = !q || (row.dataset.search || '').includes(q);
            row.style.display = match ? '' : 'none';
            if (match && q) anyMatch = true;
          });
          node.style.display = anyMatch ? '' : 'none';
          if (q && anyMatch) node.open = true;
        });
      }
    </script>
  `);
}

function renderSecurity(session, query) {
  const status = auth.getMfaStatus(session.email);
  let body;

  if (status.enrolled) {
    body = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:16px">
          <div>
            <div style="font-weight:600;margin-bottom:4px">2차 인증 활성화됨</div>
            <div class="muted" style="font-size:13px">커넥터 앱 로그인 시 비밀번호 다음 단계로 Google Authenticator 코드가 필요합니다.</div>
          </div>
          ${chipForm('/security/mfa-disable', {}, '비활성화', false)}
        </div>
      </div>`;
  } else if (status.pending) {
    const errorBox = query.mfaError ? '<div class="error-box">코드가 올바르지 않습니다. 다시 시도해주세요.</div>' : '';
    body = `
      <div class="card">
        <div style="font-weight:600;margin-bottom:10px">1단계 — Google Authenticator에 등록</div>
        <div class="muted" style="font-size:13px;margin-bottom:12px">
          Google Authenticator 앱에서 "코드 스캔" 대신 "직접 입력"(수동 설정 키)을 선택하고 아래 키를 입력하세요.
        </div>
        <div style="font-family:'SFMono-Regular',Consolas,monospace;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;font-size:15px;letter-spacing:1px;margin-bottom:16px;word-break:break-all">
          ${status.pendingSecret}
        </div>
        <div style="font-weight:600;margin-bottom:8px">2단계 — 앱에 뜨는 6자리 코드 입력해서 확인</div>
        ${errorBox}
        <form method="POST" action="/_ob/api/admin/security/mfa-confirm" style="max-width:200px">
          <input type="text" name="code" inputmode="numeric" maxlength="6" placeholder="123456" required autofocus>
          <button class="btn" type="submit" style="margin-top:10px">확인</button>
        </form>
      </div>`;
  } else {
    body = `
      <div class="card">
        <div style="font-weight:600;margin-bottom:6px">2차 인증이 꺼져있습니다</div>
        <div class="muted" style="font-size:13px;margin-bottom:14px">
          커넥터 앱은 관리자 로그인만으로 사내망 터널을 열 수 있어, 비밀번호 하나가 뚫리면 그대로 뚫립니다.
          Google Authenticator 기반 2차 인증을 켜두는 걸 권장합니다.
        </div>
        ${chipForm('/security/mfa-start', {}, '2차 인증 설정 시작', false)}
      </div>`;
  }

  return adminShell('/security', session, '2차 인증(MFA)', body);
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

// Groups employees under their department, in listing order. Used to build
// the collapsible org-tree views — this keeps large customer orgs (100s of
// employees) from being one giant flat table.
function groupByDept(users, { includeAdmins = true } = {}) {
  const byDept = new Map();
  Object.entries(users).forEach(([email, u]) => {
    if (!includeAdmins && u.role === 'admin') return;
    if (!byDept.has(u.dept)) byDept.set(u.dept, []);
    byDept.get(u.dept).push([email, u]);
  });
  return byDept;
}

function renderPolicyAccess(session) {
  const services = policy.getServices();
  const deptPolicy = policy.getDeptPolicy();
  const grants = policy.getGrants();
  const users = auth.listUsers();
  const serviceNames = Object.keys(services);
  const byDept = groupByDept(users, { includeAdmins: false });
  const deptCount = Object.keys(deptPolicy).length;
  const totalMembers = Array.from(byDept.values()).reduce((n, m) => n + m.length, 0);

  const nodes = Object.keys(deptPolicy).map((dept) => {
    const members = byDept.get(dept) || [];
    const deptChips = serviceNames.map((name) => {
      const on = (deptPolicy[dept] || []).includes(name);
      return chipForm('/policy/dept', { dept, service: name, allow: on ? '0' : '1' }, `${services[name].label}${on ? ' ✓' : ''}`, on);
    }).join('');

    const memberRows = members.length
      ? members.map(([email, u]) => {
          const cells = serviceNames.map((name) => {
            const on = (grants[email] || []).includes(name);
            return chipForm('/policy/individual', { email, service: name, allow: on ? '0' : '1' }, `${services[name].label}${on ? ' ✓' : ''}`, on);
          }).join('');
          const searchKey = `${u.name} ${email}`.toLowerCase();
          return `<div class="org-row org-row-wide org-row-person" data-search="${searchKey}">
            <span class="org-tree-cell">${avatar(u.name, 26)} ${u.name} <span class="muted">(${email})</span></span>
            <span class="chip-cell">${cells || '<span class="muted">등록된 사내시스템 없음</span>'}</span>
          </div>`;
        }).join('')
      : '<div class="org-row org-row-wide org-row-person"><span class="org-tree-cell muted">소속 임직원 없음</span><span></span></div>';

    return `<details class="org-node dept-node">
      <summary class="org-row org-row-wide org-row-dept">
        <span class="org-tree-cell">${avatar(dept, 30)} <span class="dept-name">${dept}</span><span class="dept-count">${members.length}명</span></span>
        <span class="chip-cell">${deptChips || '<span class="muted">등록된 사내시스템 없음</span>'}</span>
      </summary>
      <div class="org-children">${memberRows}</div>
    </details>`;
  }).join('');

  return adminShell('/policy/access', session, '정책 접근관리', `
    <div class="tiles">
      <div class="tile"><div class="tile-icon">${ICON.company}</div><div><div class="num">${totalMembers}</div><div class="label">대상 임직원</div></div></div>
      <div class="tile"><div class="tile-icon">${ICON.folder}</div><div><div class="num">${deptCount}</div><div class="label">부서 수</div></div></div>
      <div class="tile"><div class="tile-icon">${ICON.apps}</div><div><div class="num">${serviceNames.length}</div><div class="label">등록된 사내시스템</div></div></div>
    </div>

    <div class="org-search">
      <div style="position:relative;max-width:340px">
        <span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--muted)">${ICON.search}</span>
        <input type="text" id="orgSearchInput" placeholder="이름 또는 이메일로 검색" oninput="filterOrgSearch(this.value)">
      </div>
    </div>

    <div style="margin-bottom:12px;color:var(--muted);font-size:13px">
      부서를 펼치면 소속 임직원별 개인 추가 권한(부서 정책 위에 더해짐)이 나옵니다. 부서 칩은 그 부서
      전체에 적용되고, 펼친 안의 칩은 그 사람 한 명에게만 적용됩니다.
    </div>
    ${nodes || '<div class="muted">등록된 부서가 없습니다.</div>'}

    <script>
      function filterOrgSearch(q) {
        q = q.trim().toLowerCase();
        document.querySelectorAll('.dept-node').forEach((node) => {
          let anyMatch = !q;
          node.querySelectorAll('.org-row-person').forEach((row) => {
            const match = !q || (row.dataset.search || '').includes(q);
            row.style.display = match ? '' : 'none';
            if (match && q) anyMatch = true;
          });
          node.style.display = anyMatch ? '' : 'none';
          if (q && anyMatch) node.open = true;
        });
      }
    </script>
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
  bridgeOnlyAccess: '포털(웹) 로그인 제한 — 켜면 일반 임직원은 브릿지 앱으로만 접속 가능 (관리자는 항상 웹 로그인 가능)',
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
      <td>${avatar(s.name, 22)} ${s.name} <span class="muted">(${s.email})</span></td><td>${s.ip}</td><td>${fmtTime(s.loginAt)}</td><td>${fmtTime(s.lastSeenAt)}</td>
      <td><form class="inline" method="POST" action="/_ob/api/admin/sessions/terminate">
        <input type="hidden" name="sessionId" value="${s.id}">
        <button class="btn danger" type="submit">세션 종료</button>
      </form></td>
    </tr>`).join('');

  const users = auth.listUsers();
  const byDept = groupByDept(users, { includeAdmins: true });
  const totalCount = Object.keys(users).length;
  const blockedCount = Object.values(users).filter((u) => u.blocked).length;
  const lockedCount = Object.values(users).filter((u) => u.lockedUntil && Date.now() < u.lockedUntil).length;

  const acctNodes = Array.from(byDept.entries()).map(([dept, members]) => {
    const memberRows = members.map(([email, u]) => {
      const locked = u.lockedUntil && Date.now() < u.lockedUntil;
      const searchKey = `${u.name} ${email}`.toLowerCase();
      return `<div class="org-row org-row-wide org-row-person" data-search="${searchKey}">
        <span class="org-tree-cell">${avatar(u.name, 26)} ${u.name}${u.role === 'admin' ? ' <span class="tag-ok">관리자</span>' : ''} <span class="muted">(${email})</span></span>
        <span class="chip-cell" style="justify-content:flex-end;align-items:center">
          ${u.blocked ? '<span class="tag-deny">차단됨</span>' : '<span class="tag-ok">정상</span>'}
          ${locked ? `<span class="tag-warn">잠김 (~${fmtTime(u.lockedUntil)})</span>` : ''}
          <form class="inline" method="POST" action="/_ob/api/admin/users/${u.blocked ? 'unblock' : 'block'}">
            <input type="hidden" name="email" value="${email}">
            <button class="btn ${u.blocked ? 'ghost' : 'danger'} btn-sm" type="submit">${u.blocked ? '차단 해제' : '계정 차단'}</button>
          </form>
          ${locked ? `<form class="inline" method="POST" action="/_ob/api/admin/users/unlock"><input type="hidden" name="email" value="${email}"><button class="btn ghost btn-sm" type="submit">잠금 해제</button></form>` : ''}
        </span>
      </div>`;
    }).join('');

    return `<details class="org-node dept-node">
      <summary class="org-row org-row-wide org-row-dept">
        <span class="org-tree-cell">${avatar(dept, 30)} <span class="dept-name">${dept}</span><span class="dept-count">${members.length}명</span></span>
        <span class="chip-cell" style="justify-content:flex-end">
          ${chipForm('/org/dept-block', { dept, action: 'block' }, '부서 전체 차단', false)}
          ${chipForm('/org/dept-block', { dept, action: 'unblock' }, '부서 전체 해제', false)}
        </span>
      </summary>
      <div class="org-children">${memberRows}</div>
    </details>`;
  }).join('');

  return adminShell('/policy/sessions', session, '활성세션·계정통제', `
    <div class="tiles">
      <div class="tile"><div class="tile-icon">${ICON.sessions}</div><div><div class="num">${sessions.length}</div><div class="label">활성 세션</div></div></div>
      <div class="tile"><div class="tile-icon">${ICON.lock}</div><div><div class="num">${blockedCount}</div><div class="label">차단된 계정</div></div></div>
      <div class="tile"><div class="tile-icon">${ICON.rules}</div><div><div class="num">${lockedCount}</div><div class="label">잠긴 계정</div></div></div>
    </div>

    <div class="card">
      <div style="margin-bottom:10px;font-weight:600">활성 세션</div>
      <table><thead><tr><th>사용자</th><th>IP</th><th>로그인</th><th>최근활동</th><th></th></tr></thead><tbody>${sessRows || '<tr><td colspan="5">활성 세션 없음</td></tr>'}</tbody></table>
    </div>

    <div style="margin:18px 0 10px;font-weight:600">계정 통제 (부서별)</div>
    <div class="org-search">
      <div style="position:relative;max-width:340px">
        <span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--muted)">${ICON.search}</span>
        <input type="text" id="orgSearchInput" placeholder="이름 또는 이메일로 검색" oninput="filterOrgSearch(this.value)">
      </div>
    </div>
    ${acctNodes || '<div class="muted">등록된 부서가 없습니다.</div>'}

    <script>
      function filterOrgSearch(q) {
        q = q.trim().toLowerCase();
        document.querySelectorAll('.dept-node').forEach((node) => {
          let anyMatch = !q;
          node.querySelectorAll('.org-row-person').forEach((row) => {
            const match = !q || (row.dataset.search || '').includes(q);
            row.style.display = match ? '' : 'none';
            if (match && q) anyMatch = true;
          });
          node.style.display = anyMatch ? '' : 'none';
          if (q && anyMatch) node.open = true;
        });
      }
    </script>
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

function fileSizeLabel(fileName) {
  try {
    const stat = fs.statSync(path.join(DOWNLOADS_DIR, fileName));
    const mb = stat.size / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(stat.size / 1024)} KB`;
  } catch {
    return null;
  }
}

function downloadCard({ title, desc, fileName, steps }) {
  const size = fileSizeLabel(fileName);
  const stepsHtml = steps.map((s) => `<li>${s}</li>`).join('');
  return `
    <div class="card">
      <div style="font-weight:700;font-size:15px;margin-bottom:4px">${title}</div>
      <div style="color:var(--muted);font-size:13px;margin-bottom:14px">${desc}</div>
      ${size
        ? `<a class="btn" href="/_ob/downloads/${fileName}" style="display:inline-block;text-decoration:none">다운로드 (${size})</a>`
        : `<span class="tag-deny">아직 서버에 파일이 없습니다 (downloads/${fileName})</span>`}
      <ol style="margin-top:16px;padding-left:20px;font-size:13px;color:var(--text)">${stepsHtml}</ol>
    </div>`;
}

function renderDownloads(session) {
  const bridgeCard = downloadCard({
    title: '임직원용 브릿지 앱',
    desc: `일반 임직원이 자기 컴퓨터에 설치하는 앱입니다. 누구나 같은 파일을 받아 쓸 수 있고, 개인 설정파일은 필요 없습니다 — 최초 실행 시 본인이 회사코드(${TENANT_NAME})·이메일·비밀번호로 직접 인증합니다.`,
    fileName: 'officebridge-bridge-mac.zip',
    steps: [
      '앱을 Applications 폴더로 이동 후 실행 (우클릭 → 열기)',
      `최초 실행 시 뜨는 화면에서 회사코드 "${TENANT_NAME}"와 본인의 포털 계정(이메일/비밀번호)으로 인증`,
      '한 번 인증하면 그 뒤로는 로그인 없이 메뉴바에서 본인이 접근 가능한 시스템만 바로 클릭해서 접속',
      '퇴사·기기 분실 시 [조직도]에서 "접근 회수"를 누르면 그 앱은 즉시 무효화됨',
    ],
  });

  const connectorCard = downloadCard({
    title: '커넥터 앱 (사내망 설치용, 관리자 전용)',
    desc: `사내망 안의 장비에 설치하는 앱입니다. 관리자 계정으로 로그인해야 터널이 시작됩니다 — 로그인 전에는 아무 트래픽도 중계하지 않습니다.`,
    fileName: 'officebridge-connector-app-mac.zip',
    steps: [
      '앱을 Applications 폴더로 이동 후 실행 (우클릭 → 열기)',
      `회사코드 "${TENANT_NAME}" + 관리자 계정(이메일/비밀번호)으로 로그인해야 터널이 붙음`,
      '앱 안에서 서비스(사내시스템) 추가/삭제/on-off — 별도 웹 관리 화면 없음',
      '[대시보드]에서 지금 어느 관리자 계정으로 연결됐는지 보이고, "연결 강제 종료"로 즉시 로그아웃시킬 수 있음',
    ],
  });

  return adminShell('/downloads', session, '설치 파일', `
    <div style="margin-bottom:16px;color:var(--muted);font-size:13px">
      이 릴레이(${DOMAIN})에 연결되도록 미리 설정되어 있습니다. 위는 사내망 커넥터(관리자용), 아래는 임직원 개인용입니다.
    </div>
    ${connectorCard}
    ${bridgeCard}
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
    case '/downloads': return renderDownloads(session);
    case '/org': return renderOrgChart(session);
    case '/security': return renderSecurity(session, query);
    default: return null;
  }
}

// ---- Actions (mutations triggered from admin forms) ------------------

const actions = {
  'security/mfa-start'(body, session, ip) {
    auth.startMfaEnroll(session.email);
    audit.log({ type: 'ADMIN', verdict: 'OK', user: session.email, service: '-', ip, reason: 'MFA 설정 시작' });
  },
  'security/mfa-confirm'(body, session, ip) {
    const result = auth.confirmMfaEnroll(session.email, body.code);
    audit.log({ type: 'ADMIN', verdict: result.ok ? 'OK' : 'FAIL', user: session.email, service: '-', ip, reason: result.ok ? 'MFA 활성화 완료' : `MFA 확인 실패: ${result.reason}` });
    return `https://admin.${DOMAIN}/security${result.ok ? '' : '?mfaError=1'}`;
  },
  'security/mfa-disable'(body, session, ip) {
    auth.disableMfa(session.email);
    audit.log({ type: 'ADMIN', verdict: 'OK', user: session.email, service: '-', ip, reason: 'MFA 비활성화' });
  },
  'org/dept-create'(body, session, ip) {
    const dept = (body.dept || '').trim();
    if (!dept) return;
    policy.ensureDept(dept);
    audit.log({ type: 'ADMIN', verdict: 'OK', user: session.email, service: '-', ip, reason: `부서 추가: ${dept}` });
  },
  'org/create'(body, session, ip) {
    const { email, name, dept, password } = body;
    const result = auth.createUser(email, { name, dept, password });
    if (!result.ok) {
      audit.log({ type: 'ADMIN', verdict: 'FAIL', user: session.email, service: '-', ip, reason: `임직원 등록 실패: ${email} (${result.reason})` });
      return;
    }
    policy.ensureDept(dept);
    audit.log({ type: 'ADMIN', verdict: 'OK', user: session.email, service: '-', ip, reason: `임직원 등록: ${name} (${email}, ${dept})` });
  },
  'org/bridge-revoke'(body, session, ip) {
    const { email } = body;
    auth.revokeBridgeToken(email);
    audit.log({ type: 'ADMIN', verdict: 'OK', user: session.email, service: '-', ip, reason: `개인 브릿지 토큰 회수: ${email}` });
  },
  'org/dept-block'(body, session, ip) {
    const { dept, action } = body;
    const emails = Object.entries(auth.listUsers())
      .filter(([, u]) => u.dept === dept)
      .map(([email]) => email);
    emails.forEach((email) => (action === 'block' ? auth.blockUser(email) : auth.unblockUser(email)));
    audit.log({ type: 'ADMIN', verdict: 'OK', user: session.email, service: '-', ip, reason: `부서 일괄 ${action === 'block' ? '차단' : '차단 해제'}: ${dept} (${emails.length}명)` });
  },
  'connector/disconnect'(body, session, ip) {
    const { email } = body;
    auth.revokeConnectorToken(email);
    tunnel.disconnectCurrent();
    audit.log({ type: 'ADMIN', verdict: 'OK', user: session.email, service: '-', ip, reason: `커넥터 연결 강제 종료 및 토큰 회수: ${email}` });
  },
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
