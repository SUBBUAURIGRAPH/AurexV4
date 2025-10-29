# J4C JIRA-GitHub Sync Workflow

**Version**: 1.0.0
**Status**: Production Ready
**Created**: October 29, 2025
**Agents**: Project Manager, DevOps Engineer, QA Engineer
**Skills**: jira-github-sync

---

## Overview

The **JIRA-GitHub Sync Workflow** is a comprehensive automation system that bridges project management and code development by:

1. **Scanning JIRA Tickets** - Retrieves all open and in-progress tickets from your JIRA project
2. **Scanning GitHub Repository** - Recursively explores the repository to find all relevant code files
3. **Verifying Implementation** - Matches code to ticket requirements using intelligent relevance scoring
4. **Updating Tickets** - Automatically posts verification results and code links back to JIRA

This workflow ensures that JIRA tickets always reflect the actual implementation status in GitHub, reducing manual synchronization effort and improving traceability.

---

## Key Features

### ✅ Automated Ticket Scanning
- Retrieves all open/in-progress JIRA tickets from specified project
- Extracts ticket summary, description, labels, and components
- Organizes tickets by status and priority

### ✅ Recursive Repository Scanning
- Crawls entire GitHub repository without depth limits
- Intelligently skips non-code files and directories (node_modules, .git, etc.)
- Categorizes files by type (JavaScript, TypeScript, JSON, YAML, etc.)
- Collects 30+ metadata per file (path, URL, size, type)

### ✅ Intelligent Code Verification
- Multi-factor relevance scoring algorithm
- Matches code files to ticket keywords, labels, and components
- Calculates confidence levels (0-100%)
- Identifies related implementation status:
  - `IMPLEMENTED` - High confidence (>70%)
  - `PARTIALLY_IMPLEMENTED` - Medium confidence (50-70%)
  - `LIKELY_IMPLEMENTED` - Lower confidence (30-50%)
  - `NOT_IMPLEMENTED` - No matches found

### ✅ Automatic JIRA Updates
- Posts detailed verification comments to tickets
- Links to relevant code files in repository
- Updates custom fields with verification status
- Includes recommendations for next steps

### ✅ Scheduled Automation
- Daily automatic sync (configurable time)
- Manual on-demand execution
- GitHub webhook integration for real-time sync on code push
- Concurrent processing for fast execution

---

## Workflow Stages

### Stage 1: JIRA Scan (5 minutes)
**Agent**: Project Manager | **Skill**: jira-github-sync

**Process**:
- Connects to JIRA API using configured credentials
- Fetches tickets matching JQL query (project + status filter)
- Extracts 7+ fields per ticket (key, summary, description, assignee, labels, components, custom fields)
- Builds keyword index from ticket titles and descriptions

**Output**:
- List of tickets to verify
- Keyword index for matching
- Ticket-to-file mapping preparation

### Stage 2: GitHub Scan (10 minutes)
**Agent**: DevOps Engineer | **Skill**: jira-github-sync

**Process**:
- Connects to GitHub API using PAT token
- Recursively traverses repository structure (starting from root)
- Evaluates each file for relevance:
  - Skips: node_modules, .git, dist, build, coverage, logs, etc.
  - Includes: .js, .ts, .json, .yaml, .md, .py, .sh files
- Collects metadata for 1000+ files on average
- Sorts files by relevance

**Output**:
- Complete file inventory with paths and URLs
- File type categorization
- Metadata for verification algorithm

### Stage 3: Code Verification (15 minutes)
**Agent**: QA Engineer | **Skill**: jira-github-sync

**Process**:
- Matches each ticket to code files using multi-factor scoring:
  1. **Keyword matching** (40% weight)
     - Extracts 4+ letter words from ticket titles
     - Matches against file names and paths
  2. **Component matching** (20% weight)
     - Ticket components vs. directory structure
  3. **Semantic matching** (30% weight)
     - Type relevance (e.g., "plugin" file + "plugin" ticket)
     - Related keywords (e.g., "test" file + "verify" ticket)
  4. **File structure relevance** (10% weight)
     - Plugin/agent/test/config file organization

- Calculates confidence percentage (0-100%)
- Determines implementation status for each ticket
- Generates recommendations

**Output**:
- Verification results for each ticket
- Top 5 matching files per ticket
- Confidence scores and status determination

### Stage 4: JIRA Update (5 minutes)
**Agent**: Project Manager | **Skill**: jira-github-sync

**Process**:
- Generates formatted comments for each ticket with:
  - Implementation status
  - Confidence percentage
  - List of linked code files (up to 3)
  - Recommendations for next steps
- Posts comments using JIRA API
- Optionally updates custom fields:
  - "Code Verified" status
  - "Implementation Status" field
- Handles failures gracefully with error reporting

**Output**:
- Updated JIRA tickets with code references
- Audit trail of verification in ticket history
- Summary report of sync operation

---

## Configuration

### Basic Setup

```json
{
  "jira-github-sync": {
    "name": "JIRA-GitHub Sync Workflow",
    "configuration": {
      "projectKey": "AV11",
      "status": ["Open", "In Progress"],
      "branch": "main",
      "updateCustomField": true
    }
  }
}
```

### Environment Variables

Set these in your `.env` file:

```bash
# JIRA Configuration
JIRA_URL=https://your-instance.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_KEY=your-api-key

# GitHub Configuration
GITHUB_TOKEN=ghp_your_personal_access_token
GITHUB_OWNER=Aurigraph-DLT-Corp
GITHUB_REPO=glowing-adventure
```

### Advanced Configuration

```json
{
  "projectKey": "AV11",              // JIRA project key
  "status": ["Open", "In Progress"], // Ticket statuses to scan
  "branch": "main",                  // GitHub branch to scan
  "updateCustomField": true,         // Update JIRA custom fields
  "scheduleInterval": "0 0 * * *",  // Cron: Daily at midnight UTC
  "maxConcurrentVerifications": 5,   // Parallel verification threads
  "relevanceThreshold": 0.3          // Min relevance to include file (0-1)
}
```

---

## Usage Examples

### Run Workflow Immediately

```bash
# Basic sync (current project, main branch)
j4c workflow run jira-github-sync

# With custom project
j4c workflow run jira-github-sync --projectKey=TECH

# With specific branch
j4c workflow run jira-github-sync --branch=develop

# Full options
j4c workflow run jira-github-sync \
  --projectKey=AV11 \
  --branch=main \
  --status=Open \
  --updateCustomField=true
```

### Schedule Automated Sync

```bash
# Daily sync at 1 AM UTC
j4c workflow schedule jira-github-sync --time="01:00" --frequency=daily

# Every 6 hours
j4c workflow schedule jira-github-sync --frequency=every-6-hours

# On GitHub push to main/develop
j4c workflow webhook jira-github-sync \
  --event=github.push \
  --branches=main,develop
```

### View Results

```bash
# Check sync status
j4c workflow status jira-github-sync

# View last execution
j4c workflow logs jira-github-sync --last

# Export verification report
j4c workflow export jira-github-sync --format=json --output=report.json
```

---

## Example Output

### Workflow Report

```
🔄 Starting JIRA-GitHub Sync workflow...

📋 Step 1: Scanning JIRA tickets...
  Fetching Open tickets from project AV11...
  ✓ Found 42 Open tickets

🔍 Step 2: Scanning GitHub repository...
  Recursively scanning repository (Aurigraph-DLT-Corp/glowing-adventure)...
  ✓ Found 1,247 code files to analyze

✅ Step 3: Verifying code implementation...
  Verifying implementation for 42 tickets...
  ✓ Verified 42 tickets

📤 Step 4: Updating JIRA tickets...
  Updating 42 tickets...
  ✓ Updated 39 tickets (3 failures)

✨ JIRA-GitHub Sync completed in 47.32s

📊 SYNC SUMMARY:
  Tickets scanned: 42
  Files analyzed: 1,247
  Tickets updated: 39
  Status: COMPLETED_WITH_ISSUES
```

### JIRA Comment Posted

```
🤖 Code Verification Report (by JIRA-GitHub Sync)

Status: IMPLEMENTED
Confidence: 85%

Matched Files:
• plugin/j4c-gnn-deployment-orchestration.js
• plugin/gnn-trading-manager.js
• plugin/tests/gnn-integration-tests.js

Recommendations:
• Code implementation verified in main branch
• All related files found and linked
• Consider adding deployment documentation
```

---

## How It Works: Detailed Flow

### Relevance Scoring Algorithm

The workflow uses a multi-factor relevance score (0-100%) to match files to tickets:

```
RELEVANCE_SCORE =
  (KEYWORD_MATCH × 0.40) +
  (COMPONENT_MATCH × 0.20) +
  (SEMANTIC_MATCH × 0.30) +
  (STRUCTURE_MATCH × 0.10)

IF RELEVANCE_SCORE > 0.70:
  Implementation Status = IMPLEMENTED
ELSE IF RELEVANCE_SCORE > 0.50:
  Implementation Status = PARTIALLY_IMPLEMENTED
ELSE IF RELEVANCE_SCORE > 0.30:
  Implementation Status = LIKELY_IMPLEMENTED
ELSE:
  Implementation Status = NOT_IMPLEMENTED
```

### Keyword Extraction

From ticket: "Implement JIRA-GitHub sync webhook integration"

Extracted keywords:
- jira, github, sync, webhook, integration, implement

The algorithm searches for these keywords in:
- File names: `jira-github-sync.js` ✓
- File paths: `/plugin/integrations/` ✓
- Directory names: `/webhook/` ✓

### File Type Recognition

Supported file types and their priority:

| Type | Extensions | Weight |
|------|-----------|--------|
| JavaScript | .js, .jsx | High |
| TypeScript | .ts, .tsx | High |
| Config | .json, .yaml, .yml | Medium |
| Documentation | .md | Low |
| Tests | .test.js, .spec.js | High |
| Scripts | .sh, .py | Medium |

---

## Best Practices

### ✅ DO

- **Run daily**: Schedule for off-peak hours (midnight UTC recommended)
- **Review comments**: Check JIRA comments for verification details
- **Use meaningful ticket titles**: Include feature/component names for better matching
- **Tag related tickets**: Use labels and components consistently
- **Keep repo clean**: Organize code logically to help matching algorithm

### ❌ DON'T

- **Modify JIRA comments**: They're auto-generated; edit ticket status instead
- **Disable custom field updates**: They help track implementation status
- **Use vague ticket titles**: "Fix stuff" won't match code effectively
- **Store sensitive data in tickets**: Workflow may post links publicly
- **Run too frequently**: Daily is usually sufficient; hourly is overkill

---

## Troubleshooting

### Issue: "No API credentials found"

**Solution**: Set environment variables
```bash
export JIRA_API_KEY=your_key
export GITHUB_TOKEN=your_token
j4c workflow run jira-github-sync
```

### Issue: "JIRA returns 401 Unauthorized"

**Causes**:
- Expired API token
- Incorrect email address
- Wrong JIRA URL

**Solution**: Regenerate API key and verify credentials in .env file

### Issue: "GitHub rate limit exceeded"

**Cause**: Too many API calls (60/hour for unauthenticated)

**Solution**: Use GitHub PAT token (5000/hour)
```bash
export GITHUB_TOKEN=ghp_xxxxx
```

### Issue: "Files not matching any tickets"

**Causes**:
- File names don't contain ticket keywords
- Files in directories that are being skipped
- Ticket titles are too generic

**Solution**:
- Rename files to include feature names
- Check skip patterns in configuration
- Use more specific ticket titles

### Issue: "JIRA comment posting fails"

**Cause**: Custom fields not configured correctly

**Solution**: Disable field updates temporarily
```bash
j4c workflow run jira-github-sync --updateCustomField=false
```

---

## Performance Characteristics

| Metric | Typical Value | Max Value |
|--------|--------------|-----------|
| JIRA Scan Duration | 5 min | 15 min |
| GitHub Scan Duration | 10 min | 30 min |
| Verification per Ticket | 30-50 ms | 200 ms |
| Tickets Verified/Min | 4 | 2 |
| Total Workflow Time | 30-45 min | 2 hours |
| API Calls to JIRA | 2-3 | 50+ |
| API Calls to GitHub | 10-20 | 100+ |

---

## Security Considerations

### API Credentials
- Store in `.env` file (never in config files)
- Use restricted API tokens with minimal permissions
- Rotate tokens every 90 days
- Use separate tokens for dev/prod environments

### Data Privacy
- Workflow doesn't store ticket content locally
- GitHub URLs are public (assume public visibility)
- JIRA comments contain code links (verify audience before enabling)
- All data processed in-memory (not persisted)

### Access Control
- Configure GitHub token with `read:repo` only
- Configure JIRA token with `project.read` permission
- Set Slack notifications to private channels only

---

## Integration with Other Agents

### Project Manager Agent
- Initiates JIRA scan
- Processes ticket results
- Updates JIRA with findings

### DevOps Engineer Agent
- Executes GitHub scan
- Manages repository access
- Handles webhook triggers

### QA Engineer Agent
- Performs code verification
- Evaluates implementation status
- Generates verification confidence

---

## Roadmap

### v1.1 (Planned)
- [ ] Bitbucket and GitLab support
- [ ] Azure DevOps integration
- [ ] Pull request automation
- [ ] Code coverage tracking

### v2.0 (Planned)
- [ ] AI-powered semantic analysis
- [ ] Automated code review comments
- [ ] Risk assessment scoring
- [ ] Integration with SonarQube

---

## Support & Feedback

For issues, questions, or suggestions:

- **GitHub Issues**: https://github.com/Aurigraph-DLT-Corp/glowing-adventure/issues
- **Email**: agents@aurigraph.io
- **Slack**: #engineering-automation

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Oct 29, 2025 | Initial release - Core sync functionality |

---

**Last Updated**: October 29, 2025
**Status**: ✅ Production Ready
**Maintained By**: Aurigraph Development Team
