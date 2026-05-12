#!/usr/bin/env python3
"""Strict validator for workflow/state.json."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ALLOWED_PLAN_STATUS = {"not_started", "awaiting_approval", "approved"}
ALLOWED_ITER_STATUS = {"planned", "active", "done", "blocked"}
ALLOWED_AGENT_STATUS = {"idle", "active", "blocked", "done"}
ALLOWED_TASK_STATUS = {"backlog", "in_progress", "done", "cancelled"}
ALLOWED_PHASES = {
    "po_scope",
    "architect",
    "design",
    "backend",
    "frontend",
    "qa",
    "devops",
    "pr",
    "tech_lead",
    "po_close",
}
ISO_Z_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


def _err(errors: list[str], msg: str) -> None:
    errors.append(msg)


def _is_iso_z(value: object) -> bool:
    return isinstance(value, str) and bool(ISO_Z_RE.match(value))


def validate_state(state: dict) -> list[str]:
    errors: list[str] = []

    for key in ("project", "prdPath", "currentIteration", "agents", "tasks", "events"):
        if key not in state:
            _err(errors, f"Missing required root key: {key}")

    if errors:
        return errors

    if not isinstance(state["project"], str) or not state["project"].strip():
        _err(errors, "project must be non-empty string")
    if not isinstance(state["prdPath"], str) or not state["prdPath"].strip():
        _err(errors, "prdPath must be non-empty string")

    plan_status = state.get("planStatus")
    if plan_status is not None and plan_status not in ALLOWED_PLAN_STATUS:
        _err(errors, f"planStatus must be one of {sorted(ALLOWED_PLAN_STATUS)}")

    if not isinstance(state["currentIteration"], int) or state["currentIteration"] < 0:
        _err(errors, "currentIteration must be integer >= 0")

    iterations = state.get("iterations", [])
    if not isinstance(iterations, list):
        _err(errors, "iterations must be an array")
        iterations = []

    iteration_ids: set[int] = set()
    for idx, it in enumerate(iterations):
        if not isinstance(it, dict):
            _err(errors, f"iterations[{idx}] must be object")
            continue
        for key in ("id", "goal", "status"):
            if key not in it:
                _err(errors, f"iterations[{idx}] missing {key}")
        it_id = it.get("id")
        if not isinstance(it_id, int):
            _err(errors, f"iterations[{idx}].id must be integer")
        else:
            if it_id in iteration_ids:
                _err(errors, f"Duplicate iteration id: {it_id}")
            iteration_ids.add(it_id)
        if not isinstance(it.get("goal"), str) or not str(it.get("goal")).strip():
            _err(errors, f"iterations[{idx}].goal must be non-empty string")
        if it.get("status") not in ALLOWED_ITER_STATUS:
            _err(errors, f"iterations[{idx}].status invalid: {it.get('status')}")

    if state["currentIteration"] not in iteration_ids:
        _err(
            errors,
            "currentIteration must exist in iterations[].id "
            f"(currentIteration={state['currentIteration']})",
        )

    agents = state["agents"]
    if not isinstance(agents, dict) or not agents:
        _err(errors, "agents must be a non-empty object")
    else:
        for name, payload in agents.items():
            if not isinstance(payload, dict):
                _err(errors, f"agents.{name} must be object")
                continue
            status = payload.get("status")
            if status not in ALLOWED_AGENT_STATUS:
                _err(errors, f"agents.{name}.status invalid: {status}")

    tasks = state["tasks"]
    if not isinstance(tasks, list):
        _err(errors, "tasks must be an array")
    else:
        task_ids: set[str] = set()
        for idx, task in enumerate(tasks):
            if not isinstance(task, dict):
                _err(errors, f"tasks[{idx}] must be object")
                continue
            for key in ("id", "title", "agent", "status", "iteration"):
                if key not in task:
                    _err(errors, f"tasks[{idx}] missing {key}")
            task_id = task.get("id")
            if not isinstance(task_id, str) or not task_id.strip():
                _err(errors, f"tasks[{idx}].id must be non-empty string")
            elif task_id in task_ids:
                _err(errors, f"Duplicate task id: {task_id}")
            else:
                task_ids.add(task_id)
            if task.get("status") not in ALLOWED_TASK_STATUS:
                _err(errors, f"tasks[{idx}].status invalid: {task.get('status')}")
            if not isinstance(task.get("iteration"), int):
                _err(errors, f"tasks[{idx}].iteration must be integer")
            elif task["iteration"] not in iteration_ids:
                _err(errors, f"tasks[{idx}].iteration references unknown iteration")
            updated_at = task.get("updatedAt")
            if updated_at is not None and not _is_iso_z(updated_at):
                _err(errors, f"tasks[{idx}].updatedAt must be ISO UTC Z format")

    events = state["events"]
    if not isinstance(events, list):
        _err(errors, "events must be an array")
    else:
        for idx, event in enumerate(events):
            if not isinstance(event, dict):
                _err(errors, f"events[{idx}] must be object")
                continue
            for key in ("at", "type", "detail"):
                if key not in event:
                    _err(errors, f"events[{idx}] missing {key}")
            if not _is_iso_z(event.get("at")):
                _err(errors, f"events[{idx}].at must be ISO UTC Z format")
            if not isinstance(event.get("type"), str) or not event.get("type").strip():
                _err(errors, f"events[{idx}].type must be non-empty string")
            if not isinstance(event.get("detail"), str) or not event.get("detail").strip():
                _err(errors, f"events[{idx}].detail must be non-empty string")
            phase = event.get("phase")
            if phase is not None and phase not in ALLOWED_PHASES:
                _err(errors, f"events[{idx}].phase invalid: {phase}")
            it = event.get("iteration")
            if it is not None and (not isinstance(it, int) or it not in iteration_ids):
                _err(errors, f"events[{idx}].iteration references unknown iteration")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate workflow/state.json")
    parser.add_argument(
        "--state",
        default="workflow/state.json",
        help="Path to workflow state file (default: workflow/state.json)",
    )
    args = parser.parse_args()

    path = Path(args.state)
    if not path.exists():
        print(f"ERROR: state file not found: {path}")
        return 1

    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"ERROR: invalid JSON in {path}: {exc}")
        return 1

    errors = validate_state(state)
    if errors:
        print(f"INVALID: {path}")
        for item in errors:
            print(f"- {item}")
        return 1

    print(f"VALID: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
