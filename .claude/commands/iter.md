---
description: Run the full autonomous SDLC flow for a specific iteration (Rideglory Flutter)
allowed-tools: Agent, Read, Write, Bash, Glob, Grep
---

**Target iteration: $ARGUMENTS**

You are the **SDLC orchestrator** for iteration **$ARGUMENTS**. You do NOT execute agent work inline. You spawn each phase as a **real subagent** via the Agent tool — each with its own model and self-contained context — wait for it to complete, then spawn the next.

### How agents read `workflow/state.json` (token optimization)

When any subagent prompt says to read `workflow/state.json`, they must read **only**:
- `currentIteration`, `planStatus`, `existingSystem`
- The `iterations[]` row where `id === $ARGUMENTS`
- `tasks[]` filtered to `iteration === $ARGUMENTS` and/or their role
- The **last 5** entries of `events[]`

---

## Pre-flight (you execute this directly before spawning any agent)

1. Read `workflow/state.json`
2. Note the `project` field — substitute as **PROJECT** in subagent prompts. Note `existingSystem.basePath` (Flutter app path) and `existingSystem.backend` (rideglory-api path).
3. Confirm `planStatus` is `"approved"` — if not, stop: tell human to run `/solo-plan` then `/solo-approve`
4. Find iteration **$ARGUMENTS** in `iterations[]`:
   - Missing → stop and explain
   - `done` → stop; suggest `/iter {N+1}` or `/solo-plan` if scope changed
   - `active` → stop; tell human to use `/resume-iter`
   - `blocked` → stop; resolve blockers first
   - `planned` → proceed
5. Update `workflow/state.json`: set `currentIteration` = $ARGUMENTS, set iteration `status` = `"active"`, append event `{ "type": "iteration_started", "iteration": $ARGUMENTS, "at": "<ISO UTC>", "agent": "system", "detail": "Full /iter $ARGUMENTS run starting." }`
6. Read `scripts/templates/iteration_checkpoint.md` and initialize `docs/handoffs/iteration_checkpoint.md`
7. If `.git` exists, checkout `iter-$ARGUMENTS` (created by `/solo-approve`); if missing, stop and tell human to run `/solo-approve`.

## P0 hard quality gates (mandatory after each phase)

1. `python3 scripts/validate_workflow_state.py` passes.
2. Phase contract exists at `docs/handoffs/contracts/iter-$ARGUMENTS/<phase>.json` with status `pass`.
3. `python3 scripts/phase_gate.py --iteration $ARGUMENTS --phase <phase>` passes before starting next phase.

## P1 operational gates (mandatory after each phase)

`python3 scripts/run_quality_gates.py --iteration $ARGUMENTS --phase <phase>` passes.

## Artifact log (mandatory for every phase agent)

After each batch of writes, run:
```bash
python3 scripts/log_artifact.py --iteration $ARGUMENTS --phase <phase_key> --agent <role> --path <repo-relative> [--path ...]
```

---

## Phase 1 — PO | model: sonnet

Spawn an Agent with:
- **description:** `"[PO / sonnet] — scope iteration $ARGUMENTS"`
- **model:** `"sonnet"`
- **prompt:**

```
You are the Product Owner (PO) agent — Phase 1 of iteration $ARGUMENTS for the <project> project.

Read your playbook at `.claude/agents/po.md` — sections [po_scope] and [general] only.

CONTEXT — read in this order:
1. `.claude/skills/po-skill.md` (if exists)
2. `docs/handoffs/iteration_context.md` (if exists and not idle template)
3. `docs/PRD.md` — read in full
4. `docs/PLAN.md`
5. `workflow/state.json` — partial read: currentIteration, iterations[] row for $ARGUMENTS, tasks[] for this iteration, last 5 events
6. `docs/handoffs/po.md` (if exists)
7. `docs/handoffs/tech_lead.md` (if exists)
8. `docs/handoffs/qa.md` (if exists)

YOUR WORK:
- Confirm the iteration $ARGUMENTS goal from docs/PLAN.md
- Write detailed user stories for iteration $ARGUMENTS only (format: US-$ARGUMENTS-N)
- Add at least one QA task (agent: "qa") to workflow/state.json tasks[]
- Document scope decisions and assumptions

REQUIRED OUTPUTS:
- `docs/handoffs/po.md` — overwrite with full handoff
- `workflow/state.json` — set agents.po.status idle, update tasks[], append event type: "po_plan"
- `docs/handoffs/contracts/iter-$ARGUMENTS/po_scope.json` — phase contract (MUST include: iteration, phase, status, updatedAt, summary, metrics {tokens: int, costUsd: float}, artifacts[], qualityGates[])

SKILL UPDATE (before git commit):
Append to `.claude/skills/po-skill.md` (create from _template.md if missing):
- Under ## Gotchas and learnings: scope decisions, story splitting patterns this iteration.
- Under ## Change log: <ISO date> (iter $ARGUMENTS): <one-line summary>.

ARTIFACT LOG (mandatory):
  python3 scripts/log_artifact.py --iteration $ARGUMENTS --phase po_scope --agent po --path docs/handoffs/po.md --path workflow/state.json --path docs/handoffs/iteration_checkpoint.md --path docs/handoffs/contracts/iter-$ARGUMENTS/po_scope.json --path .claude/skills/po-skill.md

GIT: git add docs/handoffs/po.md workflow/state.json docs/handoffs/iteration_checkpoint.md docs/handoffs/contracts/iter-$ARGUMENTS/po_scope.json .claude/skills/po-skill.md && git commit -m "feat(iter-$ARGUMENTS): po — iteration scope and tasks"

PHASE COMPLETE (mandatory — do this last):
Append to workflow/state.json events: { "type": "phase_complete", "iteration": $ARGUMENTS, "phase": "po_scope", "agent": "po", "at": "<ISO UTC>", "detail": "<one-line scope summary>" }
Update docs/handoffs/iteration_checkpoint.md: Last = po_scope, Next = architect.
```

Wait for PO agent. Verify `docs/handoffs/po.md` exists. Run quality gates:
- `python3 scripts/run_quality_gates.py --iteration $ARGUMENTS --phase po_scope`

---

## Phase 2 — Architect | model: opus

Spawn an Agent with:
- **description:** `"[Architect / opus] — iter $ARGUMENTS Flutter feature architecture + API contracts"`
- **model:** `"opus"`
- **prompt:**

```
You are the Architect agent — Phase 2 of iteration $ARGUMENTS for the <project> project (Flutter mobile app).

Read your playbook at `.claude/agents/architect.md` — sections [general] and [impl].

CONTEXT — read in this order:
0. `docs/handoffs/planning/00-existing-system-scan.md` — if it exists, read this first (brownfield inventory).
1. `.claude/skills/architect-skill.md` (if exists)
2. `docs/handoffs/iteration_context.md` (if exists and not idle template)
3. `docs/PRD.md` — read in full
4. `docs/handoffs/po.md`
5. `workflow/state.json` — partial read; check existingSystem.basePath and existingSystem.backend
6. `docs/handoffs/architect.md` (if exists)
7. `docs/handoffs/tech_lead.md` (if exists)

YOUR WORK:
- GIT: git checkout iter-$ARGUMENTS (do NOT create this branch).
- Scan lib/features/ in the Flutter app to understand existing structure.
- Map each PO story to Flutter layer changes (domain / data / presentation).
- Define API contracts for any rideglory-api changes needed.
- Define new domain models, DTOs, Retrofit endpoints.
- Write slim handoffs for each downstream role.
- If iteration 1: generate ALL skill files under .claude/skills/ using _template.md as base.
- If iteration > 1: update architect-skill.md only (+ cross-cutting updates to other skills if needed).

REQUIRED OUTPUTS:
- `docs/handoffs/architect.md` — full handoff
- `docs/handoffs/architect-for-backend.md` — NestJS changes needed in rideglory-api (≤120 lines)
- `docs/handoffs/architect-for-frontend.md` — Flutter feature structure, models, DTOs, Retrofit, cubit pattern, l10n keys (≤120 lines)
- `docs/handoffs/architect-for-devops.md` — CI changes, new env var names (≤120 lines)
- `docs/handoffs/architect-for-qa.md` — test commands, acceptance criteria traceability (≤120 lines)
- `docs/architecture/DIAGRAMS.md` — Mermaid ERD / sequence diagrams if data model changes
- `.claude/skills/*.md` — per rules in YOUR WORK above
- `workflow/state.json` — set agents.architect.status idle, add tasks, append event type: "architect_plan"
- `docs/handoffs/contracts/iter-$ARGUMENTS/architect.json` — phase contract

SKILL UPDATE — architect-skill.md (always):
Append under ## Gotchas and learnings and ## Change log.

ARTIFACT LOG (mandatory):
  python3 scripts/log_artifact.py --iteration $ARGUMENTS --phase architect --agent architect --path docs/handoffs/architect.md --path docs/handoffs/architect-for-backend.md --path docs/handoffs/architect-for-frontend.md --path docs/handoffs/architect-for-devops.md --path docs/handoffs/architect-for-qa.md --path docs/architecture/DIAGRAMS.md --path workflow/state.json --path docs/handoffs/iteration_checkpoint.md --path docs/handoffs/contracts/iter-$ARGUMENTS/architect.json --path .claude/skills/architect-skill.md

GIT: git add docs/handoffs/architect.md docs/handoffs/architect-for-*.md docs/architecture/ workflow/state.json docs/handoffs/iteration_checkpoint.md docs/handoffs/contracts/iter-$ARGUMENTS/architect.json .claude/skills/ && git commit -m "feat(iter-$ARGUMENTS): architect — Flutter feature arch, API contracts, slim handoffs"

PHASE COMPLETE (mandatory):
Append: { "type": "phase_complete", "iteration": $ARGUMENTS, "phase": "architect", "agent": "architect", "at": "<ISO UTC>", "detail": "<one-line: feature arch + contracts defined>" }
Update checkpoint: Last = architect, Next = design.
```

Wait for Architect. Verify `docs/handoffs/architect.md` exists. Run quality gates:
- `python3 scripts/run_quality_gates.py --iteration $ARGUMENTS --phase architect`

---

## Phase 3 — Design | model: sonnet

Spawn an Agent with:
- **description:** `"[Design / sonnet] — iter $ARGUMENTS mobile screens + HTML mockups"`
- **model:** `"sonnet"`
- **prompt:**

```
You are the Design agent — Phase 3 of iteration $ARGUMENTS for the <project> Flutter mobile app.

Read your playbook at `.claude/agents/design.md` — sections [general] and [impl].

CONTEXT — read in this order:
1. `.claude/skills/design-skill.md` (if exists) — locked design tokens, screen inventory
2. `docs/handoffs/iteration_context.md` (if exists and not idle template)
3. `docs/handoffs/po.md` — current iteration stories
4. `docs/handoffs/architect-for-frontend.md` — API/error shapes for UI copy. If missing, read architect.md.
5. `docs/handoffs/design.md` (if exists — your prior handoff; note locked decisions)
6. `docs/design/html-mockups/` — scan prior iteration folders for established visual patterns

DESIGN INVENTORY (before any design work):
If docs/handoffs/design.md exists OR html-mockups/ has content:
- You are in continuation mode. Do NOT redesign from scratch.
- Classify each story's UI as NEW / EXTEND / UPDATE.
- Match existing dark theme: bg #111111, primary orange #f98c1f, Space Grotesk font, 8px border radius.
- Copy styles.css from prior iteration folder verbatim; modify only what this iteration requires.

YOUR WORK:
1. Classify each story as NEW / EXTEND / UPDATE
2. Map stories to mobile screens — consider Flutter navigation (go_router routes)
3. Design UX flows — loading, success, error, empty states per screen
4. Component hierarchy — which lib/shared/widgets/ components to use; new widgets needed
5. UI copy — every label, placeholder, error, button text in Spanish (sentence case for buttons)
6. HTML/CSS mockups — mobile viewport 375×812px, dark theme, one file per screen/state
   Output to: docs/design/html-mockups/iter-$ARGUMENTS/
7. Do NOT write Flutter code.

REQUIRED OUTPUTS:
- `docs/handoffs/design.md` — full handoff
- `docs/design/html-mockups/iter-$ARGUMENTS/` — HTML mockups
- `workflow/state.json` — set agents.design.status idle, append event type: "design_iteration"
- `docs/handoffs/contracts/iter-$ARGUMENTS/design.json` — phase contract

SKILL UPDATE: Append to .claude/skills/design-skill.md: screen inventory, locked tokens, learnings.

ARTIFACT LOG:
  python3 scripts/log_artifact.py --iteration $ARGUMENTS --phase design --agent design --path docs/handoffs/design.md --path workflow/state.json --path docs/handoffs/iteration_checkpoint.md --path docs/handoffs/contracts/iter-$ARGUMENTS/design.json --path .claude/skills/design-skill.md --path docs/design/

GIT: git add docs/handoffs/design.md docs/design/ workflow/state.json docs/handoffs/iteration_checkpoint.md docs/handoffs/contracts/iter-$ARGUMENTS/design.json .claude/skills/design-skill.md && git commit -m "feat(iter-$ARGUMENTS): design — mobile screens, mockups, copy"

PHASE COMPLETE:
Append: { "type": "phase_complete", "iteration": $ARGUMENTS, "phase": "design", "agent": "design", "at": "<ISO UTC>", "detail": "<one-line: screens designed>" }
Update checkpoint: Last = design, Next = backend.
```

Wait for Design. Verify `docs/handoffs/design.md` exists. Run quality gates:
- `python3 scripts/run_quality_gates.py --iteration $ARGUMENTS --phase design`

---

## Phase 4 — Backend (rideglory-api) | model: sonnet

**Skip this phase if the Architect handoff says no API changes are needed this iteration.** In that case, write a pass-through contract at `docs/handoffs/contracts/iter-$ARGUMENTS/backend.json` (status: pass, summary: "No rideglory-api changes required this iteration") and append a `phase_complete` event, then proceed to Phase 5.

Spawn an Agent with:
- **description:** `"[Backend / sonnet] — iter $ARGUMENTS rideglory-api endpoints"`
- **model:** `"sonnet"`
- **prompt:**

```
You are the Backend API Developer agent — Phase 4 of iteration $ARGUMENTS for the <project> project.
You work in the rideglory-api repository at: /Users/cami/Developer/Personal/rideglory-api

Read your playbook at `.claude/agents/backend.md` — sections [general] and [impl].

CONTEXT — read in this order:
1. `.claude/skills/backend-skill.md` (if exists)
2. `docs/handoffs/architect-for-backend.md` — NestJS changes, API contracts, env vars. Read first.
3. `docs/PRD.md`
4. `docs/handoffs/po.md`
5. `docs/handoffs/backend.md` (if exists)
6. `docs/handoffs/tech_lead.md` (if exists)
7. `workflow/state.json` — partial read

YOUR WORK:
- cd /Users/cami/Developer/Personal/rideglory-api — work there.
- Read existing NestJS code before adding anything (brownfield).
- Implement only the endpoints defined in architect-for-backend.md.
- Follow existing NestJS module/controller/service/guard/dto structure.
- Validate Firebase ID tokens on every protected endpoint.
- Write unit + e2e tests. All must pass before marking done.
- Update .env.example in rideglory-api with any new env vars.

REQUIRED OUTPUTS:
- `docs/handoffs/backend.md` — full handoff (written back in the Rideglory repo context)
- `workflow/state.json` — set agents.backend.status idle, update tasks, append event
- `docs/handoffs/contracts/iter-$ARGUMENTS/backend.json` — phase contract
- Code changes in /Users/cami/Developer/Personal/rideglory-api

SKILL UPDATE: Append to .claude/skills/backend-skill.md.

ARTIFACT LOG:
  python3 scripts/log_artifact.py --iteration $ARGUMENTS --phase backend --agent backend --path docs/handoffs/backend.md --path workflow/state.json --path docs/handoffs/iteration_checkpoint.md --path docs/handoffs/contracts/iter-$ARGUMENTS/backend.json --path .claude/skills/backend-skill.md

GIT (commit in rideglory-api, then update handoff in Rideglory):
  cd /Users/cami/Developer/Personal/rideglory-api && git add -A && git commit -m "feat(iter-$ARGUMENTS): backend — <endpoints implemented>"
  (Then back in Rideglory): git add docs/handoffs/backend.md workflow/state.json docs/handoffs/iteration_checkpoint.md docs/handoffs/contracts/iter-$ARGUMENTS/backend.json .claude/skills/backend-skill.md && git commit -m "feat(iter-$ARGUMENTS): backend handoff — rideglory-api changes"

PHASE COMPLETE:
Append: { "type": "phase_complete", "iteration": $ARGUMENTS, "phase": "backend", "agent": "backend", "at": "<ISO UTC>", "detail": "<one-line: endpoints implemented + test status>" }
Update checkpoint: Last = backend, Next = frontend.
```

Wait for Backend. Verify `docs/handoffs/backend.md` exists. Run quality gates:
- `python3 scripts/run_quality_gates.py --iteration $ARGUMENTS --phase backend`

---

## Phase 5 — Flutter Developer (Frontend) | model: sonnet

Spawn an Agent with:
- **description:** `"[Flutter Dev / sonnet] — iter $ARGUMENTS Flutter feature implementation"`
- **model:** `"sonnet"`
- **prompt:**

```
You are the Flutter Developer agent (the athlete) — Phase 5 of iteration $ARGUMENTS for the <project> project.
You work in the Flutter app at: /Users/cami/Developer/Personal/Rideglory/lib/

Read your playbook at `.claude/agents/frontend.md` — sections [general] and [impl].

CONTEXT — read in this order:
0. `docs/handoffs/planning/00-existing-system-scan.md` — if it exists, read this first (existing feature structure).
1. `.claude/skills/frontend-skill.md` (if exists)
2. `docs/handoffs/architect-for-frontend.md` — feature path, models, DTOs, Retrofit, cubit pattern, l10n keys. Read first.
3. `docs/PRD.md`
4. `docs/handoffs/po.md`
5. `docs/handoffs/design.md` — screens, component hierarchy, copy, mockup paths
6. `docs/handoffs/backend.md` — actual implemented API endpoints
7. `docs/handoffs/frontend.md` (if exists)
8. `docs/handoffs/tech_lead.md` (if exists)
9. `workflow/state.json` — partial read
10. `docs/design/html-mockups/iter-$ARGUMENTS/` — open HTML files as visual reference

YOUR WORK:
- Read existing lib/features/<feature>/ code before adding anything (brownfield, EXTEND not rebuild).
- Follow layer order: domain model → repository interface → DTO → Retrofit service → repository impl → use case → cubit → page → widgets.
- Follow rideglory-coding-standards.mdc: one widget per file, no _buildXxx helpers, all strings via ARB, AppButton not ElevatedButton, ResultState<T>, pushNamed navigation, colorScheme colors.
- Run code generation after adding models/services: dart run build_runner build --delete-conflicting-outputs
- Handle all states: initial, loading, data, empty, error.
- Write unit tests for use cases/cubits; widget tests for key screens.
- Run: dart analyze && flutter test — both must pass before handoff.

REQUIRED OUTPUTS:
- `docs/handoffs/frontend.md` — full handoff
- `workflow/state.json` — set agents.frontend.status idle, update tasks, append event
- `docs/handoffs/contracts/iter-$ARGUMENTS/frontend.json` — phase contract
- Flutter code changes in lib/

SKILL UPDATE: Append to .claude/skills/frontend-skill.md.

ARTIFACT LOG:
  python3 scripts/log_artifact.py --iteration $ARGUMENTS --phase frontend --agent frontend --path docs/handoffs/frontend.md --path workflow/state.json --path docs/handoffs/iteration_checkpoint.md --path docs/handoffs/contracts/iter-$ARGUMENTS/frontend.json --path .claude/skills/frontend-skill.md --path lib/

GIT: git add lib/ docs/handoffs/frontend.md workflow/state.json docs/handoffs/iteration_checkpoint.md docs/handoffs/contracts/iter-$ARGUMENTS/frontend.json .claude/skills/frontend-skill.md && git commit -m "feat(iter-$ARGUMENTS): flutter — <features implemented>"

PHASE COMPLETE:
Append: { "type": "phase_complete", "iteration": $ARGUMENTS, "phase": "frontend", "agent": "frontend", "at": "<ISO UTC>", "detail": "<one-line: features built + test status>" }
Update checkpoint: Last = frontend, Next = qa.
```

Wait for Flutter Dev. Verify `docs/handoffs/frontend.md` exists. Run quality gates:
- `python3 scripts/run_quality_gates.py --iteration $ARGUMENTS --phase frontend`

---

## Phase 6 — QA | model: sonnet

Spawn an Agent with:
- **description:** `"[QA / sonnet] — iter $ARGUMENTS dart analyze + flutter test + sign-off"`
- **model:** `"sonnet"`
- **prompt:**

```
You are the QA agent — Phase 6 of iteration $ARGUMENTS for the <project> Flutter mobile app.

Read your playbook at `.claude/agents/qa.md` — sections [general] and [impl].

CONTEXT — read in this order:
1. `.claude/skills/qa-skill.md` (if exists)
2. `docs/handoffs/architect-for-qa.md` — test commands, acceptance criteria traceability. Read first.
3. `docs/PRD.md`
4. `docs/handoffs/po.md`
5. `docs/handoffs/frontend.md` — what was implemented, how to run tests
6. `docs/handoffs/backend.md` — rideglory-api changes
7. `docs/handoffs/design.md` — expected UI states
8. `docs/handoffs/qa.md` (if exists)
9. `workflow/state.json` — partial read

YOUR WORK:
- Write test catalog (TC-$ARGUMENTS-N) for every acceptance criterion.
- Run: dart analyze — file BUG task for every new violation introduced this iteration.
- Run: flutter test — file BUG task for every failure.
- Integration tests if available: flutter test integration_test/
- File bugs: BUG-$ARGUMENTS-N in workflow/state.json, assigned to frontend or backend.
- Do not mark phase complete until all acceptance criteria pass or failures explicitly deferred.

REQUIRED OUTPUTS:
- `docs/handoffs/qa.md` — full handoff
- `workflow/state.json` — set agents.qa.status idle, add BUG tasks, append event
- `docs/handoffs/contracts/iter-$ARGUMENTS/qa.json` — phase contract

SKILL UPDATE: Append to .claude/skills/qa-skill.md.

ARTIFACT LOG:
  python3 scripts/log_artifact.py --iteration $ARGUMENTS --phase qa --agent qa --path docs/handoffs/qa.md --path workflow/state.json --path docs/handoffs/iteration_checkpoint.md --path docs/handoffs/contracts/iter-$ARGUMENTS/qa.json --path .claude/skills/qa-skill.md --path test/

GIT: git add docs/handoffs/qa.md workflow/state.json docs/handoffs/iteration_checkpoint.md docs/handoffs/contracts/iter-$ARGUMENTS/qa.json test/ .claude/skills/qa-skill.md && git commit -m "feat(iter-$ARGUMENTS): qa — test catalog + results"

PHASE COMPLETE:
Append: { "type": "phase_complete", "iteration": $ARGUMENTS, "phase": "qa", "agent": "qa", "at": "<ISO UTC>", "detail": "<one-line: N tests pass, M bugs filed>" }
Update checkpoint: Last = qa, Next = devops.
```

Wait for QA. Then:
1. Read `docs/handoffs/qa.md` → `## Sign-off` and `## Bugs filed`.
2. If **blocking bugs exist**:
   - Frontend bugs → spawn Flutter Dev fix agent (Phase 5 prompt, prepend: "BUG FIX MODE — read `docs/handoffs/qa.md` § Bugs filed. Fix only the listed blocking Flutter bugs. Run `dart analyze && flutter test`. Do not re-scaffold existing code.")
   - Backend bugs → spawn Backend fix agent (Phase 4 prompt, prepend same for backend bugs)
   - Re-spawn QA after fixes. Repeat until Sign-off = green. Two-cycle limit: surface to human if still failing.
3. Do not proceed to DevOps until QA sign-off is green or deferrals documented.

Run quality gates:
- `python3 scripts/run_quality_gates.py --iteration $ARGUMENTS --phase qa`

---

## Phase 7 — DevOps | model: sonnet

Spawn an Agent with:
- **description:** `"[DevOps / sonnet] — iter $ARGUMENTS Flutter CI pipeline"`
- **model:** `"sonnet"`
- **prompt:**

```
You are the DevOps agent — Phase 7 of iteration $ARGUMENTS for the <project> Flutter mobile app.

Read your playbook at `.claude/agents/devops.md` — sections [general] and [impl].

CONTEXT — read in this order:
1. `.claude/skills/devops-skill.md` (if exists)
2. `docs/handoffs/architect-for-devops.md` — CI changes, new env var names. Read first.
3. `docs/PRD.md`
4. `docs/handoffs/frontend.md` — Flutter test commands, code generation steps
5. `docs/handoffs/backend.md` — rideglory-api changes
6. `docs/handoffs/qa.md` — test commands for CI
7. `docs/handoffs/devops.md` (if exists)
8. `workflow/state.json` — partial read

YOUR WORK:
- Add or update .github/workflows/ci.yml:
  * Flutter setup (subosito/flutter-action@v2, flutter stable)
  * flutter pub get → dart run build_runner build --delete-conflicting-outputs
  * dart analyze (gate: fail on violations)
  * flutter test (gate: fail on any failure)
  * flutter build apk --release
  * Firebase config injection from GitHub Actions secrets (never commit google-services.json)
- Write or update docs/DEPLOY.md (all env vars, secrets layout, build + distribution steps)
- Push branch: git push -u origin iter-$ARGUMENTS
- Confirm CI passes on pushed branch.

REQUIRED OUTPUTS:
- `docs/handoffs/devops.md` — full handoff
- `workflow/state.json` — set agents.devops.status idle, update tasks, append event
- `docs/handoffs/contracts/iter-$ARGUMENTS/devops.json` — phase contract
- `.github/workflows/ci.yml`, `docs/DEPLOY.md`

SKILL UPDATE: Append to .claude/skills/devops-skill.md.

ARTIFACT LOG:
  python3 scripts/log_artifact.py --iteration $ARGUMENTS --phase devops --agent devops --path docs/handoffs/devops.md --path workflow/state.json --path docs/handoffs/iteration_checkpoint.md --path docs/handoffs/contracts/iter-$ARGUMENTS/devops.json --path .claude/skills/devops-skill.md --path .github/workflows/ci.yml --path docs/DEPLOY.md

GIT (before push):
  git add .github/ docs/handoffs/devops.md docs/DEPLOY.md workflow/state.json docs/handoffs/iteration_checkpoint.md docs/handoffs/contracts/iter-$ARGUMENTS/devops.json .claude/skills/devops-skill.md && git commit -m "feat(iter-$ARGUMENTS): devops — Flutter CI pipeline + deploy docs"
  git push -u origin iter-$ARGUMENTS

PHASE COMPLETE:
Append: { "type": "phase_complete", "iteration": $ARGUMENTS, "phase": "devops", "agent": "devops", "at": "<ISO UTC>", "detail": "<one-line: CI status + branch pushed>" }
Update checkpoint: Last = devops, Next = pr.
```

Wait for DevOps. Verify `docs/handoffs/devops.md` exists. Run quality gates:
- `python3 scripts/run_quality_gates.py --iteration $ARGUMENTS --phase devops`

---

## Phase 8 — Open Pull Request (you execute this directly)

1. Read `.github/pull_request_template.md` (if exists), `docs/handoffs/po.md`, `docs/handoffs/qa.md`, `workflow/state.json`
2. Write `docs/PULL_REQUEST_BODY_ITER_$ARGUMENTS.md` with stories delivered, test results, handoff links
3. Open PR:
   ```bash
   gh pr create --base main --head iter-$ARGUMENTS --title "feat(iter-$ARGUMENTS): <goal from plan>" --body-file docs/PULL_REQUEST_BODY_ITER_$ARGUMENTS.md
   ```
4. Capture PR number and URL
5. Update `workflow/state.json`: append event `{ "type": "phase_complete", "iteration": $ARGUMENTS, "phase": "pr", "agent": "system", "at": "<ISO UTC>", "detail": "PR #<n> opened: <url>" }`
6. Update checkpoint: Last = pr, Next = tech_lead
7. Write `docs/handoffs/contracts/iter-$ARGUMENTS/pr.json`
8. Run artifact log and quality gates: `python3 scripts/run_quality_gates.py --iteration $ARGUMENTS --phase pr`

---

## Phase 9 — Tech Lead | model: sonnet

Spawn an Agent with:
- **description:** `"[Tech Lead / sonnet] — iter $ARGUMENTS Flutter Clean Architecture PR review"`
- **model:** `"sonnet"`
- **prompt:**

```
You are the Tech Lead agent — Phase 9 of iteration $ARGUMENTS for the <project> Flutter mobile app.

Read your playbook at `.claude/agents/tech_lead.md` — sections [general] and [impl].

CONTEXT — read in this order:
1. `.claude/skills/tech_lead-skill.md` (if exists)
2. `.cursor/rules/rideglory-coding-standards.mdc` — read this FIRST. This is the mandatory style/architecture law.
3. `docs/handoffs/architect-for-frontend.md`, `architect-for-backend.md`, `architect-for-qa.md` — read all relevant slims
4. `docs/PRD.md`
5. `docs/handoffs/po.md`
6. `docs/handoffs/frontend.md`
7. `docs/handoffs/backend.md`
8. `docs/handoffs/qa.md`
9. `docs/handoffs/tech_lead.md` (if exists)
10. `workflow/state.json` — partial read; locate PR URL in last 5 events
11. The iteration PR: `gh pr list --head iter-$ARGUMENTS` then `gh pr diff <number>` — read FULL diff

YOUR WORK:
- Read the full PR diff.
- Inline comments for every blocking issue: `gh pr review <number> --comment --body "FILE path:LINE — <issue>"`
- Flutter Clean Architecture sweep (blocking): domain no Flutter/HTTP imports; data no widgets; presentation no HTTP calls/DTO exposure; dependencies inward only.
- rideglory-coding-standards sweep (blocking): one widget per file, no _buildXxx helpers, ARB strings only, AppButton not ElevatedButton, AppDialog not showDialog(), ResultState<T>, pushNamed navigation, colorScheme colors.
- dart analyze: must pass — any new violations are blocking.
- flutter test: must pass.
- Security (rideglory-api changes): Firebase ID token on every protected endpoint, no secrets in source.
- Decision: approved or blocked.

REQUIRED OUTPUTS:
- `docs/handoffs/tech_lead.md` — full review
- `workflow/state.json` — set agents.tech_lead.status idle, update tasks, append event type: "tech_lead_review"
- `docs/handoffs/contracts/iter-$ARGUMENTS/tech_lead.json` — phase contract

SKILL UPDATE: Append to .claude/skills/tech_lead-skill.md.

ARTIFACT LOG:
  python3 scripts/log_artifact.py --iteration $ARGUMENTS --phase tech_lead --agent tech_lead --path docs/handoffs/tech_lead.md --path workflow/state.json --path docs/handoffs/iteration_checkpoint.md --path docs/handoffs/contracts/iter-$ARGUMENTS/tech_lead.json --path .claude/skills/tech_lead-skill.md

GIT: git add docs/handoffs/tech_lead.md workflow/state.json docs/handoffs/iteration_checkpoint.md docs/handoffs/contracts/iter-$ARGUMENTS/tech_lead.json .claude/skills/tech_lead-skill.md && git commit -m "feat(iter-$ARGUMENTS): tech_lead — PR review <approved|blocked>"

PHASE COMPLETE:
Append: { "type": "phase_complete", "iteration": $ARGUMENTS, "phase": "tech_lead", "agent": "tech_lead", "at": "<ISO UTC>", "detail": "<approved|blocked> — <one-line reason>" }
Update checkpoint: Last = tech_lead, Next = po_close.
```

Wait for Tech Lead. Then:
1. Read `docs/handoffs/tech_lead.md` → `## Overall signal` and `## Blocking issues`.
2. If **blocked**: spawn Flutter Dev or Backend fix agents as needed. Re-spawn Tech Lead. Two-cycle limit.
3. Once approved: `gh pr merge <pr-number> --merge` and record merge SHA in `workflow/state.json` events.

Run quality gates:
- `python3 scripts/run_quality_gates.py --iteration $ARGUMENTS --phase tech_lead`

---

## Phase 10 — PO Close-out | model: sonnet

Spawn an Agent with:
- **description:** `"[PO / sonnet] — iter $ARGUMENTS close-out"`
- **model:** `"sonnet"`
- **prompt:**

```
You are the PO agent — Phase 10 (close-out) of iteration $ARGUMENTS for <project>.

Read your playbook at `.claude/agents/po.md` — sections [po_close] and [general] only.

CONTEXT — read ALL before working:
1. `docs/PRD.md` — in full
2. `docs/PLAN.md`
3. `docs/handoffs/po.md`
4. `docs/handoffs/architect-for-frontend.md`, `architect-for-backend.md` — skimming
5. `docs/handoffs/design.md`
6. `docs/handoffs/frontend.md`
7. `docs/handoffs/backend.md`
8. `docs/handoffs/qa.md`
9. `docs/handoffs/tech_lead.md` (contains PR URL and review verdict)
10. `workflow/state.json` — partial read
11. `docs/ITERATION_HISTORY.md` (if exists)
12. `docs/PRODUCT_STATUS.md` (if exists)
13. `scripts/templates/iteration_checkpoint.md` (reset template)

YOUR WORK — write all of these:
1. `docs/ITERATION_SUMMARY_$ARGUMENTS.md` — goal, stories delivered vs deferred, QA outcome, PR link
2. `docs/ITERATION_HISTORY.md` — append one row: iter id, ISO date, one-liner, link to summary
3. `docs/PRODUCT_STATUS.md` — update "what's shipped" to reflect iteration $ARGUMENTS capabilities
4. `docs/handoffs/iteration_context.md` — bridge for iteration ${ARGUMENTS+1}
5. `README.md` — refresh Shipped/operations links block
6. `docs/handoffs/iteration_checkpoint.md` — reset to idle template; set "Last closed: Iteration $ARGUMENTS"

REQUIRED OUTPUTS:
- All six files above
- `workflow/state.json` — set agents.po.status idle, append event type: "po_close"
- `docs/handoffs/contracts/iter-$ARGUMENTS/po_close.json` — phase contract

SKILL UPDATE: Append to .claude/skills/po-skill.md.

ARTIFACT LOG:
  python3 scripts/log_artifact.py --iteration $ARGUMENTS --phase po_close --agent po --path docs/ITERATION_SUMMARY_$ARGUMENTS.md --path docs/ITERATION_HISTORY.md --path docs/PRODUCT_STATUS.md --path docs/handoffs/iteration_context.md --path README.md --path docs/handoffs/iteration_checkpoint.md --path workflow/state.json --path docs/handoffs/contracts/iter-$ARGUMENTS/po_close.json --path .claude/skills/po-skill.md

GIT: git add docs/ README.md workflow/state.json docs/handoffs/contracts/iter-$ARGUMENTS/po_close.json .claude/skills/po-skill.md && git commit -m "feat(iter-$ARGUMENTS): po — iteration close-out and summary"

PHASE COMPLETE:
Append: { "type": "phase_complete", "iteration": $ARGUMENTS, "phase": "po_close", "agent": "po", "at": "<ISO UTC>", "detail": "Iteration $ARGUMENTS closed. Summary at docs/ITERATION_SUMMARY_$ARGUMENTS.md" }
```

Wait for PO close-out. Run quality gates:
- `python3 scripts/run_quality_gates.py --iteration $ARGUMENTS --phase po_close`

---

## Iteration close (you execute this directly)

0. **Compress events:** collect all `phase_complete` events for iteration $ARGUMENTS, remove them, append one `iteration_summary` event with phase chain + PR link.
1. Update `workflow/state.json`: set `iterations[$ARGUMENTS].status` = `"done"`, all `agents.*.status` = `"idle"`.
2. Print summary: what was built (per story), PR URL, tech lead verdict, test results, next command.
