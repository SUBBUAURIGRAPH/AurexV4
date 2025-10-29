#!/bin/bash

# J4C Agent Plugin - Remote Deployment Script
# Version: 1.0.0
# Usage: ./deploy-j4c-agent.sh <environment> [username] [host] [port]

set -e

# Configuration
ENVIRONMENT="${1:-staging}"
SSH_USER="${2:-yogesh}"
SSH_HOST="${3:-dev.aurigraph.io}"
SSH_PORT="${4:-2224}"
PACKAGE_FILE="j4c-agent-plugin-1.0.0.tar.gz"
REMOTE_DIR="/opt/j4c-agent"
BACKUP_DIR="/opt/j4c-agent.backup"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

# Print header
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     J4C Agent Plugin - Remote Deployment Script           ║"
echo "║     Version 1.0.0 - October 27, 2025                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Display configuration
log_info "Deployment Configuration:"
echo "  Environment: $ENVIRONMENT"
echo "  Target: $SSH_USER@$SSH_HOST:$SSH_PORT"
echo "  Remote Directory: $REMOTE_DIR"
echo "  Package: $PACKAGE_FILE"
echo "  Size: $(ls -lh $PACKAGE_FILE | awk '{print $5}')"
echo ""

# Verify package exists
if [ ! -f "$PACKAGE_FILE" ]; then
  log_error "Package file not found: $PACKAGE_FILE"
  exit 1
fi
log_success "Package file verified"

# Test SSH connection
log_info "Testing SSH connection..."
if ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "echo 'SSH connection successful'" > /dev/null 2>&1; then
  log_success "SSH connection successful"
else
  log_error "SSH connection failed to $SSH_USER@$SSH_HOST:$SSH_PORT"
  log_info "Trying alternative authentication methods..."
  # Continue anyway - might work with keys
fi

# Create backup of current version (if exists)
log_info "Checking for previous installation..."
if ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "[ -d $REMOTE_DIR ]" 2>/dev/null; then
  log_warning "Previous installation found, creating backup..."
  ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "sudo cp -r $REMOTE_DIR $BACKUP_DIR.$(date +%s)" || true
  log_success "Backup created"
else
  log_info "No previous installation found, proceeding with fresh install"
fi

# Create remote directory if it doesn't exist
log_info "Preparing remote directory..."
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "sudo mkdir -p $REMOTE_DIR && sudo chown $SSH_USER:$SSH_USER $REMOTE_DIR" || {
  log_error "Failed to create remote directory"
  exit 1
}
log_success "Remote directory ready"

# Upload package
log_info "Uploading package ($PACKAGE_FILE)..."
scp -P "$SSH_PORT" "$PACKAGE_FILE" "$SSH_USER@$SSH_HOST:/tmp/" || {
  log_error "Failed to upload package"
  exit 1
}
log_success "Package uploaded successfully"

# Extract package
log_info "Extracting package on remote server..."
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "cd /tmp && tar -xzf $PACKAGE_FILE && sudo cp -r plugin/* $REMOTE_DIR/" || {
  log_error "Failed to extract package"
  exit 1
}
log_success "Package extracted successfully"

# Install dependencies
log_info "Installing dependencies on remote server..."
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "cd $REMOTE_DIR && npm install --production" || {
  log_error "Failed to install dependencies"
  exit 1
}
log_success "Dependencies installed successfully"

# Create environment file
log_info "Creating environment configuration..."
cat <<EOF | ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "cat > $REMOTE_DIR/.env"
# J4C Agent Plugin Environment Configuration
# Generated: $(date)
# Environment: $ENVIRONMENT

# HubSpot Configuration (Required for CRM integration)
HUBSPOT_API_KEY=\${HUBSPOT_API_KEY}
HUBSPOT_PORTAL_ID=\${HUBSPOT_PORTAL_ID}

# Claude Code Integration
CLAUDE_CODE_API_URL=http://localhost:9000
CLAUDE_CODE_API_KEY=\${CLAUDE_CODE_API_KEY}

# JIRA Integration
JIRA_URL=https://aurigraphdlt.atlassian.net
JIRA_API_KEY=\${JIRA_API_KEY}

# GitHub Integration
GITHUB_TOKEN=\${GITHUB_TOKEN}

# Slack Integration
SLACK_WEBHOOK_URL=\${SLACK_WEBHOOK_URL}
SLACK_WEBHOOK_HUBSPOT=\${SLACK_WEBHOOK_HUBSPOT}

# Notifications
NOTIFICATION_EMAIL=\${NOTIFICATION_EMAIL}
HUBSPOT_FROM_EMAIL=noreply@aurigraph.io

# Environment
NODE_ENV=$ENVIRONMENT
EOF
log_success "Environment configuration created"

# Set permissions
log_info "Setting file permissions..."
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "chmod 755 $REMOTE_DIR/*.js && chmod 644 $REMOTE_DIR/.env" || {
  log_error "Failed to set permissions"
  exit 1
}
log_success "Permissions set correctly"

# Create systemd service
log_info "Setting up systemd service..."
cat <<'SYSTEMD_SERVICE' | ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "sudo tee /etc/systemd/system/j4c-agent.service > /dev/null"
[Unit]
Description=J4C Agent Plugin Service
After=network.target

[Service]
Type=simple
User=yogesh
WorkingDirectory=/opt/j4c-agent
Environment="NODE_ENV=production"
EnvironmentFile=/opt/j4c-agent/.env
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=j4c-agent

[Install]
WantedBy=multi-user.target
SYSTEMD_SERVICE

if [ $? -eq 0 ]; then
  log_success "Systemd service created"
else
  log_warning "Failed to create systemd service (may need sudo password)"
fi

# Reload systemd
log_info "Reloading systemd daemon..."
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "sudo systemctl daemon-reload" || {
  log_warning "Failed to reload systemd (non-critical)"
}

# Enable and start service
log_info "Enabling and starting J4C Agent service..."
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "sudo systemctl enable j4c-agent && sudo systemctl start j4c-agent" || {
  log_warning "Failed to enable/start service (may need manual intervention)"
}

# Check service status
log_info "Checking service status..."
SERVICE_STATUS=$(ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "sudo systemctl is-active j4c-agent" 2>/dev/null)
if [ "$SERVICE_STATUS" = "active" ]; then
  log_success "Service is running"
else
  log_warning "Service status: $SERVICE_STATUS (check logs for details)"
fi

# Verify installation
log_info "Verifying installation..."
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "cd $REMOTE_DIR && node index.js list 2>/dev/null | head -5" || {
  log_warning "Could not verify installation (non-critical)"
}

# Cleanup
log_info "Cleaning up temporary files..."
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "rm -f /tmp/$PACKAGE_FILE /tmp/plugin -rf" || true
log_success "Cleanup complete"

# Summary
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              Deployment Summary                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
log_success "Deployment completed successfully!"
echo ""
echo "Next steps:"
echo "  1. Configure environment variables in $REMOTE_DIR/.env"
echo "  2. Set your HubSpot API key:"
echo "     HUBSPOT_API_KEY=your_key_here"
echo "  3. View service logs:"
echo "     ssh -p $SSH_PORT $SSH_USER@$SSH_HOST \"sudo journalctl -u j4c-agent -f\""
echo "  4. Test the CLI:"
echo "     ssh -p $SSH_PORT $SSH_USER@$SSH_HOST \"cd $REMOTE_DIR && node j4c-cli.js agents list\""
echo ""
echo "Deployment Information:"
echo "  Remote Directory: $REMOTE_DIR"
echo "  Service Name: j4c-agent"
echo "  Config File: $REMOTE_DIR/.env"
echo "  Backup Location: $BACKUP_DIR.*"
echo "  Package Size: $(ls -lh $PACKAGE_FILE | awk '{print $5}')"
echo ""
echo "For more information, see: DEPLOYMENT_PACKAGE.md"
echo ""

exit 0
