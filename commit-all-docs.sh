#!/bin/bash
# Auto-generated script to commit documentation files

PROJECTS=(
)

for project in "${PROJECTS[@]}"; do
    echo "Committing docs in: $(basename "$project")"
    cd "$project"

    # Add docs files
    git add CONTEXT.md TODO.md CHANGELOG.md SPARC_PLAN.md docs/SOPS.md docs/SKILLS.md 2>/dev/null || true

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

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>" 2>/dev/null || echo "  Commit failed (may already exist)"
    else
        echo "  No changes to commit"
    fi

    echo ""
done

echo "All commits complete!"
