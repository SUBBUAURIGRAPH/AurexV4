#!/bin/bash
#
# Verify Documentation Distribution Across All Projects
# Checks that all required documentation files are present
#
# Version: 1.0.0
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

# Required files
REQUIRED_FILES=(
    "CONTEXT.md"
    "TODO.md"
    "CHANGELOG.md"
    "SPARC_PLAN.md"
    "docs/SOPS.md"
    "docs/SKILLS.md"
)

# Search paths
SEARCH_PATHS=(
    "$HOME/subbuworkingdir"
    "$HOME/Documents/GitHub"
    "$HOME/Projects"
    "$HOME/workspace"
)

# Statistics
TOTAL_PROJECTS=0
COMPLETE_PROJECTS=0
INCOMPLETE_PROJECTS=0

declare -a COMPLETE_LIST
declare -a INCOMPLETE_LIST
declare -A MISSING_FILES

echo ""
echo "=================================================================="
print_header "  Documentation Verification"
echo "=================================================================="
echo ""

# Function to find all Git repositories
find_git_repos() {
    local search_path="$1"
    find "$search_path" -maxdepth 4 -name ".git" -type d 2>/dev/null | sed 's|/.git||'
}

# Function to check project documentation
check_project() {
    local project_dir="$1"
    local project_name=$(basename "$project_dir")

    TOTAL_PROJECTS=$((TOTAL_PROJECTS + 1))

    # Skip glowing-adventure
    if [[ "$project_dir" == *"glowing-adventure"* ]]; then
        return
    fi

    local all_present=true
    local missing_list=""

    # Check each required file
    for file in "${REQUIRED_FILES[@]}"; do
        if [ ! -f "$project_dir/$file" ]; then
            all_present=false
            missing_list+="$file "

            # Track missing file stats
            if [ -z "${MISSING_FILES[$file]}" ]; then
                MISSING_FILES[$file]=1
            else
                MISSING_FILES[$file]=$((MISSING_FILES[$file] + 1))
            fi
        fi
    done

    if $all_present; then
        print_success "Complete: $project_name"
        COMPLETE_PROJECTS=$((COMPLETE_PROJECTS + 1))
        COMPLETE_LIST+=("$project_dir")
    else
        print_warning "Incomplete: $project_name"
        print_info "  Missing: $missing_list"
        INCOMPLETE_PROJECTS=$((INCOMPLETE_PROJECTS + 1))
        INCOMPLETE_LIST+=("$project_dir:$missing_list")
    fi
}

# Scan all projects
echo "Scanning projects..."
echo ""

for search_path in "${SEARCH_PATHS[@]}"; do
    if [ ! -d "$search_path" ]; then
        continue
    fi

    print_header "Searching: $search_path"

    while IFS= read -r project_dir; do
        if [ -n "$project_dir" ] && [ -d "$project_dir" ]; then
            check_project "$project_dir"
        fi
    done < <(find_git_repos "$search_path")

    echo ""
done

# Summary
echo "=================================================================="
print_header "  Verification Summary"
echo "=================================================================="
echo ""
echo "Total Projects: $TOTAL_PROJECTS"
print_success "Complete Documentation: $COMPLETE_PROJECTS"
print_warning "Incomplete Documentation: $INCOMPLETE_PROJECTS"
echo ""

# Coverage percentage
if [ $TOTAL_PROJECTS -gt 0 ]; then
    COVERAGE=$((COMPLETE_PROJECTS * 100 / TOTAL_PROJECTS))
    echo "=================================================================="
    print_header "  Coverage: $COVERAGE% ($COMPLETE_PROJECTS/$TOTAL_PROJECTS projects)"
    echo "=================================================================="
    echo ""
fi

# Missing files breakdown
if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo "Missing Files Breakdown:"
    for file in "${REQUIRED_FILES[@]}"; do
        count=${MISSING_FILES[$file]:-0}
        if [ $count -gt 0 ]; then
            echo "  • $file: missing in $count project(s)"
        fi
    done
    echo ""
fi

# Incomplete projects list
if [ ${#INCOMPLETE_LIST[@]} -gt 0 ]; then
    echo "Projects with Incomplete Documentation:"
    for item in "${INCOMPLETE_LIST[@]}"; do
        IFS=':' read -r project missing <<< "$item"
        echo "  ⚠️  $(basename "$project")"
        echo "      Missing: $missing"
    done
    echo ""
fi

# Generate CSV report
REPORT_FILE="docs-distribution-report-$(date +%Y%m%d_%H%M%S).csv"
echo "Project,CONTEXT.md,TODO.md,CHANGELOG.md,SPARC_PLAN.md,SOPS.md,SKILLS.md,Complete" > "$REPORT_FILE"

for search_path in "${SEARCH_PATHS[@]}"; do
    if [ ! -d "$search_path" ]; then
        continue
    fi

    while IFS= read -r project_dir; do
        if [ -n "$project_dir" ] && [ -d "$project_dir" ]; then
            if [[ "$project_dir" == *"glowing-adventure"* ]]; then
                continue
            fi

            project_name=$(basename "$project_dir")
            context=$([ -f "$project_dir/CONTEXT.md" ] && echo "Yes" || echo "No")
            todo=$([ -f "$project_dir/TODO.md" ] && echo "Yes" || echo "No")
            changelog=$([ -f "$project_dir/CHANGELOG.md" ] && echo "Yes" || echo "No")
            sparc=$([ -f "$project_dir/SPARC_PLAN.md" ] && echo "Yes" || echo "No")
            sops=$([ -f "$project_dir/docs/SOPS.md" ] && echo "Yes" || echo "No")
            skills=$([ -f "$project_dir/docs/SKILLS.md" ] && echo "Yes" || echo "No")

            complete="No"
            if [ "$context" = "Yes" ] && [ "$todo" = "Yes" ] && [ "$changelog" = "Yes" ] && \
               [ "$sparc" = "Yes" ] && [ "$sops" = "Yes" ] && [ "$skills" = "Yes" ]; then
                complete="Yes"
            fi

            echo "\"$project_name\",$context,$todo,$changelog,$sparc,$sops,$skills,$complete" >> "$REPORT_FILE"
        fi
    done < <(find_git_repos "$search_path")
done

print_success "Report saved: $REPORT_FILE"
echo ""

# Recommendations
if [ $INCOMPLETE_PROJECTS -gt 0 ]; then
    echo "To add missing documentation:"
    echo "  bash distribute-docs-to-all-projects.sh"
    echo ""
fi

echo "=================================================================="
print_success "Verification Complete!"
echo "=================================================================="
echo ""

# Exit code
if [ $INCOMPLETE_PROJECTS -gt 0 ]; then
    exit 1
else
    exit 0
fi
