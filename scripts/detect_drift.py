#!/usr/bin/env python3
"""Framework drift checks: optional planning catalog + workflow heuristics.

Does not parse or assume any PRD layout. If planning wants machine-checkable
traceability from PRD → plan → tasks, maintain a small JSON catalog (see
`scripts/templates/requirements_catalog.json`). Otherwise requirement coverage
is skipped and assumptions/risks stay in planning handoffs as prose.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def load_catalog(path: Path) -> list[tuple[str, str]]:
    raw: Any = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, dict) and "items" in raw:
        raw = raw["items"]
    if not isinstance(raw, list):
        return []
    out: list[tuple[str, str]] = []
    for i, item in enumerate(raw, start=1):
        if not isinstance(item, dict):
            continue
        label = str(item.get("label") or item.get("title") or "").strip()
        if not label:
            continue
        rid = str(item.get("id") or "").strip() or f"ITEM-{i}"
        out.append((rid, label))
    return out


def contains_any(text: str, terms: list[str]) -> bool:
    lower = text.lower()
    return any(t.lower() in lower for t in terms if t)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Drift checks: optional requirements catalog vs plan/tasks; workflow heuristics"
    )
    parser.add_argument(
        "--catalog",
        default="workflow/requirements_catalog.json",
        help="Optional JSON list of {id?, label} for coverage checks (default path if file exists)",
    )
    parser.add_argument("--plan", default="docs/PLAN.md")
    parser.add_argument("--state", default="workflow/state.json")
    parser.add_argument("--out", default="workflow/drift_report.json")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Return exit code 1 when catalog-backed requirement coverage gaps exist",
    )
    args = parser.parse_args()

    root = Path.cwd()
    catalog_path = root / args.catalog
    plan_path = root / args.plan
    state_path = root / args.state
    out_path = root / args.out

    if not state_path.exists():
        print("DRIFT_FAIL: missing state file")
        return 1

    state = json.loads(state_path.read_text(encoding="utf-8"))
    plan_text = plan_path.read_text(encoding="utf-8") if plan_path.exists() else ""

    tasks = state.get("tasks", [])
    task_titles = " ".join(str(t.get("title", "")) for t in tasks if isinstance(t, dict))
    stories_text = ""
    for it in state.get("iterations", []):
        if not isinstance(it, dict):
            continue
        for s in it.get("stories", []) or []:
            if isinstance(s, dict):
                stories_text += " " + str(s.get("story", "")) + " " + str(s.get("acceptance", ""))

    backlog_no_story = []
    for t in tasks:
        if not isinstance(t, dict):
            continue
        if str(t.get("status")) == "backlog" and "US-" not in str(t.get("title", "")):
            backlog_no_story.append(
                {"id": t.get("id"), "title": t.get("title"), "agent": t.get("agent")}
            )

    requirement_coverage: dict[str, Any]
    missing_in_plan: list[dict[str, str]] = []
    missing_in_tasks: list[dict[str, str]] = []

    if catalog_path.exists():
        requirements = load_catalog(catalog_path)
        for req_id, label in requirements:
            probe_terms = [label]
            if not contains_any(plan_text, probe_terms):
                missing_in_plan.append({"id": req_id, "label": label})
            if not contains_any(task_titles + " " + stories_text, probe_terms):
                missing_in_tasks.append({"id": req_id, "label": label})
        requirement_coverage = {
            "status": "active",
            "catalogPath": str(catalog_path.relative_to(root)),
            "itemCount": len(requirements),
        }
    else:
        requirement_coverage = {
            "status": "skipped",
            "reason": "No catalog file; planning owns assumptions/risks in handoffs. "
            "Add workflow/requirements_catalog.json (optional) for automated coverage checks.",
        }

    report = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "requirementCoverage": requirement_coverage,
        "artifacts": {
            "planExists": plan_path.exists(),
            "planNonEmpty": bool(plan_text.strip()),
        },
        "summary": {
            "missingInPlan": len(missing_in_plan),
            "missingInTasksOrStories": len(missing_in_tasks),
            "backlogTasksWithoutStoryTrace": len(backlog_no_story),
        },
        "missingInPlan": missing_in_plan,
        "missingInTasksOrStories": missing_in_tasks,
        "backlogTasksWithoutStoryTrace": backlog_no_story,
        "notes": [
            "Framework-agnostic: PRD is not parsed. Optional catalog drives requirement overlap checks.",
            "Assumptions and risks should appear in planning handoffs (docs/handoffs/planning/).",
        ],
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print(f"DRIFT_REPORT: {out_path}")

    if backlog_no_story:
        print("DRIFT_WARN: backlog tasks without US- trace in title.")
        return 1 if args.strict else 2

    if requirement_coverage.get("status") == "active":
        if missing_in_plan or missing_in_tasks:
            print("DRIFT_WARN: potential catalog coverage gaps (plan or tasks/stories).")
            return 1 if args.strict else 2

    print("DRIFT_OK.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
