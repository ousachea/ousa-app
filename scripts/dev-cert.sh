#!/bin/sh
# Makes a self-signed certificate for `npm run dev:lan`, valid for localhost and this Mac's Wi-Fi address.
# Browsers only allow signing in (crypto.subtle) over https or on localhost, so phones on the LAN need this.
# Run it again when the Mac gets a new IP address.
set -e
cd "$(dirname "$0")/.."
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | cut -d' ' -f1)
SAN="DNS:localhost,IP:127.0.0.1${IP:+,IP:$IP}"
mkdir -p .certs
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 825 \
  -subj "/CN=Ousa's Apps dev" \
  -addext "subjectAltName=$SAN" \
  -addext "extendedKeyUsage=serverAuth" \
  -keyout .certs/dev-key.pem -out .certs/dev-cert.pem 2>/dev/null
echo "Certificate for $SAN saved in .certs/"
