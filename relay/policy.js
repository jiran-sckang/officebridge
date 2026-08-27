const { loadJson, saveJson } = require('./store');

let deptPolicy = loadJson('dept-policy.json');   // { dept: [service, ...] }
let grants = loadJson('grants.json');            // { email: [service, ...] }
let services = loadJson('services.json');        // { name: { label } } — the connector owns the internal
                                                  // address and on/off state; this only tracks the display
                                                  // label used for policy screens, independent of whether
                                                  // the connector currently reports the service as live.

function persistDeptPolicy() { saveJson('dept-policy.json', deptPolicy); }
function persistGrants() { saveJson('grants.json', grants); }
function persistServices() { saveJson('services.json', services); }

function getServices() {
  return services;
}

function getService(name) {
  return services[name];
}

// Called when the connector announces a service name the relay hasn't seen
// before — auto-creates a policy-screen entry so an admin can grant access
// to it. Never overwrites or removes an existing entry (policy/label must
// survive the connector briefly disconnecting).
function ensureService(name) {
  if (services[name]) return services[name];
  services[name] = { label: name };
  persistServices();
  return services[name];
}

function setLabel(name, label) {
  if (!services[name]) return null;
  services[name] = { ...services[name], label };
  persistServices();
  return services[name];
}

function effectiveServices(user) {
  const fromDept = new Set(deptPolicy[user.dept] || []);
  const fromGrants = new Set(grants[user.email] || []);
  return new Set([...fromDept, ...fromGrants]);
}

function isAllowed(user, serviceName) {
  return effectiveServices(user).has(serviceName);
}

function getDeptPolicy() {
  return deptPolicy;
}

// Called when the org chart page creates an employee in a department that's
// never been seen before, so it shows up as a manageable row in the policy
// screen immediately (with zero services granted) instead of silently
// having no policy at all until an admin happens to toggle something.
function ensureDept(dept) {
  if (deptPolicy[dept]) return deptPolicy[dept];
  deptPolicy[dept] = [];
  persistDeptPolicy();
  return deptPolicy[dept];
}

function deleteDept(dept) {
  if (!deptPolicy[dept]) return false;
  delete deptPolicy[dept];
  persistDeptPolicy();
  return true;
}

function toggleDeptAccess(dept, serviceName, allow) {
  const set = new Set(deptPolicy[dept] || []);
  if (allow) set.add(serviceName);
  else set.delete(serviceName);
  deptPolicy[dept] = Array.from(set);
  persistDeptPolicy();
  return deptPolicy[dept];
}

function getGrants() {
  return grants;
}

function toggleIndividualGrant(email, serviceName, allow) {
  const set = new Set(grants[email] || []);
  if (allow) set.add(serviceName);
  else set.delete(serviceName);
  grants[email] = Array.from(set);
  persistGrants();
  return grants[email];
}

// Called by admin.js after auth.updateUser() re-keys a user by email —
// grants are keyed by email too but owned by this module, so auth.js can't
// move them itself.
function renameGrants(oldEmail, newEmail) {
  if (!grants[oldEmail]) return;
  grants[newEmail] = grants[oldEmail];
  delete grants[oldEmail];
  persistGrants();
}

module.exports = {
  getServices,
  getService,
  ensureService,
  setLabel,
  effectiveServices,
  isAllowed,
  getDeptPolicy,
  ensureDept,
  deleteDept,
  toggleDeptAccess,
  getGrants,
  toggleIndividualGrant,
  renameGrants,
};
