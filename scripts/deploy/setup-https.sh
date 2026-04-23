#!/usr/bin/env bash
set -euo pipefail

# ADM-054: Automated HTTPS setup with Let's Encrypt

DOMAIN="${1:-aurex.in}"
EMAIL="${CERT_EMAIL:-admin@aurigraph.io}"
CERT_PATH="/etc/letsencrypt/live/${DOMAIN}"

echo "=== ADM-054: HTTPS Setup for ${DOMAIN} ==="

# Check if certbot is available
if ! command -v certbot &>/dev/null; then
  echo "Installing certbot..."
  apt-get update && apt-get install -y certbot
fi

# Generate certificates
echo "Generating Let's Encrypt certificates..."
certbot certonly --standalone \
  --email "${EMAIL}" \
  --agree-tos \
  --no-eff-email \
  -d "${DOMAIN}" \
  -d "www.${DOMAIN}" \
  -d "api.${DOMAIN}"

# Verify certificates
echo "Verifying certificates..."
openssl x509 -in "${CERT_PATH}/fullchain.pem" -noout -dates
openssl x509 -in "${CERT_PATH}/fullchain.pem" -noout -subject -issuer

# Setup auto-renewal cron
echo "Setting up auto-renewal..."
CRON_LINE="0 12 * * * /usr/bin/certbot renew --quiet --deploy-hook 'docker restart aurexv4-nginx'"
(crontab -l 2>/dev/null | grep -v certbot; echo "${CRON_LINE}") | crontab -

echo ""
echo "=== HTTPS setup complete ==="
echo "Certificate: ${CERT_PATH}/fullchain.pem"
echo "Key:         ${CERT_PATH}/privkey.pem"
echo "Auto-renewal: Daily at 12:00 UTC"
