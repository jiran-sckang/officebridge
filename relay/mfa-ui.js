// Personal MFA enrollment/status card — shared between the admin console's
// own /security page (for the connector app, admin-only) and the portal's
// self-service page (for the bridge app, any employee). Both call sites
// manage only their OWN account's MFA (auth.startMfaEnroll(session.email)
// and friends already ignore any other email), so the same three action
// names work under either route prefix.
const QRCode = require('qrcode');

// A small synchronous SVG renderer for QRCode.create()'s module matrix —
// avoids making the page-render call chain async just to await the
// library's toDataURL()/toString() wrappers, which only exist for API
// consistency with their (genuinely async) file-writing counterparts.
function qrSvg(text, size = 176) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const count = modules.size;
  const cell = size / count;
  let rects = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (modules.get(row, col)) {
        rects += `<rect x="${(col * cell).toFixed(2)}" y="${(row * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}

// actionBase: '/admin' or '/portal' — whichever route prefix the caller
// mounted these three actions under (see server.js's SELF_SERVICE_ACTIONS).
// appLabel: which app this account's MFA actually gates ('커넥터 앱' or
// '브릿지 앱') — purely for the copy, so the reader knows what it's for.
function renderMfaCard(status, query, actionBase, appLabel) {
  if (status.enrolled) {
    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:16px">
          <div>
            <div style="font-weight:600;margin-bottom:4px">2차 인증 활성화됨</div>
            <div class="muted" style="font-size:13px">${appLabel} 로그인 시 비밀번호 다음 단계로 Google Authenticator 코드가 필요합니다.</div>
          </div>
          <form class="inline" method="POST" action="/_ob/api${actionBase}/security/mfa-disable"><button class="btn danger" type="submit">비활성화</button></form>
        </div>
      </div>`;
  }

  if (status.pending) {
    const errorBox = query.mfaError ? '<div class="error-box">코드가 올바르지 않습니다. 다시 시도해주세요.</div>' : '';
    return `
      <div class="card">
        <div style="font-weight:600;margin-bottom:10px">1단계 — Google Authenticator에 등록</div>
        <div class="muted" style="font-size:13px;margin-bottom:12px">
          Google Authenticator 앱의 "코드 스캔"으로 아래 QR을 찍으세요.
        </div>
        <div style="background:#fff;border:1px solid var(--border);border-radius:6px;padding:16px;margin-bottom:12px;display:inline-block">
          ${qrSvg(status.pendingUri)}
        </div>
        <details style="margin-bottom:16px">
          <summary style="cursor:pointer;font-size:13px;color:var(--muted)">QR을 스캔할 수 없나요? 수동 입력 키 보기</summary>
          <div style="font-family:'SFMono-Regular',Consolas,monospace;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;font-size:15px;letter-spacing:1px;margin-top:8px;word-break:break-all">
            ${status.pendingSecret}
          </div>
        </details>
        <div style="font-weight:600;margin-bottom:8px">2단계 — 앱에 뜨는 6자리 코드 입력해서 확인</div>
        ${errorBox}
        <form method="POST" action="/_ob/api${actionBase}/security/mfa-confirm" style="max-width:200px">
          <input type="text" name="code" inputmode="numeric" maxlength="6" placeholder="123456" required autofocus>
          <button class="btn" type="submit" style="margin-top:10px">확인</button>
        </form>
      </div>`;
  }

  return `
    <div class="card">
      <div style="font-weight:600;margin-bottom:6px">${status.required ? '2차 인증이 필수로 지정되어 있습니다' : '2차 인증이 꺼져있습니다'}</div>
      <div class="muted" style="font-size:13px;margin-bottom:14px">
        ${status.required
          ? `관리자가 이 계정에 2차 인증을 필수로 지정했습니다 — 등록 전까지는 ${appLabel} 로그인이 막힙니다. 지금 등록해주세요.`
          : `${appLabel}은 비밀번호만으로 로그인할 수 있어, 비밀번호 하나가 뚫리면 그대로 뚫립니다. Google Authenticator 기반 2차 인증을 켜두는 걸 권장합니다.`}
      </div>
      <form class="inline" method="POST" action="/_ob/api${actionBase}/security/mfa-start"><button class="chip off" type="submit">2차 인증 설정 시작</button></form>
    </div>`;
}

module.exports = { qrSvg, renderMfaCard };
