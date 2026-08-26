// Read-only data for the connector's local admin web UI: which
// departments/individuals are granted access to the services this connector
// currently serves, and recent access logs for those services. Auth is the
// connector's shared token (the same one used to open the tunnel) — this is
// connector-to-relay traffic, not a browser session.
const policy = require('./policy');
const tunnel = require('./tunnel');
const audit = require('./audit');

function policySnapshot() {
  const registered = tunnel.getRegisteredServices();
  const deptPolicy = policy.getDeptPolicy();
  const grants = policy.getGrants();
  const services = policy.getServices();

  const result = {};
  for (const name of registered) {
    result[name] = {
      label: (services[name] && services[name].label) || name,
      depts: Object.keys(deptPolicy).filter((dept) => (deptPolicy[dept] || []).includes(name)),
      users: Object.keys(grants).filter((email) => (grants[email] || []).includes(name)),
    };
  }
  return result;
}

function recentLogs(limit = 50) {
  const registered = new Set(tunnel.getRegisteredServices());
  return audit
    .getRecent({ limit: 500 })
    .filter((event) => registered.has(event.service))
    .slice(0, limit);
}

module.exports = { policySnapshot, recentLogs };
