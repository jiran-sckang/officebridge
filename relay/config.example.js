// Copy this to config.js on each new deployment and fill in that
// deployment's own values (or set the matching OB_* env vars instead —
// those always win). config.js itself is deployment-specific runtime
// config, not code: it's gitignored so a code deploy (git archive/clone)
// can never overwrite one relay's domain with another's.
module.exports = {
  DOMAIN: process.env.OB_DOMAIN || 'CHANGE-ME.sslip.io',
  PORT: parseInt(process.env.OB_PORT || '443', 10),
  COOKIE_NAME: 'ob_session',
  TENANT_NAME: process.env.OB_TENANT_NAME || 'CHANGE-ME',
};
