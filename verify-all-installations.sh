#!/bin/bash
#
# Verify Aurigraph Agents Plugin Installation Across All Projects
# Checks installation status and validates plugin in all repositories
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

# Configuration
PLUGIN_DIR=".claude"

# Search paths
SEARCH_PATHS=(
    "$HOME/subbuworkingdir"
    "$HOME/Documents/GitHub"
    "$HOME/Projects"
    "$HOME/workspace"
)

# Statistics
TOTAL_PROJECTS=0
WITH_PLUGIN=0
WITHOUT_PLUGIN=0
VALIDATION_PASSED=0
VALIDATION_FAILED=0

# Arrays
declare -a PROJECTS_WITH_PLUGIN
declare -a PROJECTS_WITHOUT_PLUGIN
declare -a VALIDATION_FAILED_PROJECTS

echo ""
echo "=================================================================="
print_header "  Plugin Installation Verification"
echo "=================================================================="
echo ""

# Function to find all Git repositories
find_git_repos() {
    local search_path="$1"
    find "$search_path" -maxdepth 4 -name ".git" -type d 2>/dev/null | sed 's|/.git||'
}

# Function to validate plugin installation
validate_plugin() {
    local project_dir="$1"
    local plugin_path="$project_dir/$PLUGIN_DIR"

    # Check core files
    local required_files=(
        "$plugin_path/SPARC.md"
        "$plugin_path/plugin/index.js"
        "$plugin_path/plugin/config.json"
        "$plugin_path/agents"
        "$plugin_path/skills"
    )

    for file in "${required_files[@]}"; do
        if [ ! -e "$file" ]; then
            return 1
        fi
    done

    return 0
}

# Function to check project
check_project() {
    local project_dir="$1"
    local project_name=$(basename "$project_dir")

    TOTAL_PROJECTS=$((TOTAL_PROJECTS + 1))

    # Skip glowing-adventure itself
    if [[ "$project_dir" == *"glowing-adventure"* ]]; then
        return
    fi

    if [ -d "$project_dir/$PLUGIN_DIR" ]; then
        WITH_PLUGIN=$((WITH_PLUGIN + 1))
        PROJECTS_WITH_PLUGIN+=("$project_dir")

        # Validate installation
        if validate_plugin "$project_dir"; then
            print_success "Valid: $project_name"
            VALIDATION_PASSED=$((VALIDATION_PASSED + 1))
        else
            print_warning "Incomplete: $project_name"
            VALIDATION_FAILED=$((VALIDATION_FAILED + 1))
            VALIDATION_FAILED_PROJECTS+=("$project_dir")
        fi
    else
        WITHOUT_PLUGIN=$((WITHOUT_PLUGIN + 1))
        PROJECTS_WITHOUT_PLUGIN+=("$project_dir")
        print_error "Missing: $project_name"
    fi
}

# Scan all projects
echo "Scanning projects..."
echo ""

for search_path in "${SEARCH_PATHS[@]}"; do
    if [ ! -d "$search_path" ]; then
        continue
    fi

    print_info "Searching: $search_path"

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
print_success "With Plugin: $WITH_PLUGIN"
print_error "Without Plugin: $WITHOUT_PLUGIN"
echo ""
print_success "Validation Passed: $VALIDATION_PASSED"
print_warning "Validation Failed: $VALIDATION_FAILED"
echo ""

# Detailed reports
if [ ${#PROJECTS_WITHOUT_PLUGIN[@]} -gt 0 ]; then
    echo "Projects WITHOUT Plugin:"
    for project in "${PROJECTS_WITHOUT_PLUGIN[@]}"; do
        echo "  ✗ $project"
    done
    echo ""
fi

if [ ${#VALIDATION_FAILED_PROJECTS[@]} -gt 0 ]; then
    echo "Projects with Incomplete Installation:"
    for project in "${VALIDATION_FAILED_PROJECTS[@]}"; do
        echo "  ⚠️  $project"
    done
    echo ""
fi

if [ ${#PROJECTS_WITH_PLUGIN[@]} -gt 0 ]; then
    echo "Projects WITH Valid Plugin:"
    for project in "${PROJECTS_WITH_PLUGIN[@]}"; do
        if validate_plugin "$project"; then
            echo "  ✓ $project"
        fi
    done
    echo ""
fi

# Coverage percentage
if [ $TOTAL_PROJECTS -gt 0 ]; then
    COVERAGE=$((WITH_PLUGIN * 100 / TOTAL_PROJECTS))
    echo "=================================================================="
    print_header "  Coverage: $COVERAGE% ($WITH_PLUGIN/$TOTAL_PROJECTS projects)"
    echo "=================================================================="
    echo ""
fi

# Recommendations
if [ $WITHOUT_PLUGIN -gt 0 ]; then
    echo "To install plugin to remaining projects:"
    echo "  bash install-to-all-projects.sh"
    echo ""
fi

if [ $VALIDATION_FAILED -gt 0 ]; then
    echo "To fix incomplete installations:"
    echo "  bash install-to-all-projects.sh"
    echo ""
fi

# Generate CSV report
REPORT_FILE="plugin-installation-report-$(date +%Y%m%d_%H%M%S).csv"
echo "Project,Plugin Installed,Validation Status" > "$REPORT_FILE"

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
            if [ -d "$project_dir/$PLUGIN_DIR" ]; then
                if validate_plugin "$project_dir"; then
                    echo "\"$project_name\",Yes,Valid" >> "$REPORT_FILE"
                else
                    echo "\"$project_name\",Yes,Incomplete" >> "$REPORT_FILE"
                fi
            else
                echo "\"$project_name\",No,N/A" >> "$REPORT_FILE"
            fi
        fi
    done < <(find_git_repos "$search_path")
done

print_success "Report saved: $REPORT_FILE"
echo ""

echo "=================================================================="
print_success "Verification Complete!"
echo "=================================================================="
echo ""

# Exit code
if [ $WITHOUT_PLUGIN -gt 0 ] || [ $VALIDATION_FAILED -gt 0 ]; then
    exit 1
else
    exit 0
fi
