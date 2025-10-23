#!/bin/bash
#
# Distribute Documentation Files to All Projects
# Copies essential documentation files to all Git repositories
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
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"

# Files to distribute (pairs of source:destination)
FILES_TO_COPY=(
    "CONTEXT.md:CONTEXT.md"
    "TODO.md:TODO.md"
    "CHANGELOG.md:CHANGELOG.md"
    "SPARC_PLAN_TEMPLATE.md:SPARC_PLAN.md"
    "docs/SOPS.md:docs/SOPS.md"
    "docs/SKILLS.md:docs/SKILLS.md"
    "docs/PRD_TEMPLATE.md:docs/PRD.md"
    "docs/ARCHITECTURE_TEMPLATE.md:docs/ARCHITECTURE.md"
)

# Search paths for projects
SEARCH_PATHS=(
    "$HOME/subbuworkingdir"
    "$HOME/Documents/GitHub"
    "$HOME/Projects"
    "$HOME/workspace"
)

# Options
OVERWRITE="${1:-ask}"  # ask, yes, no, skip-existing

# Statistics
TOTAL_PROJECTS=0
FILES_COPIED=0
FILES_SKIPPED=0
FILES_EXISTS=0
ERRORS=0

declare -a UPDATED_PROJECTS
declare -a SKIPPED_PROJECTS
declare -a ERROR_PROJECTS

echo ""
echo "=================================================================="
print_header "  Documentation Distribution"
echo "=================================================================="
echo ""
print_info "Source: $SOURCE_DIR"
print_info "Overwrite mode: $OVERWRITE"
echo ""
print_info "Files to distribute:"
for pair in "${FILES_TO_COPY[@]}"; do
    IFS=':' read -r source dest <<< "$pair"
    echo "  • $source → $dest"
done
echo ""

# Function to find all Git repositories
find_git_repos() {
    local search_path="$1"
    find "$search_path" -maxdepth 4 -name ".git" -type d 2>/dev/null | sed 's|/.git||'
}

# Function to copy file with optional overwrite
copy_file() {
    local source_file="$1"
    local dest_file="$2"
    local project_dir="$3"
    local overwrite_mode="$4"

    local full_dest="$project_dir/$dest_file"
    local dest_dir=$(dirname "$full_dest")

    # Create destination directory if needed
    mkdir -p "$dest_dir" 2>/dev/null || return 1

    # Check if file exists
    if [ -f "$full_dest" ]; then
        case "$overwrite_mode" in
            "yes")
                cp "$source_file" "$full_dest" 2>/dev/null || return 1
                return 0
                ;;
            "no")
                return 2  # Skip
                ;;
            "skip-existing")
                return 2  # Skip
                ;;
            "ask")
                # For batch mode, default to skip
                return 2
                ;;
        esac
    else
        cp "$source_file" "$full_dest" 2>/dev/null || return 1
        return 0
    fi
}

# Function to process a project
process_project() {
    local project_dir="$1"
    local project_name=$(basename "$project_dir")

    TOTAL_PROJECTS=$((TOTAL_PROJECTS + 1))

    # Skip glowing-adventure itself
    if [[ "$project_dir" == *"glowing-adventure"* ]]; then
        print_warning "Skipping: $project_name (source repository)"
        return
    fi

    print_info "Processing: $project_name"

    local files_copied_this_project=0
    local files_skipped_this_project=0
    local files_exists_this_project=0
    local had_errors=false

    # Copy each file
    for pair in "${FILES_TO_COPY[@]}"; do
        IFS=':' read -r source dest <<< "$pair"
        local source_file="$SOURCE_DIR/$source"
        local dest_file="$dest"

        if [ ! -f "$source_file" ]; then
            print_error "  Source not found: $source"
            ERRORS=$((ERRORS + 1))
            had_errors=true
            continue
        fi

        copy_file "$source_file" "$dest_file" "$project_dir" "$OVERWRITE"
        local result=$?

        case $result in
            0)
                print_success "  Copied: $dest_file"
                files_copied_this_project=$((files_copied_this_project + 1))
                FILES_COPIED=$((FILES_COPIED + 1))
                ;;
            2)
                print_info "  Exists: $dest_file"
                files_exists_this_project=$((files_exists_this_project + 1))
                FILES_EXISTS=$((FILES_EXISTS + 1))
                ;;
            *)
                print_error "  Failed: $dest_file"
                ERRORS=$((ERRORS + 1))
                had_errors=true
                ;;
        esac
    done

    if [ $files_copied_this_project -gt 0 ]; then
        UPDATED_PROJECTS+=("$project_dir")
    fi

    if $had_errors; then
        ERROR_PROJECTS+=("$project_dir")
    fi

    echo ""
}

# Main process
echo "Scanning for projects..."
echo ""

for search_path in "${SEARCH_PATHS[@]}"; do
    if [ ! -d "$search_path" ]; then
        continue
    fi

    print_header "Searching: $search_path"

    while IFS= read -r project_dir; do
        if [ -n "$project_dir" ] && [ -d "$project_dir" ]; then
            process_project "$project_dir"
        fi
    done < <(find_git_repos "$search_path")

    echo ""
done

# Summary Report
echo "=================================================================="
print_header "  Distribution Summary"
echo "=================================================================="
echo ""
echo "Total Projects Processed: $TOTAL_PROJECTS"
print_success "Files Copied: $FILES_COPIED"
print_info "Files Already Exist: $FILES_EXISTS"
print_error "Errors: $ERRORS"
echo ""

# Calculate per-file stats
echo "Per-File Statistics:"
for pair in "${FILES_TO_COPY[@]}"; do
    IFS=':' read -r source dest <<< "$pair"
    echo "  • $dest"
done
echo ""

# Detailed lists
if [ ${#UPDATED_PROJECTS[@]} -gt 0 ]; then
    echo "Projects Updated:"
    for project in "${UPDATED_PROJECTS[@]}"; do
        echo "  ✓ $project"
    done
    echo ""
fi

if [ ${#ERROR_PROJECTS[@]} -gt 0 ]; then
    echo "Projects with Errors:"
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
echo "1. Review copied files in each project"
echo ""
echo "2. Customize files for each project:"
echo "   • Update CONTEXT.md with project-specific context"
echo "   • Update TODO.md with current tasks"
echo "   • Update SPARC_PLAN.md with project plan"
echo ""
echo "3. Commit changes to each project:"
echo "   cd <project-dir>"
echo "   git add CONTEXT.md TODO.md CHANGELOG.md SPARC_PLAN.md docs/"
echo "   git commit -m 'docs: Add standard documentation files'"
echo "   git push"
echo ""
echo "4. Verify distribution:"
echo "   bash verify-docs-distribution.sh"
echo ""

# Generate commit script
COMMIT_SCRIPT="commit-all-docs.sh"
cat > "$COMMIT_SCRIPT" <<'COMMIT_EOF'
#!/bin/bash
# Auto-generated script to commit documentation files

PROJECTS=(
COMMIT_EOF

for project in "${UPDATED_PROJECTS[@]}"; do
    echo "    \"$project\"" >> "$COMMIT_SCRIPT"
done

cat >> "$COMMIT_SCRIPT" <<'COMMIT_EOF'
)

for project in "${PROJECTS[@]}"; do
    echo "Committing docs in: $(basename "$project")"
    cd "$project"

    # Add docs files
    git add CONTEXT.md TODO.md CHANGELOG.md SPARC_PLAN.md docs/SOPS.md docs/SKILLS.md docs/PRD.md docs/ARCHITECTURE.md 2>/dev/null || true

    # Commit if there are changes
    if ! git diff --cached --quiet 2>/dev/null; then
        git commit -m "docs: Add standard documentation files

Added organization-wide standard documentation:
- CONTEXT.md: Project context and background
- TODO.md: Task tracking
- CHANGELOG.md: Version history
- SPARC_PLAN.md: SPARC development plan
- docs/SOPS.md: Standard Operating Procedures
- docs/SKILLS.md: Skills matrix
- docs/PRD.md: Product Requirements Document
- docs/ARCHITECTURE.md: Software Architecture Document

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>" 2>/dev/null || echo "  Commit failed (may already exist)"
    else
        echo "  No changes to commit"
    fi

    echo ""
done

echo "All commits complete!"
COMMIT_EOF

chmod +x "$COMMIT_SCRIPT"

if [ ${#UPDATED_PROJECTS[@]} -gt 0 ]; then
    print_success "Created commit script: $COMMIT_SCRIPT"
    echo ""
    echo "To commit all changes:"
    echo "  bash $COMMIT_SCRIPT"
    echo ""
fi

echo "=================================================================="
print_success "Distribution Complete!"
echo "=================================================================="
echo ""

# Exit code
if [ $ERRORS -gt 0 ]; then
    exit 1
else
    exit 0
fi
