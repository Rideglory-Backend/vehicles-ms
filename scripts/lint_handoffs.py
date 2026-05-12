#!/usr/bin/env python3
"""Lint handoff markdown structure and cross-references."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

HANDOFF_REQUIRED_HEADINGS = {
    "po.md": [
        "## Iteration goal",
        "## Stories for this iteration",
        "## Assumptions and open questions",
        "## Out of scope (this iteration)",
        "## Next agent needs to know",
        "## Change log",
    ],
    "architect.md": [
        "## Architecture decisions",
        "## Data model",
        "## API contracts",
        "## Environment variables",
        "## Risks",
        "## Change log",
    ],
    "design.md": [
        "## Screens",
        "## Component hierarchy",
        "## Copy and content",
        "## Accessibility notes",
        "## Error and loading states",
        "## Change log",
    ],
    "backend.md": [
        "## Endpoints delivered",
        "## Data and migrations",
        "## Validation and security",
        "## Test results",
        "## Known gaps",
        "## Change log",
    ],
    "frontend.md": [
        "## Screens delivered",
        "## API integration",
        "## Validation and state handling",
        "## Test results",
        "## Known gaps",
        "## Change log",
    ],
    "qa.md": [
        "## Test catalog",
        "## Automated results",
        "## Bugs filed",
        "## Deferred coverage",
        "## Sign-off",
        "## Change log",
    ],
    "devops.md": [
        "## CI pipeline",
        "## Deployment notes",
        "## Environment and secrets layout",
        "## Verification results",
        "## Known gaps",
        "## Change log",
    ],
    "tech_lead.md": [
        "## PR reviewed",
        "## Blocking issues",
        "## Security review",
        "## Test coverage assessment",
        "## Verdict",
        "## Change log",
    ],
}

LINK_RE = re.compile(r"`([^`]+)`")


def lint_handoff(path: Path, repo_root: Path) -> list[str]:
    issues: list[str] = []
    content = path.read_text(encoding="utf-8")
    name = path.name

    required = HANDOFF_REQUIRED_HEADINGS.get(name, [])
    for heading in required:
        if heading not in content:
            issues.append(f"{name}: missing heading `{heading}`")

    for match in LINK_RE.finditer(content):
        ref = match.group(1)
        if "/" not in ref or ref.startswith("http"):
            continue
        ref_path = repo_root / ref
        if not ref_path.exists():
            issues.append(f"{name}: cross-reference not found `{ref}`")

    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description="Lint docs/handoffs markdown files")
    parser.add_argument("--dir", default="docs/handoffs", help="Handoffs directory")
    args = parser.parse_args()

    root = Path.cwd()
    handoffs_dir = root / args.dir
    if not handoffs_dir.exists():
        print(f"ERROR: handoffs dir not found: {handoffs_dir}")
        return 1

    md_files = [p for p in handoffs_dir.glob("*.md") if p.name not in {"iteration_checkpoint.md", "iteration_context.md"}]
    if not md_files:
        print("OK: no handoff files to lint.")
        return 0

    all_issues: list[str] = []
    for file in sorted(md_files):
        all_issues.extend(lint_handoff(file, root))

    if all_issues:
        print("HANDOFF_LINT_FAIL")
        for issue in all_issues:
            print(f"- {issue}")
        return 1

    print(f"HANDOFF_LINT_OK: {len(md_files)} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
