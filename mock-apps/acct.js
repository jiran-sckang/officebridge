const http = require('http');

const PORT = 8084;
const PAGE = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>회계관리 로그인</title>
<style>
  body{font-family:'Segoe UI',sans-serif;background:#4a2f6b;height:100vh;margin:0;display:flex;align-items:center;justify-content:center}
  .box{background:#fff;padding:40px 48px;border-radius:8px;width:340px;box-shadow:0 10px 30px rgba(0,0,0,.3)}
  h1{font-size:22px;color:#4a2f6b;margin:0 0 4px}
  p.sub{color:#888;font-size:13px;margin:0 0 24px}
  input{width:100%;padding:10px;margin-bottom:12px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box}
  button{width:100%;padding:10px;background:#4a2f6b;color:#fff;border:none;border-radius:4px;font-size:14px;cursor:pointer}
  .badge{display:inline-block;background:#ece5f4;color:#4a2f6b;font-size:11px;padding:2px 8px;border-radius:10px;margin-bottom:16px}
</style></head>
<body>
  <div class="box">
    <div class="badge">OfficeBridge 터널 경유</div>
    <h1>회계관리</h1>
    <p class="sub">전표·정산·세무 관리 (온보딩 시연용, 기본 미등록)</p>
    <input placeholder="아이디" disabled>
    <input placeholder="비밀번호" type="password" disabled>
    <button disabled>로그인 (데모 목업)</button>
  </div>
</body></html>`;

http.createServer((req, res) => {
  console.log(`[acct:${PORT}] ${req.method} ${req.url}`);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(PAGE);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Acct mock app listening on 127.0.0.1:${PORT}`);
});
