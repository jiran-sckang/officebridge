// Stand-in for a future Bridge-app "SSH 서비스" tile: authenticates the same
// way the real Bridge app does (company code + email/password -> a personal
// bridge token, saved locally so you only log in once), then exposes one
// tcp:// service as a plain local TCP port. Point ssh/mstsc/a DB client at
// 127.0.0.1:<LOCAL_PORT> and its bytes ride the same relay<->connector
// tunnel as everything else — see relay/tunnel.js's openTcpChannel and
// connector/index.js's handleTcpOpen for the other two hops.
const https = require('https');
const net = require('net');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const config = require('./config');

const TOKEN_FILE = path.join(__dirname, '.bridge-token.json');

function prompt(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (hidden) {
      rl._writeToOutput = (s) => rl.output.write(/^\r?\n/.test(s) ? s : '*'.repeat(s.length));
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

function postJson(pathname, body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body));
    const req = https.request(
      {
        hostname: config.RELAY_DOMAIN,
        port: config.RELAY_PORT,
        path: pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
        rejectUnauthorized: config.REJECT_UNAUTHORIZED,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let parsed;
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch {
            parsed = { raw };
          }
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
          else reject(Object.assign(new Error(parsed.reason || raw || `HTTP ${res.statusCode}`), { status: res.statusCode }));
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function getBridgeToken() {
  if (fs.existsSync(TOKEN_FILE)) {
    const saved = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    if (saved.bridgeToken) return saved.bridgeToken;
  }
  console.log(`처음 실행이네요 — ${config.COMPANY_CODE} 계정으로 로그인해서 브릿지 토큰을 발급받습니다.`);
  const email = await prompt('이메일: ');
  const password = await prompt('비밀번호: ', { hidden: true });
  const result = await postJson('/_ob/api/bridge/register', { companyCode: config.COMPANY_CODE, email, password });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({ bridgeToken: result.bridgeToken, email }, null, 2));
  console.log(`로그인 완료 (${result.name}, ${result.dept}) — 토큰을 ${TOKEN_FILE}에 저장했습니다.`);
  return result.bridgeToken;
}

async function exchangeSession(bridgeToken) {
  const result = await postJson('/_ob/api/bridge/exchange', { token: bridgeToken });
  return result;
}

function pipeSocketToTunnel(localSocket, sessionId) {
  const url = `wss://${config.RELAY_DOMAIN}:${config.RELAY_PORT}/tunnel/ssh?service=${encodeURIComponent(config.SERVICE)}`;
  const ws = new WebSocket(url, {
    headers: { Cookie: `ob_session=${sessionId}` },
    rejectUnauthorized: config.REJECT_UNAUTHORIZED,
  });

  ws.on('open', () => {
    localSocket.on('data', (chunk) => { if (ws.readyState === WebSocket.OPEN) ws.send(chunk); });
  });
  ws.on('message', (data) => localSocket.write(Buffer.isBuffer(data) ? data : Buffer.from(data)));
  ws.on('close', () => localSocket.destroy());
  ws.on('error', (err) => {
    console.error('[ssh-client] tunnel error:', err.message);
    localSocket.destroy();
  });

  localSocket.on('close', () => ws.close());
  localSocket.on('error', () => ws.close());
}

async function main() {
  const bridgeToken = await getBridgeToken();
  const { sessionId, services } = await exchangeSession(bridgeToken);
  if (!services.some((s) => s.name === config.SERVICE)) {
    console.error(`"${config.SERVICE}" 서비스에 대한 접근 권한이 없습니다. 사용 가능한 서비스: ${services.map((s) => s.name).join(', ') || '(없음)'}`);
    process.exit(1);
  }
  const server = net.createServer((socket) => pipeSocketToTunnel(socket, sessionId));
  server.listen(config.LOCAL_PORT, '127.0.0.1', () => {
    console.log(`[ssh-client] "${config.SERVICE}" -> 127.0.0.1:${config.LOCAL_PORT} 로 터널 시작`);
    console.log(`예: ssh -p ${config.LOCAL_PORT} <내부계정>@127.0.0.1`);
  });
}

main().catch((err) => {
  console.error('[ssh-client] 실패:', err.message);
  process.exit(1);
});
