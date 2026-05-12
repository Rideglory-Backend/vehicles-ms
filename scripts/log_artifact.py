#!/usr/bin/env python3
"""Append paths to workflow/artifact_log.json so resumes see what was generated mid-phase."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Log repo-relative paths to workflow/artifact_log.json for resume visibility"
    )
    parser.add_argument("--iteration", type=int, required=True)
    parser.add_argument("--phase", required=True, help="Phase key, e.g. architect, backend")
    parser.add_argument("--agent", required=True, help="Agent role, e.g. architect")
    parser.add_argument(
        "--path",
        action="append",
        dest="paths",
        default=[],
        help="Repo-relative path (repeatable)",
    )
    parser.add_argument(
        "--action",
        choices=("create", "update", "delete"),
        default="update",
        help="Default update covers both new and modified files",
    )
    parser.add_argument("--note", default="", help="Optional one-line context")
    parser.add_argument(
        "--file",
        dest="log_file",
        default="workflow/artifact_log.json",
        help="Log file path relative to repo root",
    )
    args = parser.parse_args()

    if not args.paths:
        print("ERROR: pass at least one --path")
        return 1

    root = Path.cwd()
    log_path = root / args.log_file
    log_path.parent.mkdir(parents=True, exist_ok=True)

    if log_path.exists():
        try:
            data = json.loads(log_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = {"version": 1, "entries": []}
    else:
        data = {"version": 1, "entries": []}

    if not isinstance(data.get("entries"), list):
        data["entries"] = []

    normalized = sorted({Path(p).as_posix().lstrip("./") for p in args.paths if p})

    entry: dict = {
        "at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "iteration": args.iteration,
        "phase": args.phase,
        "agent": args.agent,
        "action": args.action,
        "paths": normalized,
    }
    if args.note:
        entry["note"] = args.note

    data["entries"].append(entry)
    data["version"] = 1

    log_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"ARTIFACT_LOG: +{len(normalized)} path(s) -> {log_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
