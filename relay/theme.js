const { TENANT_NAME } = require('./config');

const CSS = `
  :root {
    --blue: #0c51a1; --blue-dark: #08386f; --blue-tint: #eaf1fb;
    --bg: #f8fafc; --card: #ffffff; --border: #e3e7ee; --text: #1a1a1a; --muted: #666666;
    --ok: #1a8a5f; --deny: #c73434; --warn: #b8860b;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Malgun Gothic', 'Nanum Barun Gothic', -apple-system, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); }
  a { color: var(--blue); text-decoration: none; }
  .topbar { background: #fff; color: var(--text); padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); }
  .topbar .brand { font-weight: 700; font-size: 18px; letter-spacing: .3px; color: var(--blue); }
  .topbar .brand span { color: var(--text); }
  .topbar .who { font-size: 13px; color: var(--muted); display: flex; gap: 14px; align-items: center; }
  .topbar .who a { color: var(--blue); }
  .tenant-badge { background: var(--blue-tint); color: var(--blue); padding: 2px 10px; border-radius: 4px; font-size: 12px; }

  .user-menu { position: relative; }
  .user-menu summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: 8px; }
  .user-menu summary::-webkit-details-marker { display: none; }
  .user-menu summary::after { content: '▾'; font-size: 10px; color: var(--muted); margin-left: 2px; }
  .user-menu .avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--blue); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
  .user-menu .menu { position: absolute; right: 0; top: 38px; background: #fff; border: 1px solid var(--border); border-radius: 6px; box-shadow: 0 4px 16px rgba(16,24,40,.10); min-width: 170px; padding: 6px; z-index: 20; }
  .user-menu .menu .who-line { padding: 8px 10px; font-size: 12px; color: var(--muted); border-bottom: 1px solid var(--border); margin-bottom: 4px; }
  .user-menu .menu a { display: block; padding: 8px 10px; border-radius: 4px; color: var(--text); font-size: 13px; }
  .user-menu .menu a:hover { background: var(--bg); }

  .layout { display: flex; min-height: calc(100vh - 52px); }
  .sidebar { width: 232px; background: #fff; color: var(--text); padding: 12px 0; flex-shrink: 0; border-right: 1px solid var(--border); }
  .sidebar a { display: flex; align-items: center; gap: 10px; color: var(--muted); padding: 9px 22px; font-size: 14px; border-left: 3px solid transparent; }
  .sidebar a svg { flex-shrink: 0; opacity: .8; }
  .sidebar a.active { background: var(--blue-tint); color: var(--blue); font-weight: 600; border-left: 3px solid var(--blue); }
  .sidebar a.active svg { opacity: 1; }
  .sidebar .group { padding: 16px 22px 6px; font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; }
  .main { flex: 1; padding: 24px 32px; }
  .breadcrumb { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
  .breadcrumb b { color: var(--text); font-weight: 600; }
  h1 { font-size: 20px; margin: 0 0 18px; color: var(--text); }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 6px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
  .tiles { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
  .tile { background: var(--card); border: 1px solid var(--border); border-radius: 6px; padding: 16px 20px; min-width: 140px; display: flex; align-items: center; gap: 14px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
  .tile .tile-icon { width: 38px; height: 38px; border-radius: 6px; background: var(--blue-tint); color: var(--blue); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .tile .num { font-size: 24px; font-weight: 700; color: var(--text); line-height: 1.2; }
  .tile .label { font-size: 12px; color: var(--muted); margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-weight: 600; font-size: 12px; text-transform: uppercase; background: var(--bg); }
  .chip { display: inline-block; padding: 4px 12px; border-radius: 6px; border: 1px solid var(--border); background: #fff; font-size: 12px; cursor: pointer; }
  .chip.on { background: var(--blue-tint); color: var(--blue); border-color: #bcd3ef; }
  .chip.off { background: #f4f4f4; color: var(--muted); }
  form.inline { display: inline; }
  button { font: inherit; }
  .btn { background: var(--blue); color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; }
  .btn:hover { background: var(--blue-dark); }
  .btn.danger { background: var(--deny); }
  .btn.ghost { background: #fff; border: 1px solid var(--border); color: var(--text); }
  input[type=text], input[type=email], input[type=password] { padding: 9px 10px; border: 1px solid var(--border); border-radius: 6px; width: 100%; margin-bottom: 10px; }
  .row { display: flex; gap: 10px; }
  .row > div { flex: 1; }
  .muted { color: var(--muted); font-size: 12px; }
  .badge-ok { color: var(--ok); font-weight: 600; }
  .badge-deny { color: var(--deny); font-weight: 600; }
  .badge-warn { color: var(--warn); font-weight: 600; }
  .tag-ok, .tag-deny, .tag-warn { display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; }
  .tag-ok { background: #e5f3ec; color: var(--ok); }
  .tag-deny { background: #fdeaea; color: var(--deny); }
  .tag-warn { background: #fdf3e0; color: var(--warn); }
  .filters a { display: inline-block; padding: 6px 14px; border: 1px solid var(--border); border-radius: 6px; margin-right: 8px; font-size: 13px; color: var(--text); }
  .filters a.active { background: var(--blue); color: #fff; border-color: var(--blue); }
  .portal-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr)); gap: 18px; }
  .portal-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 22px 18px; text-align: center; position: relative; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
  .portal-card.locked { opacity: .55; }
  .portal-card .lock { position: absolute; top: 10px; right: 14px; font-size: 16px; }
  .portal-card .name { font-weight: 700; margin-top: 10px; color: var(--text); }
  .center-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); }
  .login-box { background: #fff; padding: 40px; border-radius: 6px; width: 360px; border: 1px solid var(--border); }
  .login-box h1 { color: var(--blue); font-size: 22px; }
  .login-box .sub { color: var(--muted); font-size: 13px; margin-bottom: 22px; }
  .demo-chip { display: inline-block; margin: 3px 4px 12px 0; padding: 5px 10px; font-size: 11px; border: 1px dashed var(--blue); color: var(--blue); border-radius: 4px; cursor: pointer; background: #fff; }
  .error-box { background: #fdeaea; color: var(--deny); padding: 10px 12px; border-radius: 4px; font-size: 13px; margin-bottom: 14px; }
  .block-box { background: #fff; padding: 44px 50px; border-radius: 6px; text-align: center; width: 420px; border: 1px solid var(--border); }
  .block-box .icon { font-size: 40px; }
  .block-box h1 { margin: 12px 0 8px; }
  .block-box p { color: var(--muted); font-size: 14px; }
  .log-line { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; padding: 3px 0; border-bottom: 1px dotted var(--border); }
`;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shell(title, bodyHtml) {
  return `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>${title} · OfficeBridge</title><style>${CSS}</style></head>
<body>${bodyHtml}</body>
</html>`;
}

function loginPage({ next = '/', error = '' } = {}) {
  next = escapeHtml(next);
  error = escapeHtml(error);
  const demoAccounts = [
    ['kim.sales@demo.co.kr', '김영업 (영업팀)'],
    ['lee.dev@demo.co.kr', '이개발 (개발팀)'],
    ['park.hr@demo.co.kr', '박인사 (인사팀)'],
    ['admin@demo.co.kr', '박 과장 (관리자)'],
  ];
  const chips = demoAccounts
    .map(([email, label]) => `<span class="demo-chip" onclick="fillDemo('${email}')">${label}</span>`)
    .join('');

  return shell('로그인', `
    <div class="center-page">
      <div class="login-box">
        <h1>OfficeBridge</h1>
        <div class="sub">${TENANT_NAME} 임직원 전용 · VPN 없이 브라우저로 접속</div>
        ${error ? `<div class="error-box">${error}</div>` : ''}
        <form method="POST" action="/_ob/login">
          <input type="hidden" name="next" value="${next}">
          <input type="email" name="email" id="email" placeholder="이메일" required>
          <input type="password" name="password" id="password" placeholder="비밀번호" required>
          <button class="btn" style="width:100%" type="submit">로그인</button>
        </form>
        <div style="margin-top:16px">${chips}</div>
        <div style="color:#aaa;font-size:11px">데모 계정 비밀번호: demo1234</div>
      </div>
    </div>
    <script>
      function fillDemo(email) {
        document.getElementById('email').value = email;
        document.getElementById('password').value = 'demo1234';
      }
    </script>
  `);
}

function blockPage({ code, icon = '🛡️', title, message, detail = '' }) {
  return shell(title, `
    <div class="center-page">
      <div class="block-box">
        <div class="icon">${icon}</div>
        <h1>${title}</h1>
        <p>${message}</p>
        ${detail ? `<p style="font-size:12px;color:#999">${detail}</p>` : ''}
        <p><a href="/">← 포털로 돌아가기</a></p>
      </div>
    </div>
  `);
}

module.exports = { shell, loginPage, blockPage, CSS };
