// Edit these before running, or override with environment variables of the
// same name (env vars always win).
module.exports = {
  // The relay this points at (its public sslip.io/real domain, no scheme).
  RELAY_DOMAIN: process.env.OB_RELAY_DOMAIN || '10-52-249-21.sslip.io',
  RELAY_PORT: process.env.OB_RELAY_PORT || '443',

  // Must match the relay's TENANT_NAME (relay/config.js).
  COMPANY_CODE: process.env.OB_COMPANY_CODE || 'AMD',

  // The connector-registered service name to tunnel to (a "tcp://" mapping
  // on that connector, e.g. tcp://10.52.249.21:22 for SSH).
  SERVICE: process.env.OB_SERVICE || 'dev-ssh',

  // Local TCP port this tool listens on — point your ssh/rdp/db client here.
  LOCAL_PORT: parseInt(process.env.OB_LOCAL_PORT || '2222', 10),

  // The relay in this prototype uses a self-signed certificate, so this
  // must stay false until it's pointed at a relay with a real (CA-signed)
  // certificate.
  REJECT_UNAUTHORIZED: process.env.OB_REJECT_UNAUTHORIZED === 'true',
};
