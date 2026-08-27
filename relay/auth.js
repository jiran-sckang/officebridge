const crypto = require('crypto');
const { loadJson, saveJson } = require('./store');
const rules = require('./rules');

let users = loadJson('users.json');
let bridgeTokens = loadJson('bridge-tokens.json'); // token -> { email, createdAt, lastUsedAt }
let connectorTokens = loadJson('connector-tokens.json'); // token -> { email, createdAt, lastUsedAt }
const sessions = new Map(); // sessionId -> { id, email, name, dept, role, ip, loginAt, lastSeenAt }

function persistUsers() {
  saveJson('users.json', users);
}

function persistBridgeTokens() {
  saveJson('bridge-tokens.json', bridgeTokens);
}

function persistConnectorTokens() {
  saveJson('connector-tokens.json', connectorTokens);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getUser(email) {
  return users[email];
}

function listUsers() {
  return users;
}

// Creates a new employee (org chart entry). Used by the admin's org chart
// page — separate from self-service signup, which this product doesn't have.
function createUser(email, { name, dept, password, role = 'user' }) {
  if (users[email]) return { ok: false, reason: '이미 존재하는 이메일입니다.' };
  users[email] = {
    name,
    dept,
    role,
    passwordHash: sha256(password),
    failedAttempts: 0,
    lockedUntil: null,
    blocked: false,
  };
  persistUsers();
  return { ok: true };
}

function createSession(email, ip) {
  const user = users[email];
  const sessionId = crypto.randomUUID();
  const now = Date.now();
  sessions.set(sessionId, {
    id: sessionId,
    email,
    name: user.name,
    dept: user.dept,
    role: user.role,
    ip,
    loginAt: now,
    lastSeenAt: now,
  });
  return sessionId;
}

function isLocked(user) {
  return user.lockedUntil && Date.now() < user.lockedUntil;
}

// Shared by web login and bridge-app registration: checks blocked/locked
// state and the password itself, and tracks lockout on failure. Does NOT
// enforce bridgeOnlyAccess — that's a web-specific restriction, and the
// bridge app registering itself is the sanctioned alternative to it, not
// something it should be blocked by too.
function verifyPassword(email, password) {
  const user = users[email];
  if (!user) return { ok: false, reason: '존재하지 않는 계정입니다.' };
  if (user.blocked) return { ok: false, reason: '차단된 계정입니다. 관리자에게 문의하세요.' };
  if (isLocked(user)) {
    const mins = Math.ceil((user.lockedUntil - Date.now()) / 60000);
    return { ok: false, reason: `로그인 연속 실패로 계정이 잠겼습니다. 약 ${mins}분 후 다시 시도하세요.` };
  }

  if (user.passwordHash !== sha256(password)) {
    const { maxFailures, lockMinutes } = rules.getConfig().loginLockout;
    user.failedAttempts = (user.failedAttempts || 0) + 1;
    user.lastFailureAt = Date.now();
    if (user.failedAttempts >= maxFailures) {
      user.lockedUntil = Date.now() + lockMinutes * 60 * 1000;
      user.failedAttempts = 0;
      persistUsers();
      return { ok: false, reason: `비밀번호 ${maxFailures}회 연속 실패로 ${lockMinutes}분간 계정이 잠겼습니다.` };
    }
    persistUsers();
    return { ok: false, reason: '비밀번호가 올바르지 않습니다.' };
  }

  user.failedAttempts = 0;
  user.lockedUntil = null;
  persistUsers();
  return { ok: true, user };
}

// Returns { ok, sessionId } on success, or { ok: false, reason } on failure.
function login(email, password, ip) {
  // Admins always keep web access — otherwise turning bridgeOnlyAccess on
  // could lock everyone, including the admin who'd need to turn it back
  // off, out of the console at the same time.
  const user = users[email];
  if (user && rules.getConfig().bridgeOnlyAccess.enabled && user.role !== 'admin') {
    return { ok: false, reason: '포털(웹) 로그인이 제한되어 있습니다. OfficeBridge 브릿지 앱으로 접속해주세요.' };
  }
  const result = verifyPassword(email, password);
  if (!result.ok) return result;
  return { ok: true, sessionId: createSession(email, ip) };
}

// ---- Personal bridge tokens (F-11) --------------------------------------
// A long-lived, per-employee credential the admin issues from the org chart
// page. It's never used as a session itself — only to mint a real session
// (same kind password login creates) without the employee typing a
// password, so the desktop bridge app can open them straight into their
// allowed systems.

function issueBridgeToken(email) {
  if (!users[email]) return null;
  // one live token per employee — reissuing invalidates the old one
  for (const [t, info] of Object.entries(bridgeTokens)) {
    if (info.email === email) delete bridgeTokens[t];
  }
  const token = crypto.randomBytes(24).toString('hex');
  bridgeTokens[token] = { email, createdAt: Date.now(), lastUsedAt: null };
  persistBridgeTokens();
  return token;
}

function revokeBridgeToken(email) {
  let revoked = false;
  for (const [t, info] of Object.entries(bridgeTokens)) {
    if (info.email === email) {
      delete bridgeTokens[t];
      revoked = true;
    }
  }
  if (revoked) persistBridgeTokens();
  return revoked;
}

function getBridgeTokenFor(email) {
  const entry = Object.entries(bridgeTokens).find(([, info]) => info.email === email);
  return entry ? entry[0] : null;
}

// One-time app setup: the bridge app itself verifies the employee's normal
// password (same one they'd use on the portal) and gets a personal token
// back to keep — no admin has to manually generate and hand over a file.
function registerBridge(email, password) {
  const result = verifyPassword(email, password);
  if (!result.ok) return result;
  return { ok: true, bridgeToken: issueBridgeToken(email), user: result.user };
}

// ---- Personal connector operator tokens ----------------------------------
// Same shape as bridge tokens, but issued only to admins and consumed by
// tunnel.js directly (never exchanged for a browser session) — this is what
// replaces the old single hardcoded shared CONNECTOR_TOKEN. Operating a
// connector now requires an actual admin login, and each login is
// individually attributable and revocable.

function issueConnectorToken(email) {
  if (!users[email]) return null;
  for (const [t, info] of Object.entries(connectorTokens)) {
    if (info.email === email) delete connectorTokens[t];
  }
  const token = crypto.randomBytes(24).toString('hex');
  connectorTokens[token] = { email, createdAt: Date.now(), lastUsedAt: null };
  persistConnectorTokens();
  return token;
}

function revokeConnectorToken(email) {
  let revoked = false;
  for (const [t, info] of Object.entries(connectorTokens)) {
    if (info.email === email) {
      delete connectorTokens[t];
      revoked = true;
    }
  }
  if (revoked) persistConnectorTokens();
  return revoked;
}

// Admin-only counterpart to registerBridge — only an admin account can stand
// up a connector. Reissuing invalidates whatever token that admin had
// running before, same as bridge tokens.
function registerConnector(email, password) {
  const result = verifyPassword(email, password);
  if (!result.ok) return result;
  if (result.user.role !== 'admin') return { ok: false, reason: '커넥터는 관리자 계정으로만 실행할 수 있습니다.' };
  return { ok: true, connectorToken: issueConnectorToken(email), user: result.user };
}

// Used by tunnel.js to accept either a dynamically-issued operator token or
// the legacy static shared token (data/tokens.json) for backward
// compatibility with connector-kit deployments that haven't switched over.
// Returns the owning admin's email for dynamic tokens, or null for the
// legacy token (no individual attribution possible for that one).
function validateConnectorToken(token) {
  const legacy = loadJson('tokens.json').connectorToken;
  if (token === legacy) return { ok: true, email: null };
  const info = connectorTokens[token];
  if (!info) return { ok: false };
  info.lastUsedAt = Date.now();
  persistConnectorTokens();
  return { ok: true, email: info.email };
}

// Exchanges a bridge token for a real session, exactly as if the employee
// had logged in with a password. Returns { ok, sessionId, user } or
// { ok: false, reason }.
function exchangeBridgeToken(token, ip) {
  const info = bridgeTokens[token];
  if (!info) return { ok: false, reason: 'invalid token' };
  const user = users[info.email];
  if (!user || user.blocked) return { ok: false, reason: 'account unavailable' };
  info.lastUsedAt = Date.now();
  persistBridgeTokens();
  return { ok: true, sessionId: createSession(info.email, ip), email: info.email, user };
}

function getSession(sessionId) {
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  if (!session) return null;
  const user = users[session.email];
  if (!user || user.blocked) return null;
  session.lastSeenAt = Date.now();
  return session;
}

function destroySession(sessionId) {
  rules.clearRateLimit(sessionId);
  return sessions.delete(sessionId);
}

function listActiveSessions() {
  return Array.from(sessions.values());
}

function blockUser(email) {
  const user = users[email];
  if (!user) return false;
  user.blocked = true;
  persistUsers();
  for (const [id, s] of sessions) {
    if (s.email === email) destroySession(id);
  }
  return true;
}

function unblockUser(email) {
  const user = users[email];
  if (!user) return false;
  user.blocked = false;
  persistUsers();
  return true;
}

function unlockUser(email) {
  const user = users[email];
  if (!user) return false;
  user.failedAttempts = 0;
  user.lockedUntil = null;
  persistUsers();
  return true;
}

module.exports = {
  getUser,
  listUsers,
  createUser,
  login,
  getSession,
  destroySession,
  listActiveSessions,
  blockUser,
  unblockUser,
  unlockUser,
  issueBridgeToken,
  revokeBridgeToken,
  getBridgeTokenFor,
  exchangeBridgeToken,
  registerBridge,
  issueConnectorToken,
  revokeConnectorToken,
  registerConnector,
  validateConnectorToken,
};
