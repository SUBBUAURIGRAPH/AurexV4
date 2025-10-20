#!/bin/bash
#
# Build script for Aurigraph Agents Plugin
# Prepares the plugin for deployment
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
echo "  Aurigraph Agents Plugin - Build"
echo "======================================"
echo ""

# Go to plugin directory
cd "$(dirname "$0")/.."
PLUGIN_DIR=$(pwd)

print_info "Plugin directory: $PLUGIN_DIR"
echo ""

# Check Node.js version
print_info "Checking Node.js version..."
NODE_VERSION=$(node --version)
print_success "Node.js version: $NODE_VERSION"
echo ""

# Clean previous builds
if [ -d "dist" ]; then
    print_info "Cleaning previous build..."
    rm -rf dist
    print_success "Cleaned dist/"
fi

# Install dependencies
print_info "Installing dependencies..."
npm install --production=false
print_success "Dependencies installed"
echo ""

# Run linting
print_info "Running linter..."
if npm run lint 2>/dev/null; then
    print_success "Linting passed"
else
    print_warning "Linting failed or not configured"
fi
echo ""

# Run validation
print_info "Validating plugin structure..."
cd ..
if node plugin/scripts/validate-plugin.js > /dev/null 2>&1; then
    print_success "Validation passed"
else
    print_error "Validation failed"
    exit 1
fi
echo ""

# Create distribution directory
print_info "Creating distribution..."
mkdir -p plugin/dist
cd plugin

# Copy necessary files to dist
cp package.json dist/
cp index.js dist/
cp config.json dist/
cp README.md dist/

# Copy scripts
cp -r scripts dist/

print_success "Distribution created in dist/"
echo ""

# Show package info
PACKAGE_NAME=$(node -p "require('./package.json').name")
PACKAGE_VERSION=$(node -p "require('./package.json').version")

echo "======================================"
echo "  Build Complete!"
echo "======================================"
echo ""
echo "Package: $PACKAGE_NAME"
echo "Version: $PACKAGE_VERSION"
echo ""
echo "Next steps:"
echo "  1. Test: npm test"
echo "  2. Install locally: bash scripts/deploy-local.sh"
echo "  3. Publish to NPM: bash scripts/deploy-npm.sh"
echo ""
