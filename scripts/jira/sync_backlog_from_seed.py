#!/usr/bin/env python3
"""
Update existing Jira issues to match backlog_seed.json summaries + descriptions.

Matching: summaries are aligned on the **WBS bracket header** — the substring from
the first `[` through the first `]` (e.g. `[11.1.1]`). This avoids JQL substring
false positives (`[0.1]` vs `[10.1]`). All project issues are loaded once (paginated)
and matched client-side.

Does **not** create new issues (use seed_backlog.py once on an empty board for that).

Usage
-----
  python3 scripts/jira/sync_backlog_from_seed.py --dry-run
  python3 scripts/jira/sync_backlog_from_seed.py --apply
  python3 scripts/jira/sync_backlog_from_seed.py --apply --seed scripts/jira/regulatory_gap_2026_seed.json

Uses the same JIRA_* env + credentials.md as seed_backlog.py.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import time
from pathlib import Path
from typing import Any, Iterator

ROOT = Path(__file__).resolve().parents[2]


def _load_seed_backlog_module() -> Any:
    path = Path(__file__).resolve().parent / "seed_backlog.py"
    spec = importlib.util.spec_from_file_location("seed_backlog_mod", path)
    if spec is None or spec.loader is None:
        raise SystemExit("Cannot load seed_backlog.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


sb = _load_seed_backlog_module()
adf_paragraph = sb.adf_paragraph
apply_credentials_md = sb.apply_credentials_md
JiraClient = sb.JiraClient
load_seed = sb.load_seed


def bracket_header(summary: str) -> str:
    """Leading WBS tag only, e.g. '[11.1.1]' — empty string if missing."""
    s = summary.strip()
    if not s.startswith("["):
        return ""
    end = s.find("]")
    if end == -1:
        return ""
    return s[: end + 1]


def iter_seed_items(epics: list[dict[str, Any]]) -> Iterator[tuple[str, str, str]]:
    for epic in epics:
        yield ("Epic", str(epic.get("summary", "")), str(epic.get("description", "") or epic.get("summary", "")))
        for story in epic.get("children") or []:
            yield ("Story", str(story.get("summary", "")), str(story.get("description", "") or story.get("summary", "")))
            for sub in story.get("children") or []:
                yield (
                    "Subtask",
                    str(sub.get("summary", "")),
                    str(sub.get("description", "") or sub.get("summary", "")),
                )


def fetch_all_issues(client: JiraClient, *, project_key: str, page_size: int = 500) -> list[dict[str, Any]]:
    """Paginate POST /rest/api/3/search/jql using nextPageToken (Jira Cloud)."""
    out: list[dict[str, Any]] = []
    jql = f"project = {project_key} ORDER BY key ASC"
    next_token: str | None = None
    while True:
        body: dict[str, Any] = {
            "jql": jql,
            "maxResults": page_size,
            "fields": ["summary", "issuetype"],
        }
        if next_token:
            body["nextPageToken"] = next_token
        data = client.request("POST", "/rest/api/3/search/jql", body)
        batch = list(data.get("issues", []))
        out.extend(batch)
        next_token = data.get("nextPageToken") or None
        if not next_token or not batch:
            break
    return out


def issues_with_header(all_issues: list[dict[str, Any]], header: str) -> list[dict[str, Any]]:
    if not header:
        return []
    return [
        issue
        for issue in all_issues
        if bracket_header(str(issue.get("fields", {}).get("summary") or "")) == header
    ]


def resolve_hits(
    all_issues: list[dict[str, Any]],
    *,
    header: str,
    summary: str,
) -> list[dict[str, Any]]:
    """Match issues by WBS header; disambiguate duplicate headers via summary tail overlap."""
    hits = issues_with_header(all_issues, header)
    if len(hits) <= 1:
        return hits
    want = summary.strip()
    exact = [h for h in hits if str(h.get("fields", {}).get("summary") or "").strip() == want]
    if len(exact) == 1:
        return exact
    if len(exact) > 1:
        return exact
    tail = want.split("]", 1)[-1].strip() if "]" in want else want
    if len(tail) >= 8:
        tail_l = tail.lower()
        narrowed = [
            h
            for h in hits
            if tail_l in str(h.get("fields", {}).get("summary") or "").lower()
        ]
        if len(narrowed) == 1:
            return narrowed
    return hits


def update_issue(
    client: JiraClient,
    issue_key: str,
    *,
    summary: str,
    description: str,
    expected_type: str,
) -> None:
    fields: dict[str, Any] = {
        "summary": summary[:240],
        "description": adf_paragraph(description[:32000]),
    }
    client.request("PUT", f"/rest/api/3/issue/{issue_key}", {"fields": fields})


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", default=str(Path(__file__).parent / "backlog_seed.json"))
    ap.add_argument("--project-key", default=os.environ.get("JIRA_PROJECT_KEY", "AV4"))
    ap.add_argument("--dry-run", action="store_true", help="Search Jira but do not PUT (default if neither flag)")
    ap.add_argument(
        "--apply",
        action="store_true",
        help="Write summary + description to matched issues",
    )
    ap.add_argument(
        "--refresh-descriptions",
        action="store_true",
        help="With --apply, also PUT when only the description changed (summary match)",
    )
    ap.add_argument("--sleep", type=float, default=0.35)
    ap.add_argument(
        "--credentials-md",
        type=Path,
        default=ROOT / "credentials.md",
    )
    ap.add_argument("--no-credentials-md", action="store_true")
    args = ap.parse_args()

    dry_run = args.dry_run or not args.apply

    if not args.no_credentials_md and args.credentials_md.is_file():
        apply_credentials_md(args.credentials_md)

    seed = load_seed(args.seed)
    epics = seed.get("epics", [])
    if not isinstance(epics, list) or not epics:
        raise SystemExit("seed: missing epics[]")

    base = os.environ.get("JIRA_BASE_URL", "https://aurigraphdlt.atlassian.net").rstrip("/")
    email = os.environ.get("JIRA_USER_EMAIL", "")
    token = os.environ.get("JIRA_API_TOKEN", "")
    if not email or not token:
        raise SystemExit(
            "Set JIRA_USER_EMAIL and JIRA_API_TOKEN (or add to credentials.md). "
            "Dry-run still queries Jira to match issues."
        )

    client = JiraClient(base, email, token)

    print(f"[fetch] Loading all issues in project={args.project_key} …", flush=True)
    all_issues = fetch_all_issues(client, project_key=args.project_key)
    print(f"[fetch] {len(all_issues)} issues in cache", flush=True)

    updated = 0
    skipped_multi = 0
    missing = 0
    unchanged = 0

    for issuetype, summary, description in iter_seed_items(epics):
        if not summary.strip():
            continue
        header = bracket_header(summary)
        if not header:
            print(f"[skip] no [WBS] prefix: {summary[:60]}")
            continue

        hits = resolve_hits(all_issues, header=header, summary=summary)

        if len(hits) == 0:
            print(f"[missing] {header} {summary[:70]}")
            missing += 1
            continue
        if len(hits) > 1:
            keys = ", ".join(h["key"] for h in hits)
            print(f"[ambiguous] {header} {len(hits)} issues: {keys} — skip")
            skipped_multi += 1
            continue

        issue = hits[0]
        key = issue["key"]
        fields = issue.get("fields", {})
        cur_summary = str(fields.get("summary") or "")
        itype = ((fields.get("issuetype") or {}).get("name")) or ""
        if issuetype.lower() not in itype.lower() and itype:
            if not (issuetype == "Story" and itype in ("Task", "Story")):
                print(f"[type] {key} expected ~{issuetype}, got {itype} — still updating text")

        summary_match = cur_summary == summary[:240]
        if summary_match and not args.refresh_descriptions:
            unchanged += 1
            continue

        action = "[dry-run]" if dry_run else "[update]"
        if not summary_match:
            print(f"{action} {key}: {cur_summary[:56]} -> {summary[:56]}")
        else:
            print(f"{action} {key}: refresh description only ({header})")

        if not dry_run:
            update_issue(client, key, summary=summary, description=description, expected_type=issuetype)
            updated += 1
            time.sleep(args.sleep)

    print()
    print(
        json.dumps(
            {
                "dry_run": dry_run,
                "seed": args.seed,
                "updated": updated,
                "unchanged": unchanged,
                "missing": missing,
                "ambiguous": skipped_multi,
                "refresh_descriptions": args.refresh_descriptions,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
