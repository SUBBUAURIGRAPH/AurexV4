#!/bin/bash
#
# SPARC Framework Organization-Wide Installation Script
# Aurigraph DLT Corp - Version 2.0.1
#
# Usage: ./install-sparc-framework.sh [method]
# Methods: submodule, clone, copy
#
# Or use with curl:
# curl -sSL https://raw.githubusercontent.com/Aurigraph-DLT-Corp/glowing-adventure/main/install-sparc-framework.sh | bash

set -e

FRAMEWORK_REPO="https://github.com/Aurigraph-DLT-Corp/glowing-adventure.git"
FRAMEWORK_DIR=".claude"
INSTALL_METHOD="${1:-clone}"
SCRIPT_VERSION="2.0.1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo ""
    echo "======================================"
    echo "  SPARC Framework Installation"
    echo "======================================"
    echo ""
    echo "Organization: Aurigraph DLT Corp"
    echo "Version: $SCRIPT_VERSION"
    echo "Method: $INSTALL_METHOD"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

check_prerequisites() {
    # Check for required commands
    if ! command -v git &> /dev/null; then
        print_error "Git is not installed. Please install Git first."
        exit 1
    fi

    if [ "$INSTALL_METHOD" == "copy" ]; then
        if ! command -v curl &> /dev/null; then
            print_error "curl is not installed. Please install curl first."
            exit 1
        fi
        if ! command -v unzip &> /dev/null; then
            print_error "unzip is not installed. Please install unzip first."
            exit 1
        fi
    fi
}

check_existing_installation() {
    if [ -d "$FRAMEWORK_DIR" ]; then
        print_warning "$FRAMEWORK_DIR directory already exists"
        echo ""
        read -p "Do you want to overwrite it? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Installation cancelled by user"
            exit 1
        fi
        print_info "Backing up existing installation..."
        mv "$FRAMEWORK_DIR" "${FRAMEWORK_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
        print_success "Backup created"
    fi
}

install_submodule() {
    print_info "Installing as Git submodule..."

    # Check if we're in a Git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not a Git repository. Please run 'git init' first or use 'clone' method."
        exit 1
    fi

    git submodule add "$FRAMEWORK_REPO" "$FRAMEWORK_DIR"
    git submodule update --init --recursive

    print_success "Submodule added successfully"
    echo ""
    print_info "Next steps:"
    echo "  1. git add .gitmodules .claude"
    echo "  2. git commit -m 'Add SPARC framework'"
    echo "  3. git push"
}

install_clone() {
    print_info "Cloning framework repository..."

    git clone "$FRAMEWORK_REPO" "$FRAMEWORK_DIR"

    # Remove .git to prevent accidental commits to framework repo
    rm -rf "$FRAMEWORK_DIR/.git"

    print_success "Repository cloned successfully"
    echo ""
    print_info "Recommendation: Add to .gitignore"
    echo "  echo '$FRAMEWORK_DIR/' >> .gitignore"
}

install_copy() {
    print_info "Downloading and extracting framework..."

    # Download
    curl -L "${FRAMEWORK_REPO}/archive/refs/heads/main.zip" -o /tmp/sparc-framework.zip

    # Extract
    unzip -q /tmp/sparc-framework.zip -d /tmp/

    # Copy files
    mkdir -p "$FRAMEWORK_DIR"
    cp -r /tmp/glowing-adventure-main/* "$FRAMEWORK_DIR/"

    # Cleanup
    rm -rf /tmp/sparc-framework.zip /tmp/glowing-adventure-main

    print_success "Framework copied successfully"
}

verify_installation() {
    print_info "Verifying installation..."

    local errors=0

    # Check core files
    local required_files=("SPARC.md" "SPARC_QUICK_START.md" "README.md")
    for file in "${required_files[@]}"; do
        if [ ! -f "$FRAMEWORK_DIR/$file" ]; then
            print_error "Missing file: $file"
            errors=$((errors + 1))
        fi
    done

    # Check directories
    local required_dirs=("agents" "sparc-templates" "sparc-examples")
    for dir in "${required_dirs[@]}"; do
        if [ ! -d "$FRAMEWORK_DIR/$dir" ]; then
            print_error "Missing directory: $dir"
            errors=$((errors + 1))
        fi
    done

    if [ $errors -eq 0 ]; then
        print_success "Installation verified successfully!"
        return 0
    else
        print_error "Installation verification failed with $errors errors"
        return 1
    fi
}

show_next_steps() {
    echo ""
    echo "======================================"
    echo "  Installation Complete! 🎉"
    echo "======================================"
    echo ""
    echo "📚 Documentation:"
    echo "   - Quick Start (5 min): $FRAMEWORK_DIR/SPARC_QUICK_START.md"
    echo "   - Full Framework: $FRAMEWORK_DIR/SPARC.md"
    echo "   - Agent Integration: $FRAMEWORK_DIR/SPARC_AGENT_INTEGRATION.md"
    echo "   - Examples: $FRAMEWORK_DIR/sparc-examples/"
    echo "   - Templates: $FRAMEWORK_DIR/sparc-templates/"
    echo ""
    echo "🚀 Next Steps:"
    echo "   1. Read quick start:"
    echo "      cat $FRAMEWORK_DIR/SPARC_QUICK_START.md"
    echo ""
    echo "   2. Review your agent:"
    echo "      ls $FRAMEWORK_DIR/agents/"
    echo "      cat $FRAMEWORK_DIR/agents/[your-agent].md"
    echo ""
    echo "   3. Try a template:"
    echo "      cp $FRAMEWORK_DIR/sparc-templates/skill-development.md ."
    echo ""
    echo "💬 Support:"
    echo "   - Slack: #claude-agents"
    echo "   - Email: agents@aurigraph.io"
    echo "   - Office Hours: Mon/Wed 10-12, Tue/Thu 2-4"
    echo ""
    echo "📊 Verify installation:"
    echo "   bash $FRAMEWORK_DIR/verify-sparc-installation.sh"
    echo ""
}

# Main installation flow
main() {
    print_header

    check_prerequisites
    check_existing_installation

    case "$INSTALL_METHOD" in
        "submodule")
            install_submodule
            ;;
        "clone")
            install_clone
            ;;
        "copy")
            install_copy
            ;;
        *)
            print_error "Unknown installation method: $INSTALL_METHOD"
            echo ""
            echo "Valid methods:"
            echo "  - submodule: Install as Git submodule (for active development)"
            echo "  - clone: Clone repository (recommended for most users)"
            echo "  - copy: Download and copy files (no Git required)"
            echo ""
            echo "Usage: $0 [submodule|clone|copy]"
            exit 1
            ;;
    esac

    if verify_installation; then
        show_next_steps
        exit 0
    else
        print_error "Installation failed. Please check the errors above and try again."
        exit 1
    fi
}

# Run main function
main
