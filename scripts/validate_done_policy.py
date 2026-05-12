#!/usr/bin/env python3
"""Validate role definition-of-done policy against handoffs and contracts."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROLE_PHASE = {
    "po": ["po_scope", "po_close"],
    "architect": ["architect"],
    "design": ["design"],
    "backend": ["backend"],
    "frontend": ["frontend"],
    "qa": ["qa"],
    "devops": ["devops"],
    "tech_lead": ["tech_lead"],
}


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate policy-as-code done criteria")
    parser.add_argument("--policy", default="workflow/done-policy.json")
    parser.add_argument("--iteration", type=int, default=None, help="Target iteration; defaults to currentIteration")
    parser.add_argument("--state", default="workflow/state.json")
    args = parser.parse_args()

    root = Path.cwd()
    policy_path = root / args.policy
    state_path = root / args.state
    if not policy_path.exists():
        print(f"POLICY_FAIL: missing policy file: {policy_path}")
        return 1
    if not state_path.exists():
        print(f"POLICY_FAIL: missing state file: {state_path}")
        return 1

    policy = read_json(policy_path)
    state = read_json(state_path)
    iteration = args.iteration if args.iteration is not None else int(state.get("currentIteration", 0))
    if iteration <= 0:
        print("POLICY_WARN: currentIteration <= 0; nothing to validate yet.")
        return 0

    roles = policy.get("roles", {})
    if not isinstance(roles, dict):
        print("POLICY_FAIL: roles object missing in policy file")
        return 1

    issues: list[str] = []
    for role, cfg in roles.items():
        handoff_rel = cfg.get("requiredHandoff")
        if handoff_rel:
            handoff_path = root / handoff_rel
            if not handoff_path.exists():
                issues.append(f"{role}: missing required handoff `{handoff_rel}`")
            else:
                content = handoff_path.read_text(encoding="utf-8")
                for heading in cfg.get("requiredHeadings", []):
                    if heading not in content:
                        issues.append(f"{role}: handoff missing heading `{heading}`")
        for rel in cfg.get("requiredArtifacts", []):
            if not (root / rel).exists():
                issues.append(f"{role}: missing required artifact `{rel}`")

        required_contracts = cfg.get("requiredPhaseContracts") or ROLE_PHASE.get(role, [])
        for phase in required_contracts:
            contract_path = root / "docs" / "handoffs" / "contracts" / f"iter-{iteration}" / f"{phase}.json"
            if not contract_path.exists():
                issues.append(f"{role}: missing contract `{contract_path.relative_to(root)}`")
                continue
            try:
                contract = read_json(contract_path)
            except Exception:
                issues.append(f"{role}: unreadable contract `{contract_path.relative_to(root)}`")
                continue
            if contract.get("status") != "pass":
                issues.append(
                    f"{role}: contract `{contract_path.relative_to(root)}` status != pass"
                )

    if issues:
        print("POLICY_FAIL")
        for issue in issues:
            print(f"- {issue}")
        return 1

    print(f"POLICY_OK: iteration {iteration}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
