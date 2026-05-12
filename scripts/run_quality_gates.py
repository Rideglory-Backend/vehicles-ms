#!/usr/bin/env python3
"""Single entrypoint for framework quality gates."""

from __future__ import annotations

import argparse
import subprocess
import sys


def run(cmd: list[str], allow_warn_exit_codes: set[int] | None = None) -> int:
    allow_warn_exit_codes = allow_warn_exit_codes or set()
    print(f"$ {' '.join(cmd)}")
    result = subprocess.run(cmd, check=False)
    if result.returncode == 0:
        return 0
    if result.returncode in allow_warn_exit_codes:
        print(f"WARN_ONLY: {' '.join(cmd)} exited with {result.returncode}")
        return 0
    return result.returncode


def main() -> int:
    parser = argparse.ArgumentParser(description="Run framework quality gates as one command")
    parser.add_argument("--iteration", required=True, type=int, help="Iteration number")
    parser.add_argument("--phase", required=True, help="Phase key")
    parser.add_argument(
        "--strict-drift",
        action="store_true",
        help="Treat drift detection as blocking (exit 1 on drift)",
    )
    args = parser.parse_args()

    commands: list[tuple[list[str], set[int]]] = [
        (["python3", "scripts/validate_workflow_state.py"], set()),
        (
            ["python3", "scripts/phase_gate.py", "--iteration", str(args.iteration), "--phase", args.phase],
            set(),
        ),
        (["python3", "scripts/framework_metrics.py"], set()),
        (["python3", "scripts/validate_done_policy.py", "--iteration", str(args.iteration)], set()),
        (["python3", "scripts/lint_handoffs.py"], set()),
    ]
    drift_cmd = ["python3", "scripts/detect_drift.py"]
    if args.strict_drift:
        drift_cmd.append("--strict")
        commands.append((drift_cmd, set()))
    else:
        commands.append((drift_cmd, {2}))

    for cmd, warn_codes in commands:
        rc = run(cmd, warn_codes)
        if rc != 0:
            print(f"GATES_FAIL: stopped at {' '.join(cmd)}")
            return rc

    print(
        "GATES_PASS: "
        f"iteration={args.iteration} phase={args.phase} strict_drift={args.strict_drift}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
