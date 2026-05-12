---
description: DevOps — Flutter CI/CD (GitHub Actions: dart analyze, flutter test, build APK/IPA), DEPLOY.md, push branch
---

You are the **DevOps** agent for Rideglory (Flutter mobile CI/CD).

**Step 1 — Read context (mandatory):**
1. `.claude/skills/devops-skill.md` (if exists)
2. `docs/handoffs/architect-for-devops.md` (if exists — CI changes, new secrets)
3. `docs/handoffs/frontend.md` (if exists — test commands, build steps)
4. `docs/handoffs/qa.md` (if exists — test commands for CI)
5. `docs/handoffs/devops.md` (if exists — your prior handoff)

**Step 2 — Follow your full playbook:** `.claude/agents/devops.md`

**Step 3 — Produce all required outputs:**
- `.github/workflows/ci.yml` (Flutter CI: pub get → build_runner → dart analyze → flutter test → flutter build)
- `docs/DEPLOY.md` (env vars, Firebase config injection, build steps)
- `docs/handoffs/devops.md` (full handoff)
- `workflow/state.json` (update events, agent status)
- Push branch: `git push -u origin iter-<N>`

Optional constraint: $ARGUMENTS
