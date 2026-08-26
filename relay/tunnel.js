// Owns the single outbound WSS tunnel from the customer-network connector.
// Relay never opens an inbound port toward the customer network — the
// connector always initiates. This module just multiplexes request/response
// envelopes over that one connection by id.
const WebSocket = require('ws');
const crypto = require('crypto');
const { loadJson } = require('./store');
const policy = require('./policy');

let connectorSocket = null;
let registeredServices = new Map(); // name -> internalAddress, as currently reported by the connector
const pending = new Map(); // id -> { resolve, reject, timeout }

function getToken() {
  return loadJson('tokens.json').connectorToken;
}

function validateToken(token) {
  return token === getToken();
}

function acceptConnection(ws) {
  connectorSocket = ws;
  registeredServices = new Map();
  console.log('[relay] connector tunnel established');

  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.ping();
  }, 30000);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type === 'register') {
      const entries = (msg.services || []).filter((e) => e && typeof e.name === 'string' && e.name);
      registeredServices = new Map(entries.map((e) => [e.name, e.internalAddress]));
      entries.forEach((e) => policy.ensureService(e.name));
      console.log('[relay] connector serves:', entries.map((e) => e.name).join(', '));
    } else if (msg.type === 'response') {
      const p = pending.get(msg.id);
      if (p) {
        clearTimeout(p.timeout);
        pending.delete(msg.id);
        p.resolve(msg);
      }
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    if (connectorSocket === ws) {
      connectorSocket = null;
      registeredServices = new Map();
    }
    console.log('[relay] connector tunnel closed');
  });

  ws.on('error', (err) => console.error('[relay] tunnel error:', err.message));
}

function isConnected() {
  return connectorSocket !== null && connectorSocket.readyState === WebSocket.OPEN;
}

function servesService(name) {
  return isConnected() && registeredServices.has(name);
}

function getRegisteredServices() {
  return Array.from(registeredServices.keys());
}

// The internal address as currently reported by the connector — live, not
// stored — so this always reflects whatever the connector operator has
// actually configured, even if it changed after this service was first seen.
function getRegisteredServiceAddress(name) {
  return registeredServices.get(name);
}

function forward(serviceName, method, reqPath, headers, bodyBuffer, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    if (!servesService(serviceName)) {
      return reject(Object.assign(new Error('no connector for service'), { code: 'NO_CONNECTOR' }));
    }
    const id = crypto.randomUUID();
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(Object.assign(new Error('upstream timeout'), { code: 'TIMEOUT' }));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timeout });
    connectorSocket.send(
      JSON.stringify({
        type: 'request',
        id,
        service: serviceName,
        method,
        path: reqPath,
        headers,
        body: bodyBuffer && bodyBuffer.length ? bodyBuffer.toString('base64') : undefined,
      })
    );
  });
}

module.exports = {
  validateToken,
  acceptConnection,
  isConnected,
  servesService,
  getRegisteredServices,
  getRegisteredServiceAddress,
  forward,
};
