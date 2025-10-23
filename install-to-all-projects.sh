#!/bin/bash
#
# Install Aurigraph Agents Plugin to All Projects
# Automatically adds the plugin as a git submodule to all Git repositories
#
# Version: 1.0.0
# Author: Aurigraph Development Team
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_header() { echo -e "${CYAN}$1${NC}"; }

# Configuration
PLUGIN_REPO="git@github.com:Aurigraph-DLT-Corp/glowing-adventure.git"
PLUGIN_DIR=".claude"
INSTALL_METHOD="${1:-submodule}"  # submodule, clone, or copy

# Search paths for projects
SEARCH_PATHS=(
    "$HOME/subbuworkingdir"
    "$HOME/Documents/GitHub"
    "$HOME/Projects"
    "$HOME/workspace"
)

# Statistics
TOTAL_PROJECTS=0
INSTALLED=0
ALREADY_EXISTS=0
SKIPPED=0
ERRORS=0

# Arrays to track projects
declare -a INSTALLED_PROJECTS
declare -a EXISTING_PROJECTS
declare -a SKIPPED_PROJECTS
declare -a ERROR_PROJECTS

echo ""
echo "=================================================================="
print_header "  Aurigraph Agents Plugin - Mass Installation"
echo "=================================================================="
echo ""
print_info "Installation Method: $INSTALL_METHOD"
print_info "Plugin Repository: $PLUGIN_REPO"
print_info "Target Directory: $PLUGIN_DIR"
echo ""

# Function to find all Git repositories
find_git_repos() {
    local search_path="$1"
    find "$search_path" -maxdepth 4 -name ".git" -type d 2>/dev/null | sed 's|/.git||'
}

# Function to check if plugin already exists
plugin_exists() {
    local project_dir="$1"
    [ -d "$project_dir/$PLUGIN_DIR" ]
}

# Function to install plugin as submodule
install_submodule() {
    local project_dir="$1"
    cd "$project_dir"

    # Check if it's a valid Git repo
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        return 1
    fi

    # Add as submodule
    git submodule add "$PLUGIN_REPO" "$PLUGIN_DIR" 2>/dev/null || return 1
    git submodule update --init --recursive 2>/dev/null || return 1

    return 0
}

# Function to install plugin by cloning
install_clone() {
    local project_dir="$1"
    cd "$project_dir"

    git clone "$PLUGIN_REPO" "$PLUGIN_DIR" 2>/dev/null || return 1
    rm -rf "$PLUGIN_DIR/.git"  # Remove .git to avoid nested repos

    return 0
}

# Function to install plugin by copying
install_copy() {
    local project_dir="$1"
    local source_dir="$(cd "$(dirname "$0")" && pwd)"

    cp -r "$source_dir" "$project_dir/$PLUGIN_DIR" 2>/dev/null || return 1
    rm -rf "$project_dir/$PLUGIN_DIR/.git"  # Remove .git

    return 0
}

# Function to install plugin to a project
install_to_project() {
    local project_dir="$1"
    local project_name=$(basename "$project_dir")

    TOTAL_PROJECTS=$((TOTAL_PROJECTS + 1))

    # Skip if it's the glowing-adventure repo itself
    if [[ "$project_dir" == *"glowing-adventure"* ]]; then
        print_warning "Skipping: $project_name (source repository)"
        SKIPPED=$((SKIPPED + 1))
        SKIPPED_PROJECTS+=("$project_dir (source repo)")
        return
    fi

    # Check if plugin already exists
    if plugin_exists "$project_dir"; then
        print_info "Exists: $project_name"
        ALREADY_EXISTS=$((ALREADY_EXISTS + 1))
        EXISTING_PROJECTS+=("$project_dir")
        return
    fi

    # Attempt installation
    print_info "Installing to: $project_name"

    case "$INSTALL_METHOD" in
        "submodule")
            if install_submodule "$project_dir"; then
                print_success "Installed: $project_name"
                INSTALLED=$((INSTALLED + 1))
                INSTALLED_PROJECTS+=("$project_dir")
            else
                print_error "Failed: $project_name (trying clone method...)"
                if install_clone "$project_dir"; then
                    print_success "Installed (clone): $project_name"
                    INSTALLED=$((INSTALLED + 1))
                    INSTALLED_PROJECTS+=("$project_dir")
                else
                    print_error "Failed: $project_name"
                    ERRORS=$((ERRORS + 1))
                    ERROR_PROJECTS+=("$project_dir")
                fi
            fi
            ;;
        "clone")
            if install_clone "$project_dir"; then
                print_success "Installed: $project_name"
                INSTALLED=$((INSTALLED + 1))
                INSTALLED_PROJECTS+=("$project_dir")
            else
                print_error "Failed: $project_name"
                ERRORS=$((ERRORS + 1))
                ERROR_PROJECTS+=("$project_dir")
            fi
            ;;
        "copy")
            if install_copy "$project_dir"; then
                print_success "Installed: $project_name"
                INSTALLED=$((INSTALLED + 1))
                INSTALLED_PROJECTS+=("$project_dir")
            else
                print_error "Failed: $project_name"
                ERRORS=$((ERRORS + 1))
                ERROR_PROJECTS+=("$project_dir")
            fi
            ;;
    esac
}

# Main installation process
echo "Scanning for projects..."
echo ""

for search_path in "${SEARCH_PATHS[@]}"; do
    if [ ! -d "$search_path" ]; then
        continue
    fi

    print_info "Searching: $search_path"

    # Find all Git repositories in this path
    while IFS= read -r project_dir; do
        if [ -n "$project_dir" ] && [ -d "$project_dir" ]; then
            install_to_project "$project_dir"
        fi
    done < <(find_git_repos "$search_path")

    echo ""
done

# Summary Report
echo "=================================================================="
print_header "  Installation Summary"
echo "=================================================================="
echo ""
echo "Total Projects Scanned: $TOTAL_PROJECTS"
print_success "Newly Installed: $INSTALLED"
print_info "Already Exists: $ALREADY_EXISTS"
print_warning "Skipped: $SKIPPED"
print_error "Errors: $ERRORS"
echo ""

# Detailed lists
if [ ${#INSTALLED_PROJECTS[@]} -gt 0 ]; then
    echo "Newly Installed Projects:"
    for project in "${INSTALLED_PROJECTS[@]}"; do
        echo "  ✓ $project"
    done
    echo ""
fi

if [ ${#EXISTING_PROJECTS[@]} -gt 0 ]; then
    echo "Projects with Existing Plugin:"
    for project in "${EXISTING_PROJECTS[@]}"; do
        echo "  • $project"
    done
    echo ""
fi

if [ ${#ERROR_PROJECTS[@]} -gt 0 ]; then
    echo "Failed Installations:"
    for project in "${ERROR_PROJECTS[@]}"; do
        echo "  ✗ $project"
    done
    echo ""
fi

# Next steps
echo "=================================================================="
print_header "  Next Steps"
echo "=================================================================="
echo ""
echo "1. Verify installations:"
echo "   bash verify-all-installations.sh"
echo ""
echo "2. Commit submodules (if using submodule method):"
echo "   for dir in <project-dirs>; do"
echo "     cd \$dir"
echo "     git add .gitmodules .claude"
echo "     git commit -m 'Add Aurigraph Agents plugin'"
echo "     git push"
echo "   done"
echo ""
echo "3. Test plugin in any project:"
echo "   cd <any-project>"
echo "   node .claude/plugin/index.js list"
echo ""
echo "4. Share usage guide with team:"
echo "   cat .claude/plugin/README.md"
echo ""

# Generate commit script for submodules
if [ "$INSTALL_METHOD" = "submodule" ] && [ ${#INSTALLED_PROJECTS[@]} -gt 0 ]; then
    COMMIT_SCRIPT="commit-all-plugins.sh"
    cat > "$COMMIT_SCRIPT" <<'COMMIT_EOF'
#!/bin/bash
# Auto-generated script to commit plugin submodules

PROJECTS=(
COMMIT_EOF

    for project in "${INSTALLED_PROJECTS[@]}"; do
        echo "    \"$project\"" >> "$COMMIT_SCRIPT"
    done

    cat >> "$COMMIT_SCRIPT" <<'COMMIT_EOF'
)

for project in "${PROJECTS[@]}"; do
    echo "Committing plugin in: $(basename "$project")"
    cd "$project"

    if git diff --cached --quiet && git diff --quiet .gitmodules .claude 2>/dev/null; then
        echo "  No changes to commit"
    else
        git add .gitmodules .claude 2>/dev/null || true
        git commit -m "feat: Add Aurigraph Agents plugin

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>" 2>/dev/null || echo "  Commit failed (may already exist)"
    fi

    echo ""
done

echo "All commits complete!"
COMMIT_EOF

    chmod +x "$COMMIT_SCRIPT"
    print_success "Created commit script: $COMMIT_SCRIPT"
    echo ""
fi

echo "=================================================================="
print_success "Installation Complete!"
echo "=================================================================="
echo ""

# Exit code based on errors
if [ $ERRORS -gt 0 ]; then
    exit 1
else
    exit 0
fi
