#!/usr/bin/env python3
"""Hard gate for iteration phase completion."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from validate_workflow_state import validate_state

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

REQUIRED_HANDOFFS = {
    "po_scope": ["docs/handoffs/po.md"],
    "architect": [
        "docs/handoffs/architect.md",
        "docs/handoffs/architect-for-backend.md",
        "docs/handoffs/architect-for-frontend.md",
        "docs/handoffs/architect-for-devops.md",
        "docs/handoffs/architect-for-qa.md",
        "docs/architecture/DIAGRAMS.md",
    ],
    "design": ["docs/handoffs/design.md"],
    "backend": ["docs/handoffs/backend.md"],
    "frontend": ["docs/handoffs/frontend.md"],
    "qa": ["docs/handoffs/qa.md"],
    "devops": ["docs/handoffs/devops.md", "docs/DEPLOY.md"],
    "pr": ["docs/PULL_REQUEST_BODY_ITER_{iteration}.md"],
    "tech_lead": ["docs/handoffs/tech_lead.md"],
    "po_close": [
        "docs/ITERATION_SUMMARY_{iteration}.md",
        "docs/PRODUCT_STATUS.md",
        "docs/ITERATION_HISTORY.md",
        "docs/handoffs/iteration_context.md",
    ],
}

REQUIRED_QUALITY_GATES = {
    "po_scope": {"required_artifacts_present", "scope_defined"},
    "architect": {"required_artifacts_present", "architecture_contracts_defined"},
    "design": {"required_artifacts_present", "design_coverage_complete"},
    "backend": {"required_artifacts_present", "tests_passed_or_accepted", "security_checks"},
    "frontend": {"required_artifacts_present", "tests_passed_or_accepted"},
    "qa": {"required_artifacts_present", "tests_passed_or_accepted"},
    "devops": {"required_artifacts_present", "ci_checks_passed_or_accepted", "security_checks"},
    "pr": {"required_artifacts_present", "pr_opened"},
    "tech_lead": {"required_artifacts_present", "review_completed", "security_checks"},
    "po_close": {"required_artifacts_present", "iteration_docs_published"},
}


def _read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _phase_contract_path(repo_root: Path, iteration: int, phase: str) -> Path:
    return repo_root / "docs" / "handoffs" / "contracts" / f"iter-{iteration}" / f"{phase}.json"


def _render_required_paths(iteration: int, phase: str) -> list[str]:
    return [p.format(iteration=iteration) for p in REQUIRED_HANDOFFS.get(phase, [])]


def _phase_completed(events: list[dict], iteration: int, phase: str) -> bool:
    for event in reversed(events):
        if (
            event.get("type") == "phase_complete"
            and event.get("iteration") == iteration
            and event.get("phase") == phase
        ):
            return True
    return False


def _compute_completion_score(events: list[dict], iteration: int) -> int:
    done = set()
    for event in events:
        if event.get("type") == "phase_complete" and event.get("iteration") == iteration:
            phase = event.get("phase")
            if phase in PHASE_ORDER:
                done.add(phase)
    return int(round((len(done) / len(PHASE_ORDER)) * 100, 0))


def _validate_contract(contract: dict, iteration: int, phase: str) -> list[str]:
    errors: list[str] = []
    required = {"iteration", "phase", "status", "updatedAt", "metrics", "artifacts", "qualityGates"}
    missing = required - set(contract.keys())
    if missing:
        errors.append(f"Contract missing keys: {sorted(missing)}")
        return errors
    if contract.get("iteration") != iteration:
        errors.append("Contract iteration does not match requested iteration")
    if contract.get("phase") != phase:
        errors.append("Contract phase does not match requested phase")
    if contract.get("status") not in {"pass", "fail"}:
        errors.append("Contract status must be pass|fail")
    metrics = contract.get("metrics")
    if not isinstance(metrics, dict):
        errors.append("Contract metrics must be an object")
    else:
        tokens = metrics.get("tokens")
        cost = metrics.get("costUsd")
        if not isinstance(tokens, int) or tokens < 0:
            errors.append("metrics.tokens must be integer >= 0")
        if not isinstance(cost, (int, float)) or cost < 0:
            errors.append("metrics.costUsd must be number >= 0")
    if not isinstance(contract.get("artifacts"), list) or not contract["artifacts"]:
        errors.append("Contract artifacts must be a non-empty list")
    if not isinstance(contract.get("qualityGates"), list) or not contract["qualityGates"]:
        errors.append("Contract qualityGates must be a non-empty list")
        return errors

    gate_names: set[str] = set()
    for idx, gate in enumerate(contract["qualityGates"]):
        if not isinstance(gate, dict):
            errors.append(f"qualityGates[{idx}] must be object")
            continue
        name = gate.get("name")
        status = gate.get("status")
        if not isinstance(name, str) or not name.strip():
            errors.append(f"qualityGates[{idx}].name must be non-empty string")
            continue
        gate_names.add(name)
        if status not in {"pass", "fail", "warn"}:
            errors.append(
                f"qualityGates[{idx}].status invalid: {status} (expected pass|fail|warn)"
            )

    expected = REQUIRED_QUALITY_GATES.get(phase, set())
    missing_required = sorted(expected - gate_names)
    if missing_required:
        errors.append(
            "Missing required quality gate names for phase "
            f"{phase}: {missing_required}"
        )

    failing_required: list[str] = []
    gate_status_by_name = {
        gate.get("name"): gate.get("status")
        for gate in contract["qualityGates"]
        if isinstance(gate, dict)
    }
    for name in expected:
        if gate_status_by_name.get(name) != "pass":
            failing_required.append(name)
    if failing_required:
        errors.append(
            "Required quality gates must be status=pass for phase "
            f"{phase}: {sorted(failing_required)}"
        )
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate hard gates for a phase")
    parser.add_argument("--iteration", required=True, type=int, help="Iteration number")
    parser.add_argument("--phase", required=True, choices=PHASE_ORDER, help="Phase key")
    parser.add_argument(
        "--state",
        default="workflow/state.json",
        help="State path (default: workflow/state.json)",
    )
    args = parser.parse_args()

    repo_root = Path.cwd()
    state_path = repo_root / args.state
    if not state_path.exists():
        print(f"GATE_FAIL: state file missing: {state_path}")
        return 1

    state = _read_json(state_path)
    state_errors = validate_state(state)
    if state_errors:
        print("GATE_FAIL: workflow/state.json is invalid")
        for err in state_errors:
            print(f"- {err}")
        return 1

    phase_complete_ok = _phase_completed(state.get("events", []), args.iteration, args.phase)
    if not phase_complete_ok:
        print(
            "GATE_FAIL: required phase_complete event missing "
            f"(iteration={args.iteration}, phase={args.phase})"
        )
        return 1

    missing_files: list[str] = []
    for rel in _render_required_paths(args.iteration, args.phase):
        file_path = repo_root / rel
        if not file_path.exists():
            missing_files.append(rel)

    contract_path = _phase_contract_path(repo_root, args.iteration, args.phase)
    if not contract_path.exists():
        missing_files.append(str(contract_path.relative_to(repo_root)))

    if missing_files:
        print("GATE_FAIL: required artifacts missing")
        for rel in missing_files:
            print(f"- {rel}")
        return 1

    contract = _read_json(contract_path)
    contract_errors = _validate_contract(contract, args.iteration, args.phase)
    if contract_errors:
        print("GATE_FAIL: invalid phase contract")
        for err in contract_errors:
            print(f"- {err}")
        return 1

    score = _compute_completion_score(state.get("events", []), args.iteration)
    print(
        "GATE_PASS: "
        f"iteration={args.iteration} phase={args.phase} "
        f"completion_score={score}%"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
