// RFC 6238 TOTP (Google Authenticator-compatible) — no external dependency.
// SHA1 / 6 digits / 30s step, matching Google Authenticator's defaults.
const crypto = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function randomBase32(byteLength = 20) {
  const bytes = crypto.randomBytes(byteLength);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
}

function base32Decode(base32) {
  const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secretBuffer, counter) {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secretBuffer).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1000000).toString().padStart(6, '0');
}

function currentCounter(stepSeconds = 30) {
  return Math.floor(Date.now() / 1000 / stepSeconds);
}

// window=1 tolerates ±30s clock drift between the phone and this server.
function verifyTotp(base32Secret, token, window = 1) {
  if (!base32Secret || !token || !/^\d{6}$/.test(String(token))) return false;
  const secretBuffer = base32Decode(base32Secret);
  const counter = currentCounter();
  for (let drift = -window; drift <= window; drift++) {
    if (hotp(secretBuffer, counter + drift) === String(token)) return true;
  }
  return false;
}

function otpauthUri(secret, accountEmail, issuer = 'OfficeBridge') {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

module.exports = { randomBase32, verifyTotp, otpauthUri };
