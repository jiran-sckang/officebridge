const CSS = `
  :root {
    --blue: #0c51a1; --blue-dark: #08386f; --blue-tint: #eaf1fb;
    --bg: #f8fafc; --card: #ffffff; --border: #e3e7ee; --text: #1a1a1a; --muted: #666666;
    --ok: #1a8a5f; --deny: #c73434; --warn: #b8860b;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Pretendard Variable', 'Pretendard', -apple-system, 'Malgun Gothic', 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); }
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
  .user-menu .menu { position: absolute; right: 0; top: 38px; background: #fff; border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 4px 16px rgba(16,24,40,.10); min-width: 170px; padding: 6px; z-index: 20; }
  .user-menu .menu .who-line { padding: 8px 10px; font-size: 12px; color: var(--muted); border-bottom: 1px solid var(--border); margin-bottom: 4px; }
  .user-menu .menu a { display: block; padding: 8px 10px; border-radius: 4px; color: var(--text); font-size: 13px; }
  .user-menu .menu a:hover { background: var(--bg); }

  /* small per-row "..." action menu — same popover shape as .user-menu,
     reused for org-chart row actions (edit/delete) instead of a one-off style */
  .row-menu { position: relative; display: inline-flex; }
  .row-menu summary { cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 10px; color: var(--muted); }
  .row-menu summary:hover { background: var(--bg); color: var(--text); }
  .row-menu summary::-webkit-details-marker { display: none; }
  .row-menu .menu { position: absolute; right: 0; top: 32px; background: #fff; border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 4px 16px rgba(16,24,40,.10); min-width: 150px; padding: 6px; z-index: 20; }
  .row-menu .menu button, .row-menu .menu a { display: block; width: 100%; text-align: left; padding: 8px 10px; border-radius: 4px; color: var(--text); font-size: 13px; background: none; border: none; cursor: pointer; font-family: inherit; }
  .row-menu .menu button:hover, .row-menu .menu a:hover { background: var(--bg); }
  .row-menu .menu button.danger-text { color: var(--deny); }

  .layout { display: flex; min-height: calc(100vh - 52px); }
  .sidebar { width: 232px; background: #fff; color: var(--text); padding: 12px 0; flex-shrink: 0; border-right: 1px solid var(--border); }
  .sidebar a { display: flex; align-items: center; gap: 10px; color: var(--muted); padding: 9px 22px; font-size: 14px; border-left: 3px solid transparent; }
  .sidebar a svg { flex-shrink: 0; opacity: .8; }
  .sidebar a.active { background: var(--blue-tint); color: var(--blue); font-weight: 600; border-left: 3px solid var(--blue); }
  .sidebar a.active svg { opacity: 1; }
  .sidebar .group { padding: 16px 22px 6px; font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; }
  .main { flex: 1; padding: 24px 32px; display: flex; flex-direction: column; }
  /* The last data panel on a page (table-panel or card) fills whatever
     vertical space is left in the viewport instead of sitting at its own
     content height with a dead gap below it — a handful of rows still looks
     like a full page, and once real content actually exceeds the viewport
     the whole page scrolls normally (no separate inner scrollbar). Matched
     on tag, not class, so a trailing <script> sibling (every table-panel
     page appends one) never becomes the ":last-child" target instead. */
  .main > div:last-of-type { flex: 1 1 auto; }
  .breadcrumb { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
  .breadcrumb b { color: var(--text); font-weight: 600; }
  h1 { font-size: 20px; margin: 0 0 18px; color: var(--text); }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
  .tiles { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
  .tile { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 16px 20px; min-width: 140px; display: flex; align-items: center; gap: 14px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
  .tile .tile-icon { width: 38px; height: 38px; border-radius: 10px; background: var(--blue-tint); color: var(--blue); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .tile .num { font-size: 24px; font-weight: 700; color: var(--text); line-height: 1.2; }
  .tile .label { font-size: 12px; color: var(--muted); margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-weight: 600; font-size: 12px; text-transform: uppercase; background: var(--bg); }
  .chip { display: inline-block; padding: 4px 12px; border-radius: 10px; border: 1px solid var(--border); background: #fff; font-size: 12px; cursor: pointer; }
  .chip.on { background: var(--blue-tint); color: var(--blue); border-color: #bcd3ef; }
  .chip.off { background: #f4f4f4; color: var(--muted); }
  form.inline { display: inline; }
  button { font: inherit; }
  .btn { background: var(--blue); color: #fff; border: none; padding: 8px 16px; border-radius: 10px; cursor: pointer; font-size: 13px; }
  .btn:hover { background: var(--blue-dark); }
  .btn.danger { background: var(--deny); }
  .btn.ghost { background: #fff; border: 1px solid var(--border); color: var(--text); }
  input[type=text], input[type=email], input[type=password] { padding: 9px 10px; border: 1px solid var(--border); border-radius: 10px; width: 100%; margin-bottom: 10px; }
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
  /* Kept for the flat per-user lists that still use this row shape (e.g.
     2차 인증 관리 대상 목록) — the dept-tree markup that used to wrap these
     (.org-node/.org-children/.root-node/...) was replaced by .table-panel /
     .data-table across 조직도·정책접근관리·계정통제. */
  .org-row {
    display: grid; grid-template-columns: 1fr 220px 90px 220px; align-items: center;
    gap: 10px; padding: 10px 16px; font-size: 13px;
  }
  .org-tree-cell { display: flex; align-items: center; gap: 8px; }
  .org-tree-cell svg { flex-shrink: 0; color: var(--blue); }
  .org-row-person:hover { background: var(--bg); }
  .dept-count { color: var(--muted); font-weight: 400; font-size: 12px; margin-left: 6px; }
  .btn-sm { display: inline-flex; align-items: center; gap: 5px; padding: 6px 11px; font-size: 12px; }
  .btn-sm svg { width: 13px; height: 13px; }

  .avatar {
    display: inline-flex; align-items: center; justify-content: center; border-radius: 50%;
    color: #fff; font-weight: 700; flex-shrink: 0; vertical-align: middle;
  }

  /* wider variant: name+email on the left, a flexible chip/action area on
     the right instead of the fixed 4-col grid (too narrow for N chips). */
  .org-row-wide { grid-template-columns: 280px 1fr; }
  .chip-cell { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-start; }

  .platform-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin: 14px 0 20px; }
  .platform-tile {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
    height: 150px; border-radius: 10px; color: #fff; text-decoration: none;
    transition: transform .1s, box-shadow .1s;
  }
  .platform-tile:not(.disabled):hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(16,24,40,.15); }
  .platform-tile.disabled { opacity: .5; cursor: not-allowed; }
  .platform-label { font-size: 16px; font-weight: 700; }
  .platform-size { font-size: 12px; opacity: .85; }

  dialog.modal-box { border: none; border-radius: 10px; padding: 0; width: 340px; box-shadow: 0 20px 50px rgba(16,24,40,.25); }
  dialog.modal-box::backdrop { background: rgba(15,23,42,.45); }
  dialog.modal-box form { padding: 22px 24px; display: flex; flex-direction: column; }
  dialog.modal-box h3 { margin: 0 0 6px; font-size: 15px; }
  dialog.modal-box label { font-size: 11.5px; color: var(--muted); margin: 10px 0 4px; }
  dialog.modal-box input { padding: 9px 10px; border: 1px solid var(--border); border-radius: 10px; font-size: 13px; }
  .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
  .filters a { display: inline-block; padding: 6px 14px; border: 1px solid var(--border); border-radius: 10px; margin-right: 8px; font-size: 13px; color: var(--text); }
  .filters a.active { background: var(--blue); color: #fff; border-color: var(--blue); }
  .portal-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr)); gap: 18px; }
  .portal-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 22px 18px; text-align: center; position: relative; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
  .portal-card.locked { opacity: .55; }
  .portal-card .lock { position: absolute; top: 10px; right: 14px; font-size: 16px; }
  .portal-card .name { font-weight: 700; margin-top: 10px; color: var(--text); }
  .center-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); }
  .login-box { background: #fff; padding: 40px; border-radius: 10px; width: 360px; border: 1px solid var(--border); }
  .login-box h1 { color: var(--blue); font-size: 22px; }
  .login-box .sub { color: var(--muted); font-size: 13px; margin-bottom: 22px; }
  .error-box { background: #fdeaea; color: var(--deny); padding: 10px 12px; border-radius: 4px; font-size: 13px; margin-bottom: 14px; }
  .block-box { background: #fff; padding: 44px 50px; border-radius: 10px; text-align: center; width: 420px; border: 1px solid var(--border); }
  .block-box .icon { font-size: 40px; }
  .block-box h1 { margin: 12px 0 8px; }
  .block-box p { color: var(--muted); font-size: 14px; }
  .log-line { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; padding: 3px 0; border-bottom: 1px dotted var(--border); }

  /* ---- flat table panel (조직도/정책접근관리/계정통제 공통 틀) ------------- */
  .table-panel { background: var(--card); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
  .table-banner { background: var(--blue); color: #fff; padding: 14px 20px; display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .table-banner .t-title { font-weight: 700; font-size: 15px; }
  .table-banner .t-desc { font-size: 12.5px; opacity: .88; }
  .table-filter-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 20px; flex-wrap: wrap; border-bottom: 1px solid var(--border); }
  .table-filter-row .seg { display: flex; align-items: center; gap: 18px; }
  .table-filter-row label.radio { display: flex; align-items: center; gap: 7px; font-size: 13.5px; cursor: pointer; }
  .table-filter-row input[type=radio] { accent-color: var(--blue); width: 16px; height: 16px; margin: 0; }
  .table-filter-row .dept-select { padding: 8px 12px; border: 1px solid var(--border); border-radius: 10px; font-size: 13px; background: #fff; }
  .table-search { display: flex; gap: 8px; }
  .table-search input { padding: 8px 12px; border: 1px solid var(--border); border-radius: 10px; font-size: 13px; width: 220px; }
  .table-search button { background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 8px 16px; font-size: 13px; cursor: pointer; color: var(--text); }
  .data-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  .data-table thead th { background: var(--blue-tint); color: var(--text); font-weight: 700; font-size: 12.5px; text-transform: none; padding: 11px 16px; border-bottom: 1px solid var(--border); white-space: nowrap; }
  .data-table th.sortable { cursor: pointer; user-select: none; }
  .data-table th.sortable .sort-arrow { color: var(--muted); font-size: 10px; margin-left: 3px; }
  .data-table tbody td { padding: 12px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  .data-table tbody tr:last-child td { border-bottom: none; }
  .data-table tbody tr:hover { background: var(--bg); }
  .data-table .cell-muted { color: var(--muted); }
  .data-table .cell-name { display: flex; align-items: center; gap: 10px; }
  .data-table .cell-indent { padding-left: 22px; }
  .data-table .cell-indent-2 { padding-left: 44px; }
  .table-empty-row td { text-align: center; color: var(--muted); padding: 32px 16px; }

  /* expandable company/dept/person rows inside a .data-table (조직도) */
  .dept-group-row td { font-weight: 600; }
  .dept-group-row .dept-count { font-weight: 400; }
  .expand-cell { text-align: center; }
  .expand-btn {
    border: none; background: none; cursor: pointer; color: var(--muted); font-size: 11px;
    width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center;
    border-radius: 6px;
  }
  .expand-btn:hover { background: var(--bg); color: var(--text); }
  .dept-icon { color: var(--blue); display: inline-flex; }
  .person-icon { color: var(--muted); display: inline-flex; }

  .switch { position: relative; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; border: none; background: none; padding: 0; font: inherit; }
  .switch .track { width: 40px; height: 22px; border-radius: 11px; background: var(--border); position: relative; transition: background .15s; flex-shrink: 0; }
  .switch .track::after { content: ''; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(16,24,40,.25); transition: transform .15s; }
  .switch.on .track { background: var(--warn); }
  .switch.on .track::after { transform: translateX(18px); }
  .switch .switch-label { font-size: 11.5px; font-weight: 700; color: var(--muted); min-width: 26px; }
  .switch.on .switch-label { color: var(--warn); }

  .table-pagination { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; flex-wrap: wrap; gap: 12px; }
  .table-pagination .page-size { padding: 7px 10px; border: 1px solid var(--border); border-radius: 10px; font-size: 12.5px; background: #fff; }
  .table-pagination .page-nav { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
  .table-pagination .page-nav button { border: 1px solid var(--border); background: #fff; border-radius: 8px; width: 28px; height: 28px; cursor: pointer; color: var(--text); }
  .table-pagination .page-nav button:disabled { opacity: .4; cursor: default; }
  .table-pagination .page-count { font-size: 12.5px; color: var(--muted); }
  .table-toolbar-btn { background: var(--blue-tint); color: var(--blue); border: 1px solid #bcd3ef; padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }

  .dept-chip-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .dept-chip { display: inline-flex; align-items: center; gap: 6px; background: var(--card); border: 1px solid var(--border); border-radius: 20px; padding: 5px 8px 5px 6px; font-size: 12.5px; }
  .dept-chip-count { color: var(--muted); font-size: 11px; }
  .dept-chip-x { border: none; background: none; color: var(--muted); cursor: pointer; font-size: 15px; line-height: 1; padding: 0 2px; }
  .dept-chip-x:hover { color: var(--deny); }
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
<head><meta charset="utf-8"><title>${title} · OfficeBridge</title>
<link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.css">
<style>${CSS}</style></head>
<body>${bodyHtml}</body>
</html>`;
}

function loginPage({ next = '/', error = '', companyCode = '', email = '', needsMfa = false } = {}) {
  next = escapeHtml(next);
  error = escapeHtml(error);
  companyCode = escapeHtml(companyCode);
  email = escapeHtml(email);

  return shell('로그인', `
    <div class="center-page">
      <div class="login-box">
        <h1>OfficeBridge</h1>
        <div class="sub">VPN 없이 브라우저로 접속</div>
        ${error ? `<div class="error-box">${error}</div>` : ''}
        <form method="POST" action="/_ob/login">
          <input type="hidden" name="next" value="${next}">
          <input type="text" name="companyCode" id="companyCode" placeholder="회사코드" value="${companyCode}" required>
          <input type="email" name="email" id="email" placeholder="이메일" value="${email}" required>
          <input type="password" name="password" id="password" placeholder="비밀번호" required>
          ${needsMfa ? `<input type="text" name="totpCode" id="totpCode" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="2차 인증 코드 (6자리)" autofocus required>` : ''}
          <button class="btn" style="width:100%" type="submit">로그인</button>
        </form>
      </div>
    </div>
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
