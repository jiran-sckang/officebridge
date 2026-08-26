// Shared, persisted state for this connector: the domain (service name) ->
// internal address map, each with a local enabled/disabled switch. This is
// the connector operator's own policy layer, independent of whatever the
// relay's admin console allows — disabling a service here blocks it even if
// the relay would otherwise route to it.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'services.json');
const listeners = [];

let services = load();

function load() {
  const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  return new Map(Object.entries(raw));
}

function persist() {
  const obj = Object.fromEntries(services);
  fs.writeFileSync(FILE, JSON.stringify(obj, null, 2));
}

function notify() {
  for (const fn of listeners) fn(getAll());
}

function onChange(fn) {
  listeners.push(fn);
}

function getAll() {
  return Array.from(services.entries()).map(([name, s]) => ({ name, ...s }));
}

// Only enabled services are announced to the relay / actually forwarded to.
function enabledAddresses() {
  const out = new Map();
  for (const [name, s] of services) {
    if (s.enabled) out.set(name, s.internalAddress);
  }
  return out;
}

function upsert(name, internalAddress, enabled = true) {
  services.set(name, { internalAddress, enabled });
  persist();
  notify();
}

function remove(name) {
  services.delete(name);
  persist();
  notify();
}

function setEnabled(name, enabled) {
  const s = services.get(name);
  if (!s) return false;
  s.enabled = enabled;
  persist();
  notify();
  return true;
}

module.exports = { getAll, enabledAddresses, upsert, remove, setEnabled, onChange };
