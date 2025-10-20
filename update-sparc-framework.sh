#!/bin/bash
#
# SPARC Framework Update Script
# Keeps framework synchronized with latest version
# Version: 2.0.1

FRAMEWORK_DIR=".claude"

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

echo "======================================"
echo "  SPARC Framework Update"
echo "======================================"
echo ""

# Check if framework is installed
if [ ! -d "$FRAMEWORK_DIR" ]; then
    print_error "Framework not found in $FRAMEWORK_DIR"
    echo ""
    echo "Please install the framework first:"
    echo "  ./install-sparc-framework.sh clone"
    exit 1
fi

cd "$FRAMEWORK_DIR" || exit 1

# Check current version
if [ -f "README.md" ]; then
    CURRENT_VERSION=$(grep -m 1 "Version" "README.md" | sed 's/.*Version.*: //' | tr -d '*' | tr -d ' ')
    print_info "Current version: $CURRENT_VERSION"
fi

echo ""

# Check if it's a Git repository
if [ -d ".git" ]; then
    print_info "Git-based installation detected"
    print_info "Fetching latest changes..."

    # Stash any local changes
    if ! git diff-index --quiet HEAD --; then
        print_warning "Local changes detected, stashing..."
        git stash save "Auto-stash before SPARC update $(date +%Y-%m-%d_%H:%M:%S)"
    fi

    # Fetch and pull
    git fetch origin
    git pull origin main

    if [ $? -eq 0 ]; then
        print_success "Framework updated successfully via Git!"

        # Show what changed
        echo ""
        print_info "Recent changes:"
        git log -5 --oneline --decorate --color=always
    else
        print_error "Update failed. Please resolve conflicts manually."
        echo ""
        echo "To resolve:"
        echo "  cd $FRAMEWORK_DIR"
        echo "  git status"
        echo "  # Fix conflicts"
        echo "  git add ."
        echo "  git rebase --continue"
        exit 1
    fi
else
    print_info "Non-Git installation detected"
    print_warning "This will download and replace the framework"
    echo ""
    read -p "Continue? (y/N): " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Update cancelled"
        exit 0
    fi

    # Backup current installation
    print_info "Creating backup..."
    cd ..
    BACKUP_DIR="${FRAMEWORK_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
    cp -r "$FRAMEWORK_DIR" "$BACKUP_DIR"
    print_success "Backup created: $BACKUP_DIR"

    # Download latest
    print_info "Downloading latest version..."
    curl -L https://github.com/Aurigraph-DLT-Corp/glowing-adventure/archive/refs/heads/main.zip -o /tmp/sparc-update.zip

    if [ $? -ne 0 ]; then
        print_error "Download failed"
        exit 1
    fi

    # Extract
    print_info "Extracting..."
    unzip -q /tmp/sparc-update.zip -d /tmp/

    # Replace files (preserve local customizations if any)
    print_info "Updating files..."
    rsync -av --exclude='.git' /tmp/glowing-adventure-main/* "$FRAMEWORK_DIR/"

    # Cleanup
    rm -rf /tmp/sparc-update.zip /tmp/glowing-adventure-main

    print_success "Framework updated successfully!"
    echo ""
    print_info "Previous version backed up to: $BACKUP_DIR"

    cd "$FRAMEWORK_DIR"
fi

# Verify update
echo ""
print_info "Verifying update..."

if [ -f "SPARC.md" ] && [ -f "README.md" ]; then
    NEW_VERSION=$(grep -m 1 "Version" "README.md" | sed 's/.*Version.*: //' | tr -d '*' | tr -d ' ')
    print_success "Update verified successfully!"
    echo ""
    print_info "New version: $NEW_VERSION"

    # Compare versions
    if [ "$CURRENT_VERSION" != "$NEW_VERSION" ]; then
        print_success "Upgraded from $CURRENT_VERSION to $NEW_VERSION"
        echo ""
        print_info "Review changes:"
        echo "  cat $FRAMEWORK_DIR/CHANGELOG.md"
    else
        print_info "Already at latest version: $NEW_VERSION"
    fi
else
    print_error "Update verification failed"
    exit 1
fi

cd ..

# Show next steps
echo ""
echo "======================================"
echo "  Update Complete!"
echo "======================================"
echo ""
echo "📋 Review what changed:"
echo "   cat $FRAMEWORK_DIR/CHANGELOG.md"
echo ""
echo "🔍 Verify installation:"
echo "   bash $FRAMEWORK_DIR/verify-sparc-installation.sh"
echo ""
echo "📚 Check for documentation updates:"
echo "   cat $FRAMEWORK_DIR/SPARC.md"
echo ""
echo "💬 Questions?"
echo "   - Slack: #claude-agents"
echo "   - Email: agents@aurigraph.io"
echo ""
