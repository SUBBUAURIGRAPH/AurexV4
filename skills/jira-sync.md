# JIRA Sync Skill

**Agent**: Project Manager  
**Purpose**: Automated JIRA-GitHub synchronization  
**Status**: Implemented  
**Version**: 1.0.0

## Overview
Automates bidirectional synchronization between JIRA and GitHub, consolidating 8+ existing JIRA scripts into one intelligent workflow.

## Capabilities
- Sync commits and PRs to JIRA tickets
- Create JIRA tickets from code TODOs
- Update ticket status based on PR/commit state
- Bulk ticket operations
- Sprint tracking and burndown
- Generate sync reports

## Usage
```
@project-manager jira-sync "Sync last week's commits to JIRA"
@project-manager jira-sync "Create tickets from TODOs in src/"
@project-manager jira-sync "Update sprint progress"
```

## Existing Scripts Integrated
- `jira-github-sync.js` - Main sync script
- `automode-jira-sync.js` - Automated sync
- `jira-sync-robust.js` - Robust sync with retry
- `scripts/jira-update-sprint1.js` - Sprint updates
- `scripts/analyze-todo-jira.js` - TODO analysis
- 3+ additional JIRA utilities

## Key Features
- **Bidirectional sync**: GitHub ↔ JIRA
- **Smart ticket creation**: From TODOs, PRs, issues
- **Status automation**: Update based on Git events
- **Bulk operations**: Process multiple tickets
- **Sprint tracking**: Velocity, burndown, completion

## Configuration
Uses existing JIRA credentials from credentials.md:
- JIRA URL: https://aurigraphdlt.atlassian.net
- Project: HMS
- Board ID: 459

---
**Owner**: PM Team | **Updated**: 2025-10-20
