const { loadJson, saveJson } = require('./store');

let config = loadJson('rules-config.json');

// sessionId -> array of request timestamps (ms), for the rate-limit window
const requestLog = new Map();

function getConfig() {
  return config;
}

function setConfig(patch) {
  config = { ...config, ...patch };
  saveJson('rules-config.json', config);
  return config;
}

function currentHour() {
  return new Date().getHours();
}

function checkBusinessHours() {
  const c = config.businessHours;
  if (!c.enabled) return null;
  const h = currentHour();
  if (h < c.startHour || h >= c.endHour) {
    return { reason: `[행위기반] 업무시간 외 접속 차단 (허용: ${c.startHour}시~${c.endHour}시)`, terminateSession: false };
  }
  return null;
}

function checkRateLimit(sessionId) {
  const c = config.rateLimit;
  if (!c.enabled) return null;
  const now = Date.now();
  const windowMs = c.windowSeconds * 1000;
  const timestamps = (requestLog.get(sessionId) || []).filter((t) => now - t < windowMs);
  timestamps.push(now);
  requestLog.set(sessionId, timestamps);
  if (timestamps.length > c.maxRequests) {
    return { reason: `[행위기반] 과도한 요청 감지 (${c.windowSeconds}초 내 ${timestamps.length}회, 자동화 의심)`, terminateSession: false };
  }
  return null;
}

function checkSessionIpPin(session, ip) {
  const c = config.sessionIpPin;
  if (!c.enabled) return null;
  if (session.ip !== ip) {
    return { reason: `[행위기반] 세션 IP 변경 감지 (탈취 의심, 최초 ${session.ip} → 현재 ${ip})`, terminateSession: true };
  }
  return null;
}

function checkSessionMaxAge(session) {
  const c = config.sessionMaxAge;
  if (!c.enabled) return null;
  const ageHours = (Date.now() - session.loginAt) / 1000 / 60 / 60;
  if (ageHours > c.maxHours) {
    return { reason: `[행위기반] 세션 최대 수명 초과 (${c.maxHours}시간)`, terminateSession: true };
  }
  return null;
}

// Runs all deterministic continuous-verification rules for one incoming request.
// Returns null if the request passes, or { reason, terminateSession } for the first violated rule.
function checkContinuous(session, ip) {
  return (
    checkSessionMaxAge(session) ||
    checkSessionIpPin(session, ip) ||
    checkBusinessHours() ||
    checkRateLimit(session.id)
  );
}

function clearRateLimit(sessionId) {
  requestLog.delete(sessionId);
}

module.exports = { getConfig, setConfig, checkContinuous, clearRateLimit };
