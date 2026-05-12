---
description: Collaborative planning — PO proposal, Architect, Plan Reviewer (UX + quality), PO final plan + state merge; brownfield Flutter context
allowed-tools: Agent, Read, Write, Bash, Glob, Grep
---

You are the **planning session orchestrator** for the Rideglory Flutter mobile app. You do NOT plan inline. You spawn **four** real subagents in sequence. The final plan is authored by the PO agent (Agent 4). Your only post-PO duties are mechanical: merge `workflow/state.json` from the PO's JSON artifact.

Subagent pipeline: **PO proposal → Architect → Plan Reviewer (UX + quality) → PO final synthesis**.

---

## Pre-read + planning session init (you execute this directly)

Read these files:
1. `docs/PRD.md` — read every word
2. `docs/PLAN_FEEDBACK.md` — if it exists with non-placeholder content, extract all feedback points
3. `docs/PLAN.md` — prior plan draft if it exists
4. `workflow/state.json` — note `plan.generatedAt`, `project` field (→ **PROJECT**), `existingSystem`

Create the planning session folder (if it does not exist): `docs/handoffs/planning/`

Optional user note: $ARGUMENTS

---

### Classify the run — CRITICAL

Set `RUN_MODE`:
- **`FRESH`** — `docs/PLAN.md` does not exist or is empty/placeholder.
- **`FEEDBACK_REPLAN`** — `docs/PLAN.md` exists AND `docs/PLAN_FEEDBACK.md` has real content AND PRD fingerprint has NOT changed.
- **`PRD_REPLAN`** — `docs/PLAN.md` exists AND PRD fingerprint indicates content changes since `plan.generatedAt`.

Tell the human the detected mode before proceeding.

---

### Detect existing system (brownfield — ALWAYS true for Rideglory)

Rideglory is **always brownfield**. The existing system is declared in `workflow/state.json → existingSystem`:
- Flutter app: `/Users/cami/Developer/Personal/Rideglory/lib/`
- Backend API: `/Users/cami/Developer/Personal/rideglory-api`

Set `IS_BROWNFIELD = true`. Set `BROWNFIELD_PATH` from `workflow/state.json → existingSystem.basePath`.

Update `workflow/state.json → existingSystem` if needed to reflect current paths.

Tell the human: **"Brownfield mode: YES — Flutter app + rideglory-api. System scanner (Agent 0) will inventory existing features."**

---

### Detect existing design artifacts

Check:
1. Does `docs/handoffs/design.md` exist? → `HAS_DESIGN_HANDOFF = true`
2. Does `docs/design/html-mockups/` exist with subfolders? → list them
3. Any prior mockup iterations?

Tell the human the result.

---

### Detect partial completion (resume logic)

Check which planning handoffs exist in `docs/handoffs/planning/` from this run. Skip already-done agents.

### Initialize checkpoint and state

Write `docs/handoffs/iteration_checkpoint.md` with a planning session header (see template pattern from Claude-cami reference).

Append to `workflow/state.json` events: `{ "type": "planning_session_started", ... }`

---

## Agent 0 — Existing System Scanner | model: sonnet

**Always spawn for Rideglory (always brownfield). Skip only if `00-existing-system-scan.md` already exists from this run.**

Spawn an Agent with:
- **description:** `"[Scanner / sonnet] — Rideglory existing system inventory"`
- **model:** `"sonnet"`
- **prompt:**

```
You are the System Scanner agent for the Rideglory project planning session.

BROWNFIELD PATHS:
- Flutter app: /Users/cami/Developer/Personal/Rideglory/lib/
- Backend API: /Users/cami/Developer/Personal/rideglory-api

CONTEXT — read first:
1. `docs/PRD.md` — understand what the app must do; use as gap-analysis lens
2. `workflow/state.json` — read existingSystem for confirmed paths

SCANNING INSTRUCTIONS:

Step 1 — Flutter app structure (lib/):
- List lib/features/ — one entry per feature folder
- For each feature: list domain/, data/, presentation/ subdirectories and their key files (model, repository interface, use cases, DTOs, services, cubits, pages) — summarize names only, do NOT paste source
- Note lib/shared/widgets/, lib/core/, lib/design_system/ structure at top level

Step 2 — Flutter dependencies (pubspec.yaml):
- List key dependencies: state management, HTTP, DI, router, Firebase, maps, etc.
- Note dev dependencies for code generation

Step 3 — Backend API surface (rideglory-api):
- List microservices (top-level directories in rideglory-api)
- For each service: list controllers/routes — endpoint groups only (method + path pattern + one-line purpose)
- Note Firebase Auth guard usage

Step 4 — Existing feature coverage vs PRD:
- For each PRD feature/requirement, mark: `implemented` | `partial (what's done / missing)` | `not started`

Step 5 — Design artifacts:
- Scan docs/design/html-mockups/ — list iteration folders and screen files
- Scan docs/handoffs/design.md if exists — list screen inventory

OUTPUT — write to `docs/handoffs/planning/00-existing-system-scan.md`:

# Existing System Scan — Rideglory

> Generated: <ISO date>
> Flutter app: /Users/cami/Developer/Personal/Rideglory/lib/
> Backend: /Users/cami/Developer/Personal/rideglory-api

## Flutter feature inventory
| Feature | Domain models | Data (DTOs/services) | Presentation (cubits/pages) | Status |
|---------|--------------|---------------------|---------------------------|--------|

## Key dependencies
| Category | Package | Purpose |
|----------|---------|---------|

## rideglory-api surface
| Service | Endpoint groups | Auth |
|---------|-----------------|------|

## Design artifacts
| Folder | Screens covered |
|--------|----------------|

## PRD gap analysis
| Requirement | Status | Notes |
|-------------|--------|-------|

## Key architectural patterns
<auth approach, error handling, routing conventions, naming conventions>

## Planning implications
<2-5 bullets: what the PO/Architect should know about continuing vs. what's missing>

Do NOT update workflow/state.json.
```

Wait for Scanner. Verify `docs/handoffs/planning/00-existing-system-scan.md` exists.

After Agent 0 completes: update checkpoint, append planning_phase_complete event.

---

## Agent 1 — PO: iteration proposal | model: sonnet

Spawn with same structure as the reference framework (Claude-cami/solo-plan.md Agent 1), but:
- Context includes `00-existing-system-scan.md`
- Knows this is a Flutter mobile app with existing features
- Stories describe **mobile user behavior**, not web behavior
- Output to `docs/handoffs/planning/01-po-proposal.md`

---

## Agent 2 — Architect: stack proposal + technical review | model: sonnet

Spawn with same structure as reference, but:
- Stack is NOT chosen from scratch — it's the existing Flutter + Firebase + rideglory-api stack
- Architect VALIDATES existing stack choices, identifies any new libs/patterns needed
- Reviews iterations for Flutter-specific complexity (code gen, platform differences, WebSocket)
- Output to `docs/handoffs/planning/02-architect-review.md`

---

## Agent 3 — Plan Reviewer: UX complexity + quality gates | model: sonnet

Spawn with same structure as reference, but:
- Design lens is mobile-first (375px, touch targets, Flutter navigation patterns)
- Tech lead lens checks Flutter Clean Architecture adherence + rideglory-coding-standards
- Existing design inventory: check `docs/design/html-mockups/` for prior mockup iterations
- Output to `docs/handoffs/planning/03-plan-review.md`

---

## Agent 4 — PO: final plan synthesis | model: sonnet

Spawn with same structure as reference. Output:
- `docs/PLAN.md` — iteration plan (status: AWAITING HUMAN APPROVAL)
- `docs/handoffs/planning/04-po-workflow-plan.json` — valid JSON workflow payload

---

## Orchestrator: merge workflow state (you execute this directly)

1. Read `workflow/state.json`.
2. Parse `docs/handoffs/planning/04-po-workflow-plan.json`.
3. Set `planStatus` to `"awaiting_approval"`.
4. Merge `plan` object from JSON (proposedStack, assumptions, risks, deferred).
5. Merge `productIterations` from JSON into `iterations[]` (preserve id=0 framework entry).
6. Set all `agents.*.status` to `"idle"`.
7. Append event: `{ "type": "plan_drafted", ... }`
8. Reset `docs/handoffs/iteration_checkpoint.md` to idle template.
9. Preserve `existingSystem` in `workflow/state.json` — never remove it.

---

## End message

Tell the human:
1. Run mode used + what it meant
2. Brownfield mode: YES — Flutter app + rideglory-api. Scanner inventoried X features.
3. Start dashboard: `python3 server.py` → `http://127.0.0.1:8765/dashboard/index.html`
4. To request changes: update `docs/PLAN_FEEDBACK.md` → re-run `/solo-plan`
5. To approve: `/solo-approve` → then `/iter 1`
