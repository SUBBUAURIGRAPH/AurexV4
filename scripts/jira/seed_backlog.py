#!/usr/bin/env python3
"""
Create Jira Epics → Stories → Sub-tasks from backlog_seed.json using Jira Cloud REST API v3.

Prerequisites
-------------
1. Jira Cloud project already exists (team-managed or company-managed) with compatible issue types.
2. API token: https://id.atlassian.com/manage-profile/security/api-tokens
3. Environment:
     export JIRA_BASE_URL="https://aurigraphdlt.atlassian.net"
     export JIRA_USER_EMAIL="you@company.com"
     export JIRA_API_TOKEN="..."
     export JIRA_PROJECT_KEY="AV4"   # or your new project key

Epic Link (company-managed classic)
-----------------------------------
If stories must link to an Epic, discover the custom field id:

  curl -s -u "$JIRA_USER_EMAIL:$JIRA_API_TOKEN" \\
    "$JIRA_BASE_URL/rest/api/3/field" | python3 -c "import sys,json;\\
      [print(f'{f['id']}: {f['name']}') for f in json.load(sys.stdin) if 'epic' in f['name'].lower()]"

Pass it explicitly:

  python3 scripts/jira/seed_backlog.py --epic-link-field customfield_10014

Team-managed (next-gen) projects often use parent linkage instead; try --no-epic-link and rely on
Advanced Roadmaps / parent field if your site uses parent for Epics.

Usage
-----
  python3 scripts/jira/seed_backlog.py --dry-run
  python3 scripts/jira/seed_backlog.py
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import ssl
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


def env(name: str, default: str | None = None) -> str:
    v = os.environ.get(name, default)
    if not v:
        raise SystemExit(f"Missing required env var: {name}")
    return v


def adf_paragraph(text: str) -> dict[str, Any]:
    return {
        "type": "doc",
        "version": 1,
        "content": [{"type": "paragraph", "content": [{"type": "text", "text": text}]}],
    }


class JiraClient:
    def __init__(self, base_url: str, email: str, token: str) -> None:
        self.base_url = base_url.rstrip("/")
        raw = f"{email}:{token}".encode()
        self._auth = "Basic " + base64.b64encode(raw).decode()

    def request(self, method: str, path: str, body: dict | None = None) -> Any:
        url = f"{self.base_url}{path}"
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", self._auth)
        req.add_header("Accept", "application/json")
        if body is not None:
            req.add_header("Content-Type", "application/json")
        ctx = ssl.create_default_context()
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=60) as resp:
                payload = resp.read().decode()
                return json.loads(payload) if payload else {}
        except urllib.error.HTTPError as e:
            err = e.read().decode()
            raise SystemExit(f"HTTP {e.code} {method} {path}: {err}") from e


def create_issue(
    client: JiraClient,
    *,
    project_key: str,
    summary: str,
    description: str,
    issue_type: str,
    parent_key: str | None,
    epic_link_field: str | None,
    epic_key: str | None,
) -> str:
    fields: dict[str, Any] = {
        "project": {"key": project_key},
        "summary": summary[:240],
        "description": adf_paragraph(description[:32000]),
        "issuetype": {"name": issue_type},
    }
    if parent_key:
        fields["parent"] = {"key": parent_key}
    if epic_key and epic_link_field:
        fields[epic_link_field] = epic_key
    body = {"fields": fields}
    out = client.request("POST", "/rest/api/3/issue", body)
    return str(out["key"])


def load_seed(path: str) -> dict[str, Any]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def apply_credentials_md(path: Path) -> None:
    """Fill os.environ JIRA_* from markdown table + ```bash export``` block (only if env var unset)."""
    if not path.is_file():
        return
    text = path.read_text(encoding="utf-8")
    table_map = {
        "user email": "JIRA_USER_EMAIL",
        "api token": "JIRA_API_TOKEN",
        "default project key": "JIRA_PROJECT_KEY",
        "epic link field id (optional)": "JIRA_EPIC_LINK_FIELD",
    }
    for line in text.splitlines():
        if not line.strip().startswith("|"):
            continue
        parts = [p.strip() for p in line.strip().split("|") if p.strip()]
        if len(parts) < 2:
            continue
        label, val = parts[0].lower(), parts[1].strip("` ")
        if label in ("field", "---", "wbs", "type") or not val:
            continue
        env_key = table_map.get(label)
        if env_key and not os.environ.get(env_key):
            os.environ[env_key] = val
    export_re = re.compile(
        r"^export\s+(JIRA_[A-Z0-9_]+)=(?:\"([^\"]*)\"|'([^']*)'|([^#\s]+))\s*(?:#.*)?$"
    )
    for line in text.splitlines():
        m = export_re.match(line.strip())
        if not m:
            continue
        key = m.group(1)
        val = m.group(2) or m.group(3) or m.group(4) or ""
        if val and not os.environ.get(key):
            os.environ[key] = val


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--seed",
        default=os.path.join(os.path.dirname(__file__), "backlog_seed.json"),
        help="Path to backlog_seed.json",
    )
    ap.add_argument("--project-key", default=os.environ.get("JIRA_PROJECT_KEY", ""))
    ap.add_argument(
        "--epic-link-field",
        default=os.environ.get("JIRA_EPIC_LINK_FIELD", ""),
        help='e.g. customfield_10014; leave empty to skip linking stories to epics',
    )
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--sleep", type=float, default=0.25, help="Seconds between API calls")
    ap.add_argument("--epic-type", default="Epic", help="Issue type name for epics")
    ap.add_argument("--story-type", default="Story", help="Issue type name for stories")
    ap.add_argument(
        "--subtask-type",
        default="Subtask",
        help="Issue type name for subtasks (AV4 uses 'Subtask', not 'Sub-task')",
    )
    ap.add_argument(
        "--credentials-md",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "credentials.md",
        help="Load JIRA_* from this file (table + export lines). Use --no-credentials-md to skip.",
    )
    ap.add_argument(
        "--no-credentials-md",
        action="store_true",
        help="Do not read credentials.md",
    )
    args = ap.parse_args()

    if not args.no_credentials_md and args.credentials_md:
        apply_credentials_md(args.credentials_md)

    project_key = args.project_key or os.environ.get("JIRA_PROJECT_KEY", "AV4")
    epic_link_field = args.epic_link_field or None

    seed = load_seed(args.seed)
    epics = seed.get("epics", [])
    if not isinstance(epics, list) or not epics:
        raise SystemExit("backlog_seed.json: missing epics[]")

    if args.dry_run:
        total_stories = sum(len(e.get("children", []) or []) for e in epics)
        total_subs = 0
        for e in epics:
            for s in e.get("children", []) or []:
                total_subs += len(s.get("children", []) or [])
        print(f"[dry-run] Project={project_key} epics={len(epics)} stories≈{total_stories} subtasks≈{total_subs}")
        for e in epics:
            sc = len(e.get("children", []))
            print(f"  Epic: {e.get('summary')} ({sc} stories)")
        return

    base = env("JIRA_BASE_URL", "https://aurigraphdlt.atlassian.net")
    email = env("JIRA_USER_EMAIL")
    if not os.environ.get("JIRA_API_TOKEN"):
        raise SystemExit(
            "JIRA_API_TOKEN is missing or empty. Add your Atlassian API token to credentials.md:\n"
            "  - Table row | API token | <token> |  or\n"
            "  - export JIRA_API_TOKEN=\"<token>\"\n"
            "Create a token: https://id.atlassian.com/manage-profile/security/api-tokens"
        )
    token = env("JIRA_API_TOKEN")
    client = JiraClient(base, email, token)

    created = 0
    for epic in epics:
        e_summary = str(epic.get("summary", "Epic")).strip()
        e_desc = str(epic.get("description", "")).strip() or e_summary
        epic_key = create_issue(
            client,
            project_key=project_key,
            summary=e_summary,
            description=e_desc,
            issue_type=args.epic_type,
            parent_key=None,
            epic_link_field=None,
            epic_key=None,
        )
        created += 1
        print(f"Created epic {epic_key}: {e_summary}")
        time.sleep(args.sleep)

        for story in epic.get("children", []) or []:
            s_summary = str(story.get("summary", "Story")).strip()
            s_desc = str(story.get("description", "")).strip() or s_summary
            story_key = create_issue(
                client,
                project_key=project_key,
                summary=s_summary,
                description=s_desc,
                issue_type=args.story_type,
                parent_key=None if epic_link_field else epic_key,
                epic_link_field=epic_link_field,
                epic_key=epic_key if epic_link_field else None,
            )
            created += 1
            print(f"  Story {story_key}: {s_summary}")
            time.sleep(args.sleep)

            for sub in story.get("children", []) or []:
                st_summary = str(sub.get("summary", "Sub-task")).strip()
                st_desc = str(sub.get("description", "")).strip() or st_summary
                sub_key = create_issue(
                    client,
                    project_key=project_key,
                    summary=st_summary,
                    description=st_desc,
                    issue_type=args.subtask_type,
                    parent_key=story_key,
                    epic_link_field=None,
                    epic_key=None,
                )
                created += 1
                print(f"    Sub-task {sub_key}: {st_summary}")
                time.sleep(args.sleep)

    print(f"Done. Created {created} issues on {project_key}.")


if __name__ == "__main__":
    main()
