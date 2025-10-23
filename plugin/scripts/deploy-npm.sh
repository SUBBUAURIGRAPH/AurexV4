#!/bin/bash
#
# NPM deployment script for Aurigraph Agents Plugin
# Publishes the plugin to NPM registry
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
echo "  NPM Publishing"
echo "======================================"
echo ""

# Go to plugin directory
cd "$(dirname "$0")/.."

# Get package info
PACKAGE_NAME=$(node -p "require('./package.json').name")
PACKAGE_VERSION=$(node -p "require('./package.json').version")

print_info "Package: $PACKAGE_NAME"
print_info "Version: $PACKAGE_VERSION"
echo ""

# Check if logged in to NPM
if ! npm whoami > /dev/null 2>&1; then
    print_error "Not logged in to NPM"
    echo ""
    print_info "Please run: npm login"
    exit 1
fi

NPM_USER=$(npm whoami)
print_success "Logged in as: $NPM_USER"
echo ""

# Check if version already exists
if npm view "$PACKAGE_NAME@$PACKAGE_VERSION" version > /dev/null 2>&1; then
    print_error "Version $PACKAGE_VERSION already published"
    echo ""
    print_info "Please update version in package.json:"
    echo "  npm version patch  # 1.0.0 -> 1.0.1"
    echo "  npm version minor  # 1.0.0 -> 1.1.0"
    echo "  npm version major  # 1.0.0 -> 2.0.0"
    exit 1
fi

# Build the plugin
print_info "Building plugin..."
bash scripts/build.sh
echo ""

# Run tests if available
if npm run test > /dev/null 2>&1; then
    print_info "Running tests..."
    npm test
    print_success "Tests passed"
    echo ""
fi

# Confirm publication
print_warning "About to publish $PACKAGE_NAME@$PACKAGE_VERSION to NPM"
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Publication cancelled"
    exit 0
fi

# Publish to NPM
print_info "Publishing to NPM..."
npm publish --access public

print_success "Published successfully!"
echo ""

# Show package URL
echo "======================================"
echo "  Publication Complete!"
echo "======================================"
echo ""
echo "Package: $PACKAGE_NAME@$PACKAGE_VERSION"
echo "NPM URL: https://www.npmjs.com/package/$PACKAGE_NAME"
echo ""
echo "Install command:"
echo "  npm install -g $PACKAGE_NAME"
echo ""
echo "Next steps:"
echo "  1. Share with team (see scripts/share-plugin.md)"
echo "  2. Update documentation"
echo "  3. Announce in Slack (#claude-agents)"
echo ""
