#!/bin/bash

###############################################################################
# NGINX CSP Fix Script
# Purpose: Fix Content Security Policy header for font loading on dlt.aurigraph.io
# Usage: ./fix-nginx-csp.sh [domain] [config-path]
# Example: ./fix-nginx-csp.sh dlt.aurigraph.io /etc/nginx/sites-available/dlt.aurigraph.io
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="${1:-dlt.aurigraph.io}"
CONFIG_PATH="${2:-/etc/nginx/sites-available/$DOMAIN}"
BACKUP_DIR="/var/backups/nginx"
TIMESTAMP=$(date +%s)

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          NGINX CSP Configuration Fix Script               ║${NC}"
echo -e "${BLUE}║                    v1.0.0                                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"

echo -e "\n${YELLOW}Configuration:${NC}"
echo "  Domain: $DOMAIN"
echo "  Config Path: $CONFIG_PATH"
echo "  Backup Directory: $BACKUP_DIR"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}✗ Error: This script must be run as root (use sudo)${NC}"
   exit 1
fi

echo -e "\n${YELLOW}Step 1: Checking prerequisites...${NC}"

# Check if NGINX is installed
if ! command -v nginx &> /dev/null; then
    echo -e "${RED}✗ Error: NGINX is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ NGINX is installed${NC}"

# Check if config file exists
if [ ! -f "$CONFIG_PATH" ]; then
    echo -e "${RED}✗ Error: Config file not found at $CONFIG_PATH${NC}"
    echo "  Searching for NGINX config files..."
    echo "  Available configs:"
    ls -la /etc/nginx/sites-available/ 2>/dev/null || echo "  No sites-available found"
    exit 1
fi
echo -e "${GREEN}✓ Config file found${NC}"

# Check NGINX syntax
echo -e "\n${YELLOW}Step 2: Testing NGINX configuration...${NC}"
if ! nginx -t 2>/dev/null; then
    echo -e "${RED}✗ Error: Current NGINX configuration is invalid${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Current NGINX configuration is valid${NC}"

# Create backup directory
echo -e "\n${YELLOW}Step 3: Creating backups...${NC}"
mkdir -p "$BACKUP_DIR"
cp "$CONFIG_PATH" "$BACKUP_DIR/${DOMAIN}.conf.backup.${TIMESTAMP}"
echo -e "${GREEN}✓ Backup created: $BACKUP_DIR/${DOMAIN}.conf.backup.${TIMESTAMP}${NC}"

# Check if CSP header already exists
echo -e "\n${YELLOW}Step 4: Checking current CSP configuration...${NC}"
if grep -q "Content-Security-Policy" "$CONFIG_PATH"; then
    echo -e "${YELLOW}⚠ Warning: CSP header already exists in config${NC}"
    echo "  Current CSP:"
    grep "Content-Security-Policy" "$CONFIG_PATH" | sed 's/^/    /'

    read -p "  Do you want to replace it? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Aborted by user${NC}"
        exit 0
    fi

    # Remove old CSP header
    sed -i '/Content-Security-Policy/d' "$CONFIG_PATH"
    echo -e "${GREEN}✓ Old CSP header removed${NC}"
else
    echo -e "${GREEN}✓ No existing CSP header found${NC}"
fi

# Add new CSP header
echo -e "\n${YELLOW}Step 5: Adding CSP header...${NC}"

# Find the right place to insert (before closing server block or at end of server block)
# Look for the last add_header or listen directive in the server block
CSP_HEADER='    add_header Content-Security-Policy "default-src '\''self'\''; font-src '\''self'\'' data:; script-src '\''self'\'' '\''unsafe-inline'\'' '\''unsafe-eval'\''; style-src '\''self'\'' '\''unsafe-inline'\''; img-src '\''self'\'' data:; connect-src '\''self'\'';" always;'

if grep -q "add_header" "$CONFIG_PATH"; then
    # Insert after the last add_header
    sed -i "/add_header.*always;/a\\$CSP_HEADER" "$CONFIG_PATH"
else
    # Insert before the closing brace, after listen directives
    sed -i "/listen/a\\$CSP_HEADER" "$CONFIG_PATH"
fi

echo -e "${GREEN}✓ CSP header added${NC}"

# Test updated configuration
echo -e "\n${YELLOW}Step 6: Testing updated configuration...${NC}"
if ! nginx -t 2>/dev/null; then
    echo -e "${RED}✗ Error: NGINX configuration is invalid after changes${NC}"
    echo "  Restoring backup..."
    cp "$BACKUP_DIR/${DOMAIN}.conf.backup.${TIMESTAMP}" "$CONFIG_PATH"
    echo -e "${GREEN}✓ Backup restored${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Updated NGINX configuration is valid${NC}"

# Reload NGINX
echo -e "\n${YELLOW}Step 7: Reloading NGINX...${NC}"
if systemctl reload nginx 2>/dev/null; then
    echo -e "${GREEN}✓ NGINX reloaded successfully${NC}"
else
    echo -e "${YELLOW}⚠ Warning: Could not reload NGINX via systemctl${NC}"
    if nginx -s reload 2>/dev/null; then
        echo -e "${GREEN}✓ NGINX reloaded with nginx -s reload${NC}"
    else
        echo -e "${RED}✗ Error: Could not reload NGINX${NC}"
        exit 1
    fi
fi

# Verify changes
echo -e "\n${YELLOW}Step 8: Verifying changes...${NC}"
echo "  Current CSP header in config:"
grep "Content-Security-Policy" "$CONFIG_PATH" | sed 's/^/    /'

# Test with curl (if available)
echo -e "\n${YELLOW}Step 9: Testing headers with curl...${NC}"
if command -v curl &> /dev/null; then
    echo "  Fetching headers from https://$DOMAIN/..."
    if curl -I "https://$DOMAIN/" 2>/dev/null | grep -i "content-security-policy" > /dev/null; then
        echo -e "${GREEN}✓ CSP header is being sent${NC}"
        curl -I "https://$DOMAIN/" 2>/dev/null | grep -i "content-security-policy" | sed 's/^/    /'
    else
        echo -e "${YELLOW}⚠ Warning: CSP header not detected (might be HTTP, not HTTPS)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ curl not available for header testing${NC}"
fi

# Final summary
echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Fix Complete! ✓                         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"

echo -e "\n${GREEN}Summary:${NC}"
echo "  ✓ Backup created: $BACKUP_DIR/${DOMAIN}.conf.backup.${TIMESTAMP}"
echo "  ✓ CSP header updated"
echo "  ✓ Configuration tested"
echo "  ✓ NGINX reloaded"

echo -e "\n${YELLOW}Next steps:${NC}"
echo "  1. Clear browser cache (Ctrl+Shift+Delete)"
echo "  2. Hard reload your page (Ctrl+Shift+R or Cmd+Shift+R)"
echo "  3. Check browser console (F12) for CSP errors"
echo "  4. Verify fonts load correctly"

echo -e "\n${YELLOW}To revert changes:${NC}"
echo "  sudo cp $BACKUP_DIR/${DOMAIN}.conf.backup.${TIMESTAMP} $CONFIG_PATH"
echo "  sudo systemctl reload nginx"

echo -e "\n${YELLOW}View logs:${NC}"
echo "  sudo tail -f /var/log/nginx/error.log"

echo ""
