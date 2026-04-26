#!/usr/bin/env python3
"""
Create the AV4 regulatory gap epic + 8 child stories from regulatory_gap_2026_seed.json.

  python3 scripts/jira/seed_regulatory_gaps_2026.py --dry-run
  python3 scripts/jira/seed_regulatory_gaps_2026.py

Uses the same Jira env + credentials.md behavior as seed_backlog.py.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED = Path(__file__).resolve().parent / "regulatory_gap_2026_seed.json"


def main() -> None:
    backfill = Path(__file__).resolve().parent / "seed_backlog.py"
    args = [sys.executable, str(backfill), "--seed", str(SEED), *sys.argv[1:]]
    os.chdir(ROOT)
    raise SystemExit(subprocess.call(args))


if __name__ == "__main__":
    main()
