// Read-only calls back to the relay, used only by the local admin web UI to
// show which departments/users are allowed into this connector's services
// and what recent access looked like. Authenticated with the same shared
// token used to open the tunnel — there is no browser session here.
const https = require('https');
const config = require('./config');

function fetchJson(pathWithQuery) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: config.RELAY_HOST,
        port: config.RELAY_PORT,
        path: pathWithQuery,
        method: 'GET',
        rejectUnauthorized: config.REJECT_UNAUTHORIZED,
        timeout: 5000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`relay responded ${res.statusCode}`));
          }
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('relay request timed out')));
    req.end();
  });
}

function getPolicy() {
  return fetchJson(`/_ob/api/connector/policy?token=${encodeURIComponent(config.CONNECTOR_TOKEN)}`);
}

function getLogs(limit = 20) {
  return fetchJson(`/_ob/api/connector/logs?token=${encodeURIComponent(config.CONNECTOR_TOKEN)}&limit=${limit}`);
}

module.exports = { getPolicy, getLogs };
