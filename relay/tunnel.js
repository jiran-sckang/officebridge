// Owns the single outbound WSS tunnel from the customer-network connector.
// Relay never opens an inbound port toward the customer network — the
// connector always initiates. This module just multiplexes request/response
// envelopes over that one connection by id.
const WebSocket = require('ws');
const crypto = require('crypto');
const policy = require('./policy');
const auth = require('./auth');

let connectorSocket = null;
let currentOperator = null; // admin email that authenticated this connection, or null for the legacy static token
let registeredServices = new Map(); // name -> internalAddress, as currently reported by the connector
const pending = new Map(); // id -> { resolve, reject, timeout }

// Raw TCP channels (SSH/RDP-style forwarding) multiplexed over the same
// single connector socket, alongside the request/response traffic above.
// Each channel id maps to whoever is consuming the bytes on the relay side
// (see server.js's /tunnel/ssh upgrade handler) — this module doesn't know
// or care what that consumer is, it just ferries data + lifecycle events.
const tcpChannels = new Map(); // id -> { onData, onClose }
const pendingTcpOpens = new Map(); // id -> { resolve, reject, timeout }

function validateToken(token) {
  return auth.validateConnectorToken(token).ok;
}

function getOperator() {
  return currentOperator;
}

// Force-closes the live tunnel — used when an admin revokes a connector
// operator's token and wants that session to stop immediately rather than
// wait for it to notice on its own.
function disconnectCurrent() {
  if (connectorSocket) connectorSocket.close();
}

function acceptConnection(ws, token) {
  connectorSocket = ws;
  currentOperator = auth.validateConnectorToken(token).email;
  registeredServices = new Map();
  console.log('[relay] connector tunnel established', currentOperator ? `(operator: ${currentOperator})` : '(legacy token)');

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
    } else if (msg.type === 'tcp-open-ack') {
      const p = pendingTcpOpens.get(msg.id);
      if (p) {
        clearTimeout(p.timeout);
        pendingTcpOpens.delete(msg.id);
        p.resolve(msg.id);
      }
    } else if (msg.type === 'tcp-open-error') {
      const p = pendingTcpOpens.get(msg.id);
      if (p) {
        clearTimeout(p.timeout);
        pendingTcpOpens.delete(msg.id);
        tcpChannels.delete(msg.id);
        p.reject(Object.assign(new Error(msg.reason || 'connector refused tcp-open'), { code: 'UPSTREAM_REFUSED' }));
      }
    } else if (msg.type === 'tcp-data') {
      const ch = tcpChannels.get(msg.id);
      if (ch) ch.onData(Buffer.from(msg.data, 'base64'));
    } else if (msg.type === 'tcp-close') {
      const ch = tcpChannels.get(msg.id);
      if (ch) {
        tcpChannels.delete(msg.id);
        ch.onClose();
      }
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    if (connectorSocket === ws) {
      connectorSocket = null;
      currentOperator = null;
      registeredServices = new Map();
    }
    // The whole tunnel dropped — every open tcp channel riding on it is dead
    // too, even though nothing told us so explicitly. Tell each consumer.
    for (const [id, ch] of tcpChannels) {
      tcpChannels.delete(id);
      ch.onClose();
    }
    for (const [id, p] of pendingTcpOpens) {
      pendingTcpOpens.delete(id);
      clearTimeout(p.timeout);
      p.reject(Object.assign(new Error('tunnel closed'), { code: 'NO_CONNECTOR' }));
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

// Opens a raw byte-stream channel to a service the connector serves —
// used for TCP-style access (SSH, RDP, DB clients) as opposed to the
// HTTP request/response forwarding above. Resolves once the connector
// confirms it actually connected to the internal target, with a small
// controller for sending bytes in and closing the channel.
function openTcpChannel(serviceName, { onData, onClose }, timeoutMs = 10000) {
  if (!servesService(serviceName)) {
    return Promise.reject(Object.assign(new Error('no connector for service'), { code: 'NO_CONNECTOR' }));
  }
  const id = crypto.randomUUID();
  const opened = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingTcpOpens.delete(id);
      tcpChannels.delete(id);
      reject(Object.assign(new Error('upstream timeout'), { code: 'TIMEOUT' }));
    }, timeoutMs);
    pendingTcpOpens.set(id, { resolve, reject, timeout });
    tcpChannels.set(id, { onData, onClose });
    connectorSocket.send(JSON.stringify({ type: 'tcp-open', id, service: serviceName }));
  });
  return opened.then(() => ({
    id,
    send(buf) {
      if (connectorSocket && connectorSocket.readyState === WebSocket.OPEN) {
        connectorSocket.send(JSON.stringify({ type: 'tcp-data', id, data: buf.toString('base64') }));
      }
    },
    close() {
      tcpChannels.delete(id);
      if (connectorSocket && connectorSocket.readyState === WebSocket.OPEN) {
        connectorSocket.send(JSON.stringify({ type: 'tcp-close', id }));
      }
    },
  }));
}

module.exports = {
  validateToken,
  acceptConnection,
  isConnected,
  getOperator,
  disconnectCurrent,
  servesService,
  getRegisteredServices,
  getRegisteredServiceAddress,
  forward,
  openTcpChannel,
};
