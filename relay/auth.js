const crypto = require('crypto');
const { loadJson, saveJson } = require('./store');
const rules = require('./rules');

let users = loadJson('users.json');
const sessions = new Map(); // sessionId -> { id, email, name, dept, role, ip, loginAt, lastSeenAt }

function persistUsers() {
  saveJson('users.json', users);
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
  return { ok: true, sessionId };
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
  login,
  getSession,
  destroySession,
  listActiveSessions,
  blockUser,
  unblockUser,
  unlockUser,
};
