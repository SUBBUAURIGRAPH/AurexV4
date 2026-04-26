# Claude Code Automation (AV4-405 / AAT-405)

This runbook covers the Claude Code SDK / `claude` CLI workflows wired into
AurexV4 CI/CD. They activate automatically on the next push to `main` once the
required GitHub Actions secrets are set.

## Workflows at a glance

| Workflow | File | Trigger | Output | Blocking? |
| --- | --- | --- | --- | --- |
| Protocol & money-path audit | `.github/workflows/claude-audit.yml` | PR touching audit paths + `workflow_dispatch` | `audit.json` artifact + PR comment | **Yes** if any `high`/`critical` finding |
| Issue stub scaffolder | `.github/workflows/claude-issue-stubs.yml` | Issue opened/labeled with `claude-stub` | Draft PR + `claude-scaffold.json` artifact | No |
| Advisory PR review | `.github/workflows/claude-pr-review.yml` | PR review requested from a `claude*` user/team | PR comment | No (advisory only) |
| Spec compliance diff | `.github/workflows/claude-spec-compliance.yml` | Push to `main` touching spec docs + `workflow_dispatch` | `spec-gaps.json` artifact + Jira tickets for P0/P1 | No |

## Audit scope (Slice A)

The audit workflow runs only when a PR changes one of these paths:

- `packages/aurigraph-dlt-sdk/**` — vendored Aurigraph DLT SDK (Wave 1)
- `apps/api/src/services/chains/**` — chain adapters
- `apps/api/src/services/billing/**` — money path
- `apps/api/src/services/coupon.service.ts` — money path
- `apps/api/src/services/registries/bcr/**` — BCR registry adapter
- `apps/api/src/routes/awd2-handoff.ts` — AWD2 handoff route
- `apps/api/src/services/federation/**` — S2S identity federation

Session continuity is preserved across re-runs on the same PR via
`--session "<repo>-<pr-or-run-id>"`, so Claude resumes the prior audit state
instead of starting cold.

## Spec compliance scope (Slice C)

The spec compliance workflow watches:

- `docs/BIOCARBON_*.md`
- `docs/A6_4_*.md`
- `docs/PRICING.md`

For every gap with `priority` in `{P0, P1}` it creates a Jira `Task` with
labels `spec-gap` + `automated`. Idempotency is enforced by a content-hashed
`globalId: spec-gap-<sha256>` marker embedded in the description; re-running
the workflow on the same diff will not create duplicates.

## Required GitHub Actions secrets

Add these via **Settings → Secrets and variables → Actions** on the repo:

| Secret | Used by | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | all 4 Claude workflows | API key with Claude Code CLI access |
| `JIRA_USER_EMAIL` | spec-compliance | Atlassian account email |
| `JIRA_API_TOKEN` | spec-compliance | https://id.atlassian.com/manage-profile/security/api-tokens |
| `JIRA_BASE_URL` *(optional)* | spec-compliance | Default `https://aurigraphdlt.atlassian.net` |
| `JIRA_PROJECT_KEY` *(optional)* | spec-compliance | Default `AV4` |
| `GH_TOKEN` *(optional)* | issue-stubs | Falls back to `GITHUB_TOKEN`; only override if the default lacks PR-write |

> Never commit real key values. The workflows read everything from `secrets.*`.

## Enabling / disabling per workflow

Each workflow is a separate file under `.github/workflows/`. To pause one:

```bash
git mv .github/workflows/claude-audit.yml .github/workflows/claude-audit.yml.disabled
```

…and push. GitHub only loads files matching `*.yml` / `*.yaml`, so renaming
disables it without losing history. Alternatively, add an `if: false` guard at
the job level for a temporary off-switch.

## Viewing audit history

1. **Workflow artifacts** — every run uploads `audit.json` (and `diff.patch`).
   Open the run summary on the **Actions** tab, scroll to *Artifacts*.
2. **Claude session id** — the audit comment in the PR shows the session id
   (e.g. `org-AurexV4-42`). Resume that session locally with:
   ```bash
   claude --session "org-AurexV4-42" -p "show me the last audit summary"
   ```
3. **Jira spec-gap tickets** — search `labels = "spec-gap"` in the AV4 project.

## Sample audit artifact

```json
{
  "findings": [
    {
      "severity": "high",
      "area": "money-path",
      "file": "apps/api/src/services/billing/quota.service.ts",
      "line": 142,
      "finding": "Quota check uses non-atomic read-modify-write on Redis counter",
      "recommendation": "Use INCR/INCRBY with TTL set on first write, or move to a Lua script for atomicity.",
      "references": ["docs/PRICING.md#tier-quotas", "ADM-040"]
    }
  ]
}
```

## Local invocation (for ops)

You can replay any of these workflows locally — handy when triaging a flaky
finding:

```bash
# audit a local diff against main
git diff origin/main...HEAD -- packages/aurigraph-dlt-sdk/ > diff.patch
claude -p "Audit the attached diff..." --allowed-tools read --output-format json --system-prompt "..." < diff.patch

# replay spec-gap ticket creation from a saved gaps file (dry-run)
python3 scripts/jira/create-spec-gap-ticket.py --gaps spec-gaps.json --dry-run
```

## Operational notes

- Runners: all four workflows pin `runs-on: self-hosted`, matching the rest
  of AurexV4 CI (never `ubuntu-latest`).
- Action versions: `actions/checkout@v4`, `actions/upload-artifact@v4`.
- Rate limits: Claude Code CLI handles retries/backoff itself; the workflows
  don't reimplement that.
- Failure mode: if `ANTHROPIC_API_KEY` is missing, every workflow logs the
  error and exits non-zero. If only Jira secrets are missing, the spec-diff
  workflow still uploads its artifact and merely skips ticket creation.

## Source

Filed as **AV4-405** / **AAT-405** on 2026-04-26. See commit hash + this
runbook's git log for the full implementation history.
