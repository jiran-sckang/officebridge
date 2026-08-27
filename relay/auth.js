const crypto = require('crypto');
const { loadJson, saveJson } = require('./store');
const rules = require('./rules');

let users = loadJson('users.json');
let bridgeTokens = loadJson('bridge-tokens.json'); // token -> { email, createdAt, lastUsedAt }
const sessions = new Map(); // sessionId -> { id, email, name, dept, role, ip, loginAt, lastSeenAt }

function persistUsers() {
  saveJson('users.json', users);
}

function persistBridgeTokens() {
  saveJson('bridge-tokens.json', bridgeTokens);
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

// Returns { ok, sessionId } on success, or { ok: false, reason } on failure.
function login(email, password, ip) {
  const user = users[email];
  if (!user) return { ok: false, reason: '존재하지 않는 계정입니다.' };
  if (user.blocked) return { ok: false, reason: '차단된 계정입니다. 관리자에게 문의하세요.' };
  if (isLocked(user)) {
    const mins = Math.ceil((user.lockedUntil - Date.now()) / 60000);
    return { ok: false, reason: `로그인 연속 실패로 계정이 잠겼습니다. 약 ${mins}분 후 다시 시도하세요.` };
  }

  if (user.passwordHash !== sha256(password)) {
    const { maxFailures, windowMinutes, lockMinutes } = rules.getConfig().loginLockout;
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
};
