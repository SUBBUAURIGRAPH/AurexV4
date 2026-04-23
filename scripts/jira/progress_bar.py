#!/usr/bin/env python3
from __future__ import annotations

import base64
import importlib.util
import json
import os
import ssl
import urllib.parse
import urllib.request
from pathlib import Path


def bar(done: int, total: int, width: int = 20) -> str:
    if total <= 0:
        return "[" + ("░" * width) + "] 0%"
    pct = done / total
    filled = int(round(width * pct))
    return "[" + ("█" * filled) + ("░" * (width - filled)) + f"] {int(round(pct * 100))}%"


def main() -> None:
    spec = importlib.util.spec_from_file_location("seed", "scripts/jira/seed_backlog.py")
    if spec is None or spec.loader is None:
        raise SystemExit("Cannot load scripts/jira/seed_backlog.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.apply_credentials_md(Path("credentials.md"))

    base = os.environ["JIRA_BASE_URL"].rstrip("/")
    email = os.environ["JIRA_USER_EMAIL"]
    token = os.environ["JIRA_API_TOKEN"]
    auth = base64.b64encode(f"{email}:{token}".encode()).decode()
    ctx = ssl.create_default_context()

    jql = "project = AV4 AND key >= AV4-6 AND key <= AV4-123 AND issuetype in (Story, Task, Feature)"
    url = f"{base}/rest/api/3/search/jql?maxResults=100&fields=status,labels&jql={urllib.parse.quote(jql)}"
    req = urllib.request.Request(url)
    req.add_header("Authorization", "Basic " + auth)
    with urllib.request.urlopen(req, context=ctx, timeout=60) as r:
        data = json.load(r)
    issues = data.get("issues", [])

    total = len(issues)
    in_progress = sum(1 for i in issues if (i.get("fields", {}).get("status") or {}).get("name") == "In Progress")
    remaining = total - in_progress

    print("## ADM Execution Progress")
    print()
    print(f"`Overall (active execution):`")
    print(f"`{bar(in_progress, total)}`  ({in_progress} / {total} in progress)")
    print()
    print(f"`Remaining (to start):`")
    print(f"`{bar(remaining, total)}`  ({remaining} / {total} to do)")
    print()
    print("`AAT lane balance:`")
    for n in range(1, 7):
        lane = f"AAT-{n}"
        lane_total = 0
        lane_active = 0
        for i in issues:
            labels = set(i.get("fields", {}).get("labels") or [])
            if lane not in labels:
                continue
            lane_total += 1
            if (i.get("fields", {}).get("status") or {}).get("name") == "In Progress":
                lane_active += 1
        print(f"`{lane} {bar(lane_active, lane_total, 10)} {lane_active}/{lane_total} active`")


if __name__ == "__main__":
    main()
