// Edit these before running, or override with environment variables of the
// same name (env vars always win).
module.exports = {
  // Address of the OfficeBridge relay. Defaults to this workshop's relay box.
  // Change this if you point the connector at a different relay.
  RELAY_HOST: process.env.RELAY_HOST || '10.52.249.21',
  RELAY_PORT: process.env.RELAY_PORT || '443',

  // The public hostname suffix browsers use to reach the relay (i.e. what
  // users see as <service>.PUBLIC_DOMAIN). Needed so this connector can
  // rewrite absolute Location redirects an upstream app sends to its OWN
  // real hostname back onto the relay's domain — otherwise a redirect from
  // a real internal app (e.g. to its own login page) would send the
  // browser's next request straight to the real host, skipping the relay
  // entirely.
  PUBLIC_DOMAIN: process.env.PUBLIC_DOMAIN || '10-52-249-21.sslip.io',

  // Must match data/tokens.json's "connectorToken" on the relay you're
  // connecting to. This default matches the relay running in this sandbox.
  CONNECTOR_TOKEN: process.env.CONNECTOR_TOKEN || 'f8ab579c20f5cd1cab85030e28d25551c35aff0e8922ce4b',

  // The relay in this prototype uses a self-signed certificate, so the
  // connector must not verify it. Flip to true only once you point this at
  // a relay with a real (CA-signed) certificate.
  REJECT_UNAUTHORIZED: process.env.REJECT_UNAUTHORIZED === 'true',

  // Local admin web UI — lets whoever runs this connector manage the
  // domain->internal-address mappings and enable/disable them, without
  // hand-editing services.json. Change ADMIN_PASSWORD before exposing this
  // beyond localhost.
  ADMIN_HOST: process.env.ADMIN_HOST || '0.0.0.0',
  ADMIN_PORT: process.env.ADMIN_PORT || '8090',
  ADMIN_USER: process.env.ADMIN_USER || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'changeme',
};
