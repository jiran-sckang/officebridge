const fs = require('fs');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'data', 'audit.log');
const RING_SIZE = 1000;

const ring = [];
const emitter = new EventEmitter();
emitter.setMaxListeners(50);

function log({ type, verdict, user = '-', service = '-', ip = '-', reason = '' }) {
  const event = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    type,       // LOGIN | LOGOUT | ACCESS | ADMIN | SYSTEM
    verdict,    // OK | FAIL | ALLOW | DENY
    user,
    service,
    ip,
    reason,
  };

  ring.push(event);
  if (ring.length > RING_SIZE) ring.shift();

  fs.appendFile(LOG_FILE, JSON.stringify(event) + '\n', (err) => {
    if (err) console.error('audit.log write failed:', err.message);
  });

  emitter.emit('event', event);
  return event;
}

function getRecent({ type, verdict, limit = 200 } = {}) {
  let events = ring;
  if (type) events = events.filter((e) => e.type === type);
  if (verdict) events = events.filter((e) => e.verdict === verdict);
  return events.slice(-limit).reverse();
}

function subscribe(callback) {
  emitter.on('event', callback);
  return () => emitter.off('event', callback);
}

module.exports = { log, getRecent, subscribe };
