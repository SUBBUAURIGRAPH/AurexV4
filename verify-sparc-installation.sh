#!/bin/bash
#
# SPARC Framework Installation Verification
# Run this to verify correct installation
# Version: 2.0.1

FRAMEWORK_DIR=".claude"
ERRORS=0
WARNINGS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; ERRORS=$((ERRORS + 1)); }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; WARNINGS=$((WARNINGS + 1)); }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

echo "======================================"
echo "SPARC Framework Installation Check"
echo "======================================"
echo ""

# Check framework directory
print_info "Checking framework directory..."
if [ ! -d "$FRAMEWORK_DIR" ]; then
    print_error "Framework directory not found: $FRAMEWORK_DIR"
    echo ""
    echo "Please install the framework first:"
    echo "  ./install-sparc-framework.sh clone"
    exit 1
else
    print_success "Framework directory exists: $FRAMEWORK_DIR"
fi

echo ""
print_info "Checking core files..."

# Check core files
REQUIRED_FILES=(
    "SPARC.md"
    "SPARC_QUICK_START.md"
    "SPARC_AGENT_INTEGRATION.md"
    "SPARC_INTEGRATION_SUMMARY.md"
    "CREDENTIALS.md"
    "JIRA_TICKETS_AAE.md"
    "README.md"
    "CHANGELOG.md"
)

for FILE in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$FRAMEWORK_DIR/$FILE" ]; then
        print_error "Missing file: $FILE"
    else
        print_success "Found: $FILE"
    fi
done

echo ""
print_info "Checking directories..."

# Check directories
REQUIRED_DIRS=(
    "agents"
    "sparc-templates"
    "sparc-examples"
    "docs"
    "skills"
)

for DIR in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$FRAMEWORK_DIR/$DIR" ]; then
        print_error "Missing directory: $DIR"
    else
        # Count files in directory
        file_count=$(ls -1 "$FRAMEWORK_DIR/$DIR" 2>/dev/null | wc -l | tr -d ' ')
        print_success "Found directory: $DIR ($file_count files)"
    fi
done

echo ""
print_info "Checking agent files..."

# Check agent files (should be 11)
AGENT_COUNT=$(ls -1 "$FRAMEWORK_DIR/agents/"*.md 2>/dev/null | grep -v README | wc -l | tr -d ' ')
if [ "$AGENT_COUNT" -lt 11 ]; then
    print_error "Expected 11 agents, found $AGENT_COUNT"
else
    print_success "All 11 agents present"

    # List agents
    echo ""
    print_info "Available agents:"
    for agent in "$FRAMEWORK_DIR/agents/"*.md; do
        if [[ ! "$agent" =~ "README" ]]; then
            basename "$agent" .md | sed 's/^/  - /'
        fi
    done
fi

echo ""
print_info "Checking templates..."

# Check templates (should be 5)
TEMPLATE_COUNT=$(ls -1 "$FRAMEWORK_DIR/sparc-templates/"*.md 2>/dev/null | grep -v README | wc -l | tr -d ' ')
if [ "$TEMPLATE_COUNT" -lt 5 ]; then
    print_error "Expected 5 templates, found $TEMPLATE_COUNT"
else
    print_success "All 5 templates present"

    # List templates
    echo ""
    print_info "Available templates:"
    for template in "$FRAMEWORK_DIR/sparc-templates/"*.md; do
        if [[ ! "$template" =~ "README" ]]; then
            basename "$template" .md | sed 's/^/  - /'
        fi
    done
fi

echo ""
print_info "Checking examples..."

# Check examples (should be at least 2)
EXAMPLE_COUNT=$(ls -1 "$FRAMEWORK_DIR/sparc-examples/"*.md 2>/dev/null | grep -v README | wc -l | tr -d ' ')
if [ "$EXAMPLE_COUNT" -lt 2 ]; then
    print_warning "Expected at least 2 examples, found $EXAMPLE_COUNT"
else
    print_success "Found $EXAMPLE_COUNT examples"
fi

echo ""
print_info "Checking framework version..."

# Extract version from README
if [ -f "$FRAMEWORK_DIR/README.md" ]; then
    VERSION=$(grep -m 1 "Version" "$FRAMEWORK_DIR/README.md" | sed 's/.*Version.*: //' | tr -d '*')
    if [ -n "$VERSION" ]; then
        print_success "Framework version: $VERSION"
    else
        print_warning "Could not determine framework version"
    fi
else
    print_warning "README.md not found"
fi

echo ""
print_info "Checking permissions..."

# Check if scripts are executable
SCRIPTS=(
    "install-sparc-framework.sh"
    "verify-sparc-installation.sh"
    "update-sparc-framework.sh"
)

for SCRIPT in "${SCRIPTS[@]}"; do
    if [ -f "$FRAMEWORK_DIR/$SCRIPT" ]; then
        if [ -x "$FRAMEWORK_DIR/$SCRIPT" ]; then
            print_success "Script is executable: $SCRIPT"
        else
            print_warning "Script not executable: $SCRIPT (run: chmod +x $FRAMEWORK_DIR/$SCRIPT)"
        fi
    fi
done

# Summary
echo ""
echo "======================================"
echo "  Verification Summary"
echo "======================================"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    print_success "Installation verified successfully! No issues found."
    echo ""
    echo "🚀 You're ready to use the SPARC Framework!"
    echo ""
    echo "Quick Start:"
    echo "  cat $FRAMEWORK_DIR/SPARC_QUICK_START.md"
    echo ""
    exit_code=0
elif [ $ERRORS -eq 0 ]; then
    print_success "Installation verified with $WARNINGS warning(s)"
    echo ""
    echo "The framework is installed but some minor issues were found."
    echo "You can still use it, but consider fixing the warnings above."
    echo ""
    exit_code=0
else
    print_error "Installation verification failed!"
    echo ""
    echo "Found $ERRORS error(s) and $WARNINGS warning(s)"
    echo ""
    echo "Please reinstall the framework:"
    echo "  ./install-sparc-framework.sh clone"
    echo ""
    exit_code=1
fi

echo "======================================"
echo ""

exit $exit_code
