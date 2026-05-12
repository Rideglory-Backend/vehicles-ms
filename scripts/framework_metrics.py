#!/usr/bin/env python3
"""Build operational metrics for the solo-mode framework dashboard."""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PHASE_ORDER = [
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
]

PHASE_TO_ROLE = {
    "po_scope": "po",
    "architect": "architect",
    "design": "design",
    "backend": "backend",
    "frontend": "frontend",
    "qa": "qa",
    "devops": "devops",
    "pr": "system",
    "tech_lead": "tech_lead",
    "po_close": "po",
}


def parse_ts(value: str | None) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def minutes_between(start: datetime | None, end: datetime | None) -> float | None:
    if not start or not end:
        return None
    delta = (end - start).total_seconds() / 60.0
    if delta < 0:
        return None
    return round(delta, 2)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def phase_contract(repo_root: Path, iteration: int, phase: str) -> dict[str, Any] | None:
    path = repo_root / "docs" / "handoffs" / "contracts" / f"iter-{iteration}" / f"{phase}.json"
    if not path.exists():
        return None
    try:
        return read_json(path)
    except Exception:
        return None


def build_metrics(repo_root: Path, state: dict[str, Any]) -> dict[str, Any]:
    events = state.get("events", [])
    phase_complete_by_iter: dict[int, dict[str, dict[str, Any]]] = defaultdict(dict)
    iteration_start_by_iter: dict[int, datetime] = {}
    retries_by_role: Counter[str] = Counter()
    failures_by_role: Counter[str] = Counter()
    block_causes: Counter[str] = Counter()

    for event in events:
        et = str(event.get("type", ""))
        role = str(event.get("agent") or "unknown")
        detail = str(event.get("detail") or "")
        if et == "iteration_started" and isinstance(event.get("iteration"), int):
            ts = parse_ts(event.get("at"))
            if ts:
                iteration_start_by_iter[event["iteration"]] = ts
        if et == "phase_complete" and isinstance(event.get("iteration"), int):
            it = event["iteration"]
            phase = str(event.get("phase") or "")
            if phase:
                phase_complete_by_iter[it][phase] = event
        lower_detail = detail.lower()
        if "retry" in et.lower() or "retry" in lower_detail:
            retries_by_role[role] += 1
        if "fail" in et.lower() or "error" in et.lower() or "failed" in lower_detail:
            failures_by_role[role] += 1
        if "block" in et.lower() or "blocked" in lower_detail:
            cause = detail.strip() or "unspecified blocked event"
            block_causes[cause] += 1

    phase_duration: dict[str, list[float]] = defaultdict(list)
    per_iteration: list[dict[str, Any]] = []
    per_phase_cost = defaultdict(lambda: {"tokens": 0, "costUsd": 0.0, "samples": 0})

    iterations = state.get("iterations", [])
    for row in iterations:
        if not isinstance(row, dict):
            continue
        it = row.get("id")
        if not isinstance(it, int) or it <= 0:
            continue
        phase_data = phase_complete_by_iter.get(it, {})
        iter_item: dict[str, Any] = {
            "iteration": it,
            "status": row.get("status"),
            "phaseDurationsMinutes": {},
            "tokenCost": {"tokens": 0, "costUsd": 0.0},
        }
        previous_time = iteration_start_by_iter.get(it)
        for phase in PHASE_ORDER:
            e = phase_data.get(phase)
            end_t = parse_ts(e.get("at")) if e else None
            duration = minutes_between(previous_time, end_t)
            if duration is not None:
                iter_item["phaseDurationsMinutes"][phase] = duration
                phase_duration[phase].append(duration)
            if end_t:
                previous_time = end_t

            contract = phase_contract(repo_root, it, phase)
            if contract:
                metrics = contract.get("metrics", {})
                tokens = int(metrics.get("tokens", 0) or 0)
                cost = float(metrics.get("costUsd", 0.0) or 0.0)
                iter_item["tokenCost"]["tokens"] += tokens
                iter_item["tokenCost"]["costUsd"] = round(
                    iter_item["tokenCost"]["costUsd"] + cost, 4
                )
                per_phase_cost[phase]["tokens"] += tokens
                per_phase_cost[phase]["costUsd"] += cost
                per_phase_cost[phase]["samples"] += 1

        per_iteration.append(iter_item)

    phase_duration_summary: dict[str, dict[str, float]] = {}
    for phase, values in phase_duration.items():
        if not values:
            continue
        phase_duration_summary[phase] = {
            "avgMinutes": round(sum(values) / len(values), 2),
            "maxMinutes": round(max(values), 2),
            "samples": len(values),
        }

    retries = [
        {"role": role, "count": count}
        for role, count in retries_by_role.most_common()
        if role and count > 0
    ]
    failures = [
        {"role": role, "count": count}
        for role, count in failures_by_role.most_common()
        if role and count > 0
    ]
    top_blocks = [{"cause": cause, "count": count} for cause, count in block_causes.most_common(8)]

    per_phase = {}
    for phase, agg in per_phase_cost.items():
        per_phase[phase] = {
            "tokens": int(agg["tokens"]),
            "costUsd": round(float(agg["costUsd"]), 4),
            "samples": int(agg["samples"]),
            "role": PHASE_TO_ROLE.get(phase, "unknown"),
        }

    total_tokens = sum(item["tokenCost"]["tokens"] for item in per_iteration)
    total_cost = round(sum(item["tokenCost"]["costUsd"] for item in per_iteration), 4)

    return {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "currentIteration": state.get("currentIteration"),
        "phaseDurationMinutes": phase_duration_summary,
        "retriesByRole": retries,
        "failuresByRole": failures,
        "tokenCost": {
            "totalTokens": int(total_tokens),
            "totalCostUsd": total_cost,
            "byPhase": per_phase,
            "byIteration": per_iteration,
        },
        "topBlockCauses": top_blocks,
        "notes": [
            "Token and cost metrics require `metrics.tokens` and `metrics.costUsd` in phase contracts.",
            "Retries/failures/blocked causes are inferred from workflow events.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build workflow/framework_metrics.json")
    parser.add_argument("--state", default="workflow/state.json", help="Path to workflow state JSON")
    parser.add_argument(
        "--out", default="workflow/framework_metrics.json", help="Output metrics JSON path"
    )
    args = parser.parse_args()

    repo_root = Path.cwd()
    state_path = repo_root / args.state
    out_path = repo_root / args.out

    if not state_path.exists():
        print(f"ERROR: missing state file: {state_path}")
        return 1

    state = read_json(state_path)
    metrics = build_metrics(repo_root, state)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    print(f"WROTE: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
