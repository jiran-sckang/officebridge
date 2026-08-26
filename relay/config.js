module.exports = {
  DOMAIN: process.env.OB_DOMAIN || '10-52-249-21.sslip.io',
  PORT: parseInt(process.env.OB_PORT || '443', 10),
  COOKIE_NAME: 'ob_session',
  TENANT_NAME: 'AMD',
};
