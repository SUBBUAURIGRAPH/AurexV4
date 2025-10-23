#!/bin/bash
#
# Local deployment script for Aurigraph Agents Plugin
# Installs the plugin locally for testing
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

echo ""
echo "======================================"
echo "  Local Plugin Installation"
echo "======================================"
echo ""

# Go to plugin directory
cd "$(dirname "$0")/.."
PLUGIN_DIR=$(pwd)

# Build first
print_info "Building plugin..."
bash scripts/build.sh
echo ""

# Install globally using npm link
print_info "Installing plugin globally (npm link)..."
npm link

print_success "Plugin installed locally!"
echo ""

# Test the installation
print_info "Testing installation..."
PACKAGE_NAME=$(node -p "require('./package.json').name")

if npm list -g "$PACKAGE_NAME" > /dev/null 2>&1; then
    print_success "Plugin is accessible globally"
else
    print_warning "Plugin may not be accessible globally"
fi

echo ""
echo "======================================"
echo "  Installation Complete!"
echo "======================================"
echo ""
echo "Usage:"
echo "  node plugin/index.js list"
echo "  node plugin/index.js skills"
echo "  node plugin/index.js invoke <agent> <skill>"
echo ""
echo "Examples:"
echo "  node plugin/index.js invoke devops deploy-wizard 'Deploy to dev4'"
echo "  node plugin/index.js invoke qa test-runner 'Run tests'"
echo ""
echo "To uninstall:"
echo "  npm unlink -g $PACKAGE_NAME"
echo ""
