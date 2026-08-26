#!/bin/bash
# Self-signed TLS cert for the OfficeBridge relay (prototype only).
# SAN covers the sslip.io wildcard for every LAN IP this box may be
# reached at, so "<service>.<ip-dashed>.sslip.io" hostnames all validate.
set -euo pipefail
cd "$(dirname "$0")"

cat > san.cnf <<EOF
[req]
distinguished_name = dn
x509_extensions = v3_req
prompt = no

[dn]
CN = 10-52-249-21.sslip.io

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = *.192-168-10-139.sslip.io
DNS.2 = 192-168-10-139.sslip.io
DNS.3 = *.10-52-249-21.sslip.io
DNS.4 = 10-52-249-21.sslip.io
IP.1 = 192.168.10.139
IP.2 = 127.0.0.1
IP.3 = 10.52.249.21
EOF

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout key.pem -out cert.pem \
  -days 825 \
  -config san.cnf -extensions v3_req

rm -f san.cnf
echo "Generated certs/cert.pem and certs/key.pem"
