#!/usr/bin/env bash
# Reset generated product/plan artifacts for local iteration on the solo-mode framework.
# Keeps: docs/PRD.md, .claude/agents/, .claude/commands/, dashboard/, workflow/state.bootstrap.json, CLAUDE.md, etc.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

YES=0
for arg in "$@"; do
  case "$arg" in
    -y|--yes) YES=1 ;;
  esac
done

if [[ "$YES" -ne 1 ]]; then
  cat <<'EOF'
This will DELETE generated work:

  • apps/                          (all application code)
  • .claude/skills/*.md            (except README.md, _template.md, pencil.md)
  • docs/handoffs/*.md             (all role handoffs + iteration_context)
  • docs/handoffs/planning/        (all planning-session artifacts)
  • docs/handoffs/contracts/       (all phase contracts)
  • docs/PLAN.md, docs/PLAN_FEEDBACK.md
  • docs/DEPLOY.md, docs/ITERATION_SUMMARY_*.md
  • docs/architecture/ADR-*.md, schema.dbml
  • .github/workflows/*
  • docker-compose.yml
  • infra/                         (if present)

And RESET:

  • workflow/state.json          ← from workflow/state.bootstrap.json (+ fresh timestamps)
  • docs/architecture/DIAGRAMS.md ← template
  • docs/PRODUCT_STATUS.md, docs/ITERATION_HISTORY.md, docs/handoffs/iteration_context.md, docs/handoffs/iteration_checkpoint.md
  • .env.example                  ← minimal placeholder

Does NOT delete docs/PRD.md, .claude/agents/, .claude/commands/, or the dashboard.

EOF
  read -r -p 'Type RESET to continue: ' confirm
  if [[ "$confirm" != "RESET" ]]; then
    echo "Aborted."
    exit 1
  fi
fi

echo ">> Removing application and CI outputs..."
rm -rf "${ROOT}/apps"
rm -rf "${ROOT}/infra"
rm -f "${ROOT}/docker-compose.yml"
rm -rf "${ROOT}/.github/workflows"
mkdir -p "${ROOT}/.github/workflows"

echo ">> Removing agent skills (keeping README + template)..."
find "${ROOT}/.claude/skills" -maxdepth 1 -type f -name '*.md' \
  ! -name 'README.md' ! -name '_template.md' ! -name 'pencil.md' -delete 2>/dev/null || true

echo ">> Removing handoffs and plan/deploy docs..."
rm -f "${ROOT}/docs/handoffs/"*.md
rm -rf "${ROOT}/docs/handoffs/planning"
rm -rf "${ROOT}/docs/handoffs/contracts"
mkdir -p "${ROOT}/docs/handoffs"
rm -f "${ROOT}/docs/PLAN.md" "${ROOT}/docs/PLAN_FEEDBACK.md" "${ROOT}/docs/DEPLOY.md"
rm -f "${ROOT}/docs/ITERATION_SUMMARY_"*.md
rm -f "${ROOT}/docs/architecture/ADR-"*.md "${ROOT}/docs/architecture/schema.dbml" 2>/dev/null || true

echo ">> Restoring doc templates..."
mkdir -p "${ROOT}/docs/architecture"
cp "${ROOT}/scripts/templates/DIAGRAMS.md" "${ROOT}/docs/architecture/DIAGRAMS.md"
cp "${ROOT}/scripts/templates/PRODUCT_STATUS.md" "${ROOT}/docs/PRODUCT_STATUS.md"
cp "${ROOT}/scripts/templates/ITERATION_HISTORY.md" "${ROOT}/docs/ITERATION_HISTORY.md"
cp "${ROOT}/scripts/templates/iteration_context.md" "${ROOT}/docs/handoffs/iteration_context.md"
cp "${ROOT}/scripts/templates/iteration_checkpoint.md" "${ROOT}/docs/handoffs/iteration_checkpoint.md"
cp "${ROOT}/scripts/templates/artifact_log.json" "${ROOT}/workflow/artifact_log.json"
cp "${ROOT}/scripts/templates/env.example" "${ROOT}/.env.example"

echo ">> Writing workflow/state.json..."
REPO_ROOT="$ROOT" python3 <<'PY'
import json
import datetime
import os
from pathlib import Path

root = Path(os.environ["REPO_ROOT"])
boot_path = root / "workflow" / "state.bootstrap.json"
out_path = root / "workflow" / "state.json"

data = json.loads(boot_path.read_text(encoding="utf-8"))
now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
if data.get("events"):
    data["events"][0]["at"] = now
    data["events"][0]["type"] = "dev_reset"
    data["events"][0]["detail"] = (
        "scripts/dev-reset.sh: restored framework baseline. Run /solo-plan then /solo-approve then /iter."
    )
if data.get("tasks"):
    for t in data["tasks"]:
        t["updatedAt"] = now

out_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
PY

echo "Done. Next: edit docs/PRD.md if needed → /solo-plan → /solo-approve → /iter 1"
