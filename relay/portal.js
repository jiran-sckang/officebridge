const policy = require('./policy');
const auth = require('./auth');
const mfaUi = require('./mfa-ui');
const { shell } = require('./theme');
const { DOMAIN, TENANT_NAME } = require('./config');

function portalTopbar(session, extraLinks = '') {
  const initial = (session.name || '?').trim().slice(0, 1).toUpperCase();
  return `
    <div class="topbar">
      <div class="brand">Office<span>Bridge</span> <span class="tenant-badge">${TENANT_NAME}</span></div>
      <details class="user-menu">
        <summary><span class="avatar">${initial}</span>${session.name}</summary>
        <div class="menu">
          <div class="who-line">${session.name} · ${session.dept}</div>
          ${session.role === 'admin' ? `<a href="https://admin.${DOMAIN}/dashboard">관리자 콘솔</a>` : ''}
          <a href="/mfa">2차 인증</a>
          ${extraLinks}
          <a href="/_ob/logout">로그아웃</a>
        </div>
      </details>
    </div>`;
}

function renderMfaPage(session, query) {
  const status = auth.getMfaStatus(session.email);
  return shell('2차 인증', `
    ${portalTopbar(session)}
    <div class="main">
      <h1>2차 인증(MFA)</h1>
      ${mfaUi.renderMfaCard(status, query, '/portal', '브릿지 앱')}
      <div style="margin-top:16px"><a href="/" style="font-size:13px;color:var(--muted)">← 포털로 돌아가기</a></div>
    </div>
  `);
}

function renderPortal(session) {
  const services = policy.getServices();
  const allowed = policy.effectiveServices(session);

  const cards = Object.entries(services)
    .map(([name, s]) => {
      const isAllowed = allowed.has(name);
      const url = `https://${name}.${DOMAIN}/`;
      const lockIcon = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
      const monitorIcon = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
      return `
      <a class="portal-card ${isAllowed ? '' : 'locked'}" href="${url}" style="text-decoration:none;color:inherit">
        ${isAllowed ? '' : `<div class="lock">${lockIcon}</div>`}
        <div style="color:var(--blue)">${monitorIcon}</div>
        <div class="name">${s.label}</div>
      </a>`;
    })
    .join('');

  return shell('임직원 포털', `
    ${portalTopbar(session)}
    <div class="main">
      <h1>사내 시스템 포털</h1>
      <div class="portal-grid">${cards}</div>
    </div>
  `);
}

module.exports = { renderPortal, renderMfaPage };
