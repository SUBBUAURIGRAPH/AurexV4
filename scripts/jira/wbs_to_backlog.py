#!/usr/bin/env python3
"""
Parse docs/WBS_AUREXV4_GREENFIELD.md tables into scripts/jira/backlog_seed.json.

Hierarchy in JSON:
  Epic
    └── Story | Task (both become Jira Stories with Epic Link; summary prefixed with WBS)
          └── Sub-task rows under that Story/Task container

Tasks and Subtasks in the WBS attach to the most recent Story/Task container in the same epic.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


def parse_table_rows(lines: list[str]) -> list[tuple[str, str, str, str]]:
    rows: list[tuple[str, str, str, str]] = []
    for line in lines:
        line = line.strip()
        if not line.startswith("|"):
            continue
        if re.match(r"^\|\s*---", line):
            continue
        parts = [p.strip() for p in line.strip("|").split("|")]
        if len(parts) < 4:
            continue
        wbs, typ, name, notes = parts[0], parts[1], parts[2], parts[3]
        if wbs.lower() == "wbs" or typ.lower() == "type":
            continue
        rows.append((wbs, typ, name, notes))
    return rows


def section_title(header: str) -> tuple[int, str]:
    m = re.match(r"^##\s+(\d+)\.\s+(.+)$", header.strip())
    if not m:
        return (-1, header.strip())
    return int(m.group(1)), m.group(2).strip()


def build_epics(wbs_path: Path) -> list[dict[str, Any]]:
    text = wbs_path.read_text(encoding="utf-8")
    blocks = re.split(r"\n(?=##\s+\d+\.)", text)
    epics_out: list[dict[str, Any]] = []

    for block in blocks:
        lines = block.splitlines()
        if not lines:
            continue
        sec_num, sec_title = section_title(lines[0])
        if sec_num < 0:
            continue
        if sec_num >= 14:
            break

        table_lines: list[str] = []
        in_table = False
        for ln in lines[1:]:
            if ln.strip().startswith("| WBS |"):
                in_table = True
            if in_table:
                if ln.strip().startswith("|") and "wbs" not in ln.lower():
                    table_lines.append(ln)
                elif in_table and ln.strip() and not ln.strip().startswith("|"):
                    break

        rows = parse_table_rows(table_lines)
        if not rows:
            continue

        cur_epic: dict[str, Any] | None = None
        container: dict[str, Any] | None = None

        def ensure_epic_for_story() -> dict[str, Any]:
            nonlocal cur_epic
            if cur_epic is None:
                cur_epic = {
                    "summary": f"[WBS {sec_num}] {sec_title}",
                    "description": f"Synthetic epic for section {sec_num} of WBS (no explicit Epic row before first Story).",
                    "children": [],
                }
                epics_out.append(cur_epic)
            return cur_epic

        for wbs, typ, name, notes in rows:
            t = typ.strip().lower()
            desc = f"**WBS:** {wbs}\n\n{notes}".strip()

            if t == "epic":
                cur_epic = {"summary": f"[{wbs}] {name}", "description": desc, "children": []}
                epics_out.append(cur_epic)
                container = None
                continue

            epic = ensure_epic_for_story()

            if t == "story":
                node: dict[str, Any] = {
                    "summary": f"[{wbs}] {name}",
                    "description": desc,
                    "children": [],
                }
                epic["children"].append(node)
                container = node
                continue

            if t == "task":
                node = {
                    "summary": f"[{wbs}] {name}",
                    "description": desc,
                    "children": [],
                }
                epic["children"].append(node)
                container = node
                continue

            if t == "subtask":
                leaf = {"summary": f"[{wbs}] {name}", "description": desc}
                if container is None:
                    orphan: dict[str, Any] = {
                        "summary": f"[{wbs}] {name}",
                        "description": desc,
                        "children": [],
                    }
                    epic["children"].append(orphan)
                    container = orphan
                else:
                    container.setdefault("children", []).append(leaf)
                continue

    for epic in epics_out:
        if not epic.get("children"):
            epic["children"] = [
                {
                    "summary": "[Planning] Decompose epic into stories",
                    "description": "The WBS table had no child rows under this epic; split during backlog refinement.",
                    "children": [],
                }
            ]

    return epics_out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--wbs",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "docs" / "WBS_AUREXV4_GREENFIELD.md",
    )
    ap.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parent / "backlog_seed.json",
    )
    args = ap.parse_args()

    epics = build_epics(args.wbs)
    doc = {
        "description": "Generated from WBS_AUREXV4_GREENFIELD.md by wbs_to_backlog.py — regenerate after WBS edits.",
        "epics": epics,
    }
    args.out.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    n_epics = len(epics)
    n_st = sum(len(e.get("children", []) or []) for e in epics)
    n_sub = 0
    for e in epics:
        for s in e.get("children", []) or []:
            n_sub += len(s.get("children", []) or [])
    print(f"Wrote {args.out}  epics={n_epics}  stories/tasks={n_st}  subtasks={n_sub}")


if __name__ == "__main__":
    main()
