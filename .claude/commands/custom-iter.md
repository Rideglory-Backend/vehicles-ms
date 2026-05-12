---
description: Run the full agent SDLC for a single improvement PRD (no commits, no PR — human reviews before approval)
allowed-tools: Agent, Read, Write, Bash, Glob, Grep
---

**Source improvement PRD: $ARGUMENTS**

You are the **Custom-Iter orchestrator**. Input is a *path* to an improvement note (e.g. `improvements/ai_agent_chat_improvements.md`). You spawn each phase as a **real subagent** via the Agent tool — each with its own model and self-contained context — wait for it to complete, then spawn the next.

This command differs from `/iter` in three critical ways:

1. **No commits, no `git push`, no `gh pr create`, no `gh pr merge`** — the entire run leaves the working tree dirty by design. The human reviews everything before committing.
2. **No mutation of `docs/PRD.md`, `docs/PLAN.md`, `docs/ITERATION_HISTORY.md`, `docs/PRODUCT_STATUS.md`, `workflow/state.json`, or `docs/handoffs/iteration_checkpoint.md`** — those belong to the iteration system. Custom-iter runs are isolated.
3. **All analysis artifacts live under `docs/custom-iters/<SLUG>/`** — a self-contained workspace per run.

Backend / Frontend agents **DO write real code changes** into the application source tree (no commit). The goal is a 100% functional implementation ready for human review, not a paper proposal.

---

## Pre-flight (you execute this directly before spawning any agent)

1. **Resolve the source PRD path:**
   - `SOURCE_PRD = $ARGUMENTS` (treat as repo-relative if not absolute).
   - Verify it exists with `test -f "$SOURCE_PRD"`. If not, stop and tell the human the exact path tried.
   - Read its contents fully (you need them in your own context for the PO briefing).
   - If the file is empty (0 bytes), stop and tell the human to write at least one sentence describing the improvement.

2. **Derive `SLUG`:**
   - Take the basename without extension, lowercase, replace `_` with `-`. Example: `improvements/ai_agent_chat_improvements.md` → `ai-agent-chat-improvements`.
   - Compute and remember this value — every downstream prompt uses it.

3. **Resolve the workspace:**
   - `WORKSPACE = docs/custom-iters/<SLUG>`
   - If `WORKSPACE` already exists: read `<WORKSPACE>/_meta.json`. If its `status` is `ready_for_human_review` or `in_progress`, **stop** and tell the human:
     - "A custom-iter run already exists at `<WORKSPACE>` (status: <status>). Either review/commit it, or delete the folder to re-run."
   - Otherwise create the workspace skeleton:
     ```bash
     mkdir -p docs/custom-iters/<SLUG>/handoffs
     mkdir -p docs/custom-iters/<SLUG>/contracts
     mkdir -p docs/custom-iters/<SLUG>/analysis
     ```

4. **Read `workflow/state.json` (read-only):**
   - Capture the `project` field — use it as **PROJECT** wherever subagent prompts below reference `<project>`. If empty, use "this project".
   - Capture `existingSystem.basePath` if present — pass to agents as **EXISTING_BASE**. If absent, agents scan the whole repo.
   - **You do NOT modify `workflow/state.json` at any point in this run.** Not at start, not on phase complete, not at the end.

5. **Check working tree state:**
   - Run `git status --short`. If there are pre-existing uncommitted changes, **warn the human** and ask whether to proceed (the run will mix its changes with theirs, making review harder). If they say no, stop. If they say yes, record the pre-existing state in `_meta.json` so the diff can be reasoned about later.

6. **Initialize `_meta.json`:**
   Write `docs/custom-iters/<SLUG>/_meta.json`:
   ```json
   {
     "slug": "<SLUG>",
     "sourcePrdPath": "<SOURCE_PRD>",
     "project": "<PROJECT>",
     "existingBase": "<EXISTING_BASE or empty string>",
     "startedAt": "<ISO UTC now>",
     "status": "in_progress",
     "phaseLog": [],
     "decisions": {
       "uiChanges": null,
       "backendChanges": null,
       "frontendChanges": null,
       "dbChanges": null,
       "needsDesign": null
     },
     "preExistingDirtyTree": <true|false>
   }
   ```

7. **Print the gate to the user before phase 1:**
   ```
   ▶ /custom-iter — <SLUG>
     source: <SOURCE_PRD>
     workspace: docs/custom-iters/<SLUG>/
     ─ no commits, no push, no PR will be made
     ─ Backend/Frontend will modify code in place; you review with `git diff` after I finish
   ```

---

## Helper: phase contract for custom-iter runs

Every phase agent writes a contract at `docs/custom-iters/<SLUG>/contracts/<phase>.json`:

```json
{
  "slug": "<SLUG>",
  "phase": "<phase_key>",
  "status": "pass|fail",
  "updatedAt": "<ISO UTC>",
  "summary": "<one-line>",
  "metrics": { "tokens": 0, "costUsd": 0.0 },
  "artifacts": ["<repo-relative path>", "..."],
  "qualityGates": [
    { "name": "required_artifacts_present", "status": "pass", "detail": "..." },
    { "name": "no_protected_files_touched",  "status": "pass", "detail": "..." }
  ]
}
```

After every phase completes, you (the orchestrator) append a row to `_meta.json` → `phaseLog`:

```json
{ "phase": "<phase_key>", "agent": "<role>", "at": "<ISO UTC>", "summary": "<one-line>" }
```

---

## Hard rules every phase agent must follow (inject these into every prompt)

```
HARD RULES — do NOT violate any of these:

1. NEVER run: `git add`, `git commit`, `git push`, `git merge`, `git rebase`, `git restore`, `git reset`, `gh pr create`, `gh pr merge`, `gh pr review`.
2. NEVER modify any of these files:
   - docs/PRD.md
   - docs/PLAN.md
   - docs/PLAN_FEEDBACK.md
   - docs/ITERATION_HISTORY.md
   - docs/PRODUCT_STATUS.md
   - docs/DEPLOY.md
   - docs/handoffs/iteration_checkpoint.md
   - docs/handoffs/iteration_context.md
   - docs/handoffs/<role>.md  (those belong to /iter; use docs/custom-iters/<SLUG>/handoffs/<role>.md instead)
   - workflow/state.json
   - workflow/artifact_log.json
   - any file under .claude/skills/
3. Write all analysis artifacts under `docs/custom-iters/<SLUG>/`.
4. Backend / Frontend agents (only) MAY modify application source code (apps/, src/, etc.) to implement the improvement. They MUST NOT commit.
5. Read your role playbook at `.claude/agents/<role>.md` for general guidance and section conventions, but the OUTPUT LOCATIONS for this run are the ones in this prompt — they OVERRIDE the playbook's default paths.
6. If something in the playbook conflicts with these rules, the rules win. Surface the conflict in your handoff under `## Notes for orchestrator`.
7. End your run by writing the phase contract at `docs/custom-iters/<SLUG>/contracts/<phase>.json` with status `pass` or `fail`. Do not write a summary event to workflow/state.json.
```

---

## Phase 1 — PO normalize | model: sonnet

Spawn an Agent with:

- **description:** `"[PO / sonnet] — normalize improvement PRD for <SLUG>"`
- **model:** `"sonnet"`
- **prompt:**

```
You are the Product Owner agent for a /custom-iter run on the <project> project.

Slug: <SLUG>
Source improvement note: <SOURCE_PRD>
Workspace: docs/custom-iters/<SLUG>/

<HARD RULES BLOCK — paste verbatim>

CONTEXT — read in this order:
1. <SOURCE_PRD> — read in full, multiple times if short and ambiguous. This is the raw input from the human.
2. docs/PRD.md — read in full. Inherit constraints (auth, stack, security, performance budgets). Do NOT modify it.
3. .claude/agents/po.md — sections [general] and [po_scope] for tone and output style. IGNORE its output paths; use the workspace paths below.
4. scripts/templates/improvement-prd.md — the canonical structure you will fill into PRD_NORMALIZED.md.
5. The project's actual code, focused on the areas the source note mentions. For every area you list in PRD § 4 (Affected areas), you MUST have opened the relevant file(s) — no claims from memory.
6. docs/handoffs/iteration_context.md — read-only, to understand what was just shipped (do NOT modify).
7. workflow/state.json — read-only, to know the project name + existingSystem.basePath. Do NOT modify.

YOUR WORK:
1. Read the source note thoroughly. Identify the core ask in one sentence.
2. Classify the improvement type (fix | improvement | feature_addition | refactor | redesign) and severity (low | medium | high | critical). Be honest — if the source says "mega refactor", severity is high or critical.
3. Walk the repo to map every claim to a real file. For each "affected area" the note mentions, locate the current implementation. Open it. Read the relevant code. Note the file paths.
4. Fill `scripts/templates/improvement-prd.md` into `docs/custom-iters/<SLUG>/PRD_NORMALIZED.md`. Every section must be filled — no placeholders. § 4 (Affected areas) must list real file paths you opened. § 7 (Regression guardrails) must list at least one item per area you touch.
5. Write `docs/custom-iters/<SLUG>/handoffs/po.md` containing:
   - `## Goal`: one sentence
   - `## Source quote`: the raw text of the source note
   - `## Interpretation`: how you read it (especially for short / vague notes)
   - `## Affected areas — current state`: same table as PRD § 4 but with deeper notes (line numbers when useful)
   - `## Acceptance criteria`: numbered AC list (same as PRD § 6)
   - `## Regression guardrails`: same as PRD § 7 but with verification steps the QA agent can act on
   - `## Decisions needed from downstream agents`: questions for Architect/Design/Backend/Frontend that you couldn't answer yourself
   - `## Open questions for the human`: copy from PRD § 9
   - `## Suggested phase plan`: which phases this run should include — set hints for orchestrator like `needsDesign: yes/no`, `needsBackend: yes/no`, `needsFrontend: yes/no`, `needsDb: yes/no`. The orchestrator uses these to skip irrelevant phases.
   - `## Notes for orchestrator`: anything else.
6. Update `docs/custom-iters/<SLUG>/_meta.json`:
   - Set `decisions.uiChanges`, `decisions.backendChanges`, `decisions.frontendChanges`, `decisions.dbChanges`, `decisions.needsDesign` to true/false based on your analysis.
   - Append a phaseLog row for "po".
7. Write the phase contract `docs/custom-iters/<SLUG>/contracts/po.json` (status pass if all required artifacts written).

REQUIRED OUTPUTS (must all exist before you finish):
- docs/custom-iters/<SLUG>/PRD_NORMALIZED.md
- docs/custom-iters/<SLUG>/handoffs/po.md
- docs/custom-iters/<SLUG>/contracts/po.json
- docs/custom-iters/<SLUG>/_meta.json (updated with decisions + phaseLog entry)

DO NOT:
- Touch docs/PRD.md or any iteration files.
- Touch workflow/state.json.
- Commit or stage anything.
```

Wait for PO to complete. Verify the four required outputs exist. If `PRD_NORMALIZED.md` § 9 has unresolved questions, **stop and surface them to the human now** before continuing — they may decide to answer or to let the assumption stand. Re-spawn PO only if they want a re-write.

Read `_meta.json` → `decisions` to know which downstream phases to spawn.

---

## Phase 2 — Architect | model: opus

Spawn an Agent with:

- **description:** `"[Architect / opus] — change map for <SLUG>"`
- **model:** `"opus"`
- **prompt:**

```
You are the Architect agent for the /custom-iter run on <SLUG> (project: <project>).

Workspace: docs/custom-iters/<SLUG>/

<HARD RULES BLOCK — paste verbatim>

CONTEXT — read in this order:
1. docs/custom-iters/<SLUG>/PRD_NORMALIZED.md — read in full. This is the source of truth for this run.
2. docs/custom-iters/<SLUG>/handoffs/po.md — read in full.
3. docs/custom-iters/<SLUG>/_meta.json — read the `decisions` block.
4. .claude/agents/architect.md — sections [general] and [impl]. IGNORE its default output paths; use workspace paths below.
5. docs/PRD.md — read in full for inherited constraints. Do NOT modify.
6. docs/architecture/DIAGRAMS.md — current ERD / flows. Do NOT modify the global file; if your change requires diagram updates, propose them in a NEW file `docs/custom-iters/<SLUG>/analysis/DIAGRAMS_PROPOSED.md`. The human can later merge into the global file.
7. docs/handoffs/architect.md — read-only, to know existing architectural decisions. Do NOT modify.
8. .claude/skills/architect-skill.md — read-only.
9. The actual code at every path PO listed in PRD § 4. Open each. Trace dependencies.

YOUR WORK:
1. Produce a **change map**: every file you propose to modify or create, with one-line "what changes and why". Include data migrations, env vars, contracts. This is the master list — Backend/Frontend will only touch files that appear here.
2. Identify **risks**:
   - Breaking-change risk per file (API consumers? DB read paths? component callers?)
   - Backward-compatibility constraints
   - Performance impact
   - Security impact
3. Define the **regression test surface**: which existing tests cover the changed code today; whether they're enough to detect regressions or need extension. QA reads this.
4. If schema / migration is needed (decisions.dbChanges == true): write the migration plan and propose the SQL/ORM diff in `analysis/MIGRATION_PLAN.md`. Do NOT execute migrations.
5. If new env vars / config required: list them. Do NOT write to `.env.example` directly — propose the lines in `analysis/ENV_DELTA.md`.
6. Write slim handoffs (≤120 lines each):
   - `docs/custom-iters/<SLUG>/handoffs/architect-for-backend.md` (only if decisions.backendChanges)
   - `docs/custom-iters/<SLUG>/handoffs/architect-for-frontend.md` (only if decisions.frontendChanges)
   - `docs/custom-iters/<SLUG>/handoffs/architect-for-qa.md`
   Each starts with: `> Slim handoff for /custom-iter <SLUG>. Full detail in architect.md (read only if ambiguous).`
7. Write `docs/custom-iters/<SLUG>/handoffs/architect.md` containing:
   - `## Goal acknowledgement`: confirm you understood the goal
   - `## Change map`: table — file | action (modify|create|delete) | one-line reason | risk level (low|med|high)
   - `## Data model impact`: ERD delta, migration sketch, or "none"
   - `## Contract impact`: API request/response/error changes (per endpoint), or "none"
   - `## Env / config delta`: new vars, default values, or "none"
   - `## Risk register`: numbered list of risks + mitigation strategy
   - `## Regression test surface`: which existing tests cover the touched code; gaps to fill
   - `## Implementation order`: ordered list of steps Backend/Frontend should follow (dependencies between files)
   - `## Out of scope`: what you intentionally did NOT change, with rationale
   - `## Notes for orchestrator`: any decision flips (e.g. "PO said no backend, but I found backend changes are required" → orchestrator must update `_meta.json.decisions` and run the backend phase).
8. Update `docs/custom-iters/<SLUG>/_meta.json`:
   - If you discovered the run actually needs a phase PO said it didn't (or vice versa), flip the boolean and document it in `## Notes for orchestrator`.
   - Append phaseLog row for "architect".
9. Write phase contract `docs/custom-iters/<SLUG>/contracts/architect.json`.

REQUIRED OUTPUTS:
- docs/custom-iters/<SLUG>/handoffs/architect.md
- docs/custom-iters/<SLUG>/handoffs/architect-for-backend.md (if applicable)
- docs/custom-iters/<SLUG>/handoffs/architect-for-frontend.md (if applicable)
- docs/custom-iters/<SLUG>/handoffs/architect-for-qa.md
- docs/custom-iters/<SLUG>/analysis/MIGRATION_PLAN.md (if dbChanges)
- docs/custom-iters/<SLUG>/analysis/ENV_DELTA.md (if env changes)
- docs/custom-iters/<SLUG>/analysis/DIAGRAMS_PROPOSED.md (if diagrams change)
- docs/custom-iters/<SLUG>/contracts/architect.json
- docs/custom-iters/<SLUG>/_meta.json (updated)

DO NOT:
- Modify the global docs/architecture/DIAGRAMS.md.
- Modify .env.example, migrations directories, or any application code.
- Touch workflow/state.json.
- Commit anything.
```

Wait for Architect to complete. Read `_meta.json` → `decisions` again — Architect may have flipped flags. Use the resulting decisions to choose downstream phases.

---

## Phase 3 — Design | model: sonnet  *(conditional)*

**Skip this phase if** `_meta.json.decisions.needsDesign === false` AND `decisions.uiChanges === false`. Log skip reason to `_meta.json.phaseLog`.

Otherwise spawn an Agent with:

- **description:** `"[Design / sonnet] — UX for <SLUG>"`
- **model:** `"sonnet"`
- **prompt:**

```
You are the Design agent for /custom-iter <SLUG> (project: <project>).

Workspace: docs/custom-iters/<SLUG>/

<HARD RULES BLOCK — paste verbatim>

CONTEXT — read in this order:
1. docs/custom-iters/<SLUG>/PRD_NORMALIZED.md
2. docs/custom-iters/<SLUG>/handoffs/po.md
3. docs/custom-iters/<SLUG>/handoffs/architect.md (full)
4. docs/custom-iters/<SLUG>/handoffs/architect-for-frontend.md (if present)
5. .claude/agents/design.md — sections [general] and [impl]. Output paths below override defaults.
6. .claude/skills/design-skill.md — read-only, to keep tokens / components consistent.
7. docs/design/ (read-only) — existing screen inventory, html-mockups, pencil files. Do NOT modify global design files; produce new artifacts under the workspace.
8. The actual screens / components Architect's change map lists.

YOUR WORK:
1. Identify which screens/components are touched. For each: classify NEW | EXTEND | UPDATE.
2. Document UX states (idle, loading, success, every error) for each touched screen.
3. List components needed (reuse existing where possible — name them).
4. UI copy: every new label, placeholder, error, button text. Match existing tone (sample 2-3 existing screens to anchor tone).
5. Accessibility: keyboard, labels, contrast.
6. If Pencil MCP is available: use it to update / create screens. Save exports under `docs/custom-iters/<SLUG>/analysis/design/pencil/`. Do NOT modify global `.pen` files unless the architect handoff explicitly authorizes it — prefer creating a parallel design doc.
7. If Pencil MCP unavailable: build styled HTML mockups under `docs/custom-iters/<SLUG>/analysis/design/html-mockups/`. Copy CSS tokens from the most recent existing mockup folder to stay visually consistent.
8. Write `docs/custom-iters/<SLUG>/handoffs/design.md`:
   - `## Touched screens` — classified table
   - `## UX flows` — per screen states
   - `## Components` — reused vs new
   - `## Copy` — full list
   - `## Accessibility checklist`
   - `## Tool used` — Pencil | HTML mockups | both. Path to artifacts.
   - `## Notes for Frontend` — anything Frontend must know to implement faithfully.
9. Update `_meta.json.phaseLog`. Write `contracts/design.json`.

DO NOT:
- Write code into apps/web. That's Frontend's job.
- Modify global design files unless explicitly authorized in architect.md.
- Commit anything.
```

Wait for Design to complete.

---

## Phase 4 — Backend | model: sonnet  *(conditional)*

**Skip this phase if** `_meta.json.decisions.backendChanges === false`. Log skip reason.

Otherwise spawn an Agent with:

- **description:** `"[Backend / sonnet] — implement <SLUG>"`
- **model:** `"sonnet"`
- **prompt:**

```
You are the Backend agent for /custom-iter <SLUG> (project: <project>).

Workspace: docs/custom-iters/<SLUG>/

<HARD RULES BLOCK — paste verbatim>

⚠️ YOU WILL MODIFY APPLICATION SOURCE CODE in this phase. You will NOT commit it. The human reviews `git diff` after the entire run completes. Your job is to leave the working tree containing a correct, complete, tested implementation.

CONTEXT — read in this order:
1. docs/custom-iters/<SLUG>/PRD_NORMALIZED.md
2. docs/custom-iters/<SLUG>/handoffs/po.md
3. docs/custom-iters/<SLUG>/handoffs/architect-for-backend.md (read first, then architect.md only if ambiguous)
4. docs/custom-iters/<SLUG>/analysis/MIGRATION_PLAN.md (if present)
5. docs/custom-iters/<SLUG>/analysis/ENV_DELTA.md (if present)
6. .claude/agents/backend.md — sections [general] and [impl]. Output paths below override.
7. .claude/skills/backend-skill.md — read-only.
8. The current backend code at every path in the architect's change map. Open each before editing.
9. Existing tests for the touched modules — run them first to confirm green baseline:
   `cd <backend path>` then run the project's test command (the Architect handoff specifies it; if not, use the project's documented one).

YOUR WORK:
1. **Baseline check:** run existing backend tests. Record the result. If they fail BEFORE your changes, stop and report to orchestrator — do not pile changes on a broken baseline.
2. Apply changes file-by-file in the order specified in `architect.md § Implementation order`.
3. If migrations: write the migration file(s) at the path Architect specified. Do NOT run them against any prod-like environment. Run them locally only if the project's dev setup allows.
4. Apply env var changes by adding lines to `.env.example` (only if architect's ENV_DELTA says so). NEVER touch real `.env` files.
5. Implement endpoints / business logic / DB calls per the architect's contract.
6. Validate inputs. Return exact response shapes per contract. Hash passwords if relevant. Parameterize SQL.
7. Add or update unit + integration tests for every new code path. Add regression tests for every item in PRD § 7 (Regression guardrails) that maps to backend behavior.
8. Run the full backend test suite. Every test must pass. If a test fails:
   - If your change broke it: fix the test or the code (whichever is correct per PRD).
   - If the test was already broken (per baseline above): document in handoff § Pre-existing failures and continue.
9. Write `docs/custom-iters/<SLUG>/handoffs/backend.md`:
   - `## Baseline test result` — green | red (+ details if red)
   - `## Files changed` — full list with one-line per file: "what changed"
   - `## New tests added` — list, mapped to AC and guardrail IDs
   - `## Final test result` — pass count, fail count (must be 0), command used
   - `## Manual verification steps` — how the human can spot-check the implementation (curl examples, sample requests)
   - `## Notes for Frontend` — any contract subtleties Frontend must know
   - `## Notes for QA` — anything QA must specifically probe
   - `## Pre-existing failures` (if any) — tests that were red before your changes, with PR-ready note
10. Update `_meta.json.phaseLog`. Write `contracts/backend.json` with status pass only if final test result is green.

REQUIRED OUTPUTS:
- All code changes in the application path (UNCOMMITTED)
- docs/custom-iters/<SLUG>/handoffs/backend.md
- docs/custom-iters/<SLUG>/contracts/backend.json
- Updated _meta.json

DO NOT:
- Commit anything. Not even with --no-verify.
- Modify files outside the architect's change map. If you discover a needed change not in the map, document it in handoff § Notes for orchestrator and stop that file's edit — orchestrator may re-run Architect for an updated map.
- Touch frontend code (frontend phase will handle).
- Touch workflow/state.json or .claude/skills/*.
```

Wait for Backend to complete. If `contracts/backend.json.status === "fail"`, stop and surface to human — do not continue to Frontend on a broken backend.

---

## Phase 5 — Frontend | model: sonnet  *(conditional)*

**Skip this phase if** `_meta.json.decisions.frontendChanges === false`. Log skip reason.

Otherwise spawn an Agent with:

- **description:** `"[Frontend / sonnet] — implement <SLUG>"`
- **model:** `"sonnet"`
- **prompt:**

```
You are the Frontend agent for /custom-iter <SLUG> (project: <project>).

Workspace: docs/custom-iters/<SLUG>/

<HARD RULES BLOCK — paste verbatim>

⚠️ YOU WILL MODIFY APPLICATION SOURCE CODE. You will NOT commit. Working tree must end up containing a correct, complete, tested implementation.

CONTEXT — read in this order:
1. docs/custom-iters/<SLUG>/PRD_NORMALIZED.md
2. docs/custom-iters/<SLUG>/handoffs/po.md
3. docs/custom-iters/<SLUG>/handoffs/architect-for-frontend.md (read first; full architect.md only if ambiguous)
4. docs/custom-iters/<SLUG>/handoffs/design.md (if Design phase ran)
5. docs/custom-iters/<SLUG>/handoffs/backend.md (if Backend phase ran — for contract specifics)
6. docs/custom-iters/<SLUG>/analysis/design/ (if Design produced mockups)
7. .claude/agents/frontend.md — sections [general] and [impl]. Output paths below override.
8. .claude/skills/frontend-skill.md — read-only.
9. The current frontend code at every path in the architect's change map. Open each before editing.
10. Existing frontend tests — run for a green baseline before touching anything.

YOUR WORK:
1. **Baseline check:** run frontend tests. Record result.
2. Apply changes file-by-file per architect's implementation order.
3. Wire API using the env var base URL pattern Architect specified (never hardcode URLs).
4. Implement all UI states (idle, loading, success, every error). Match Design handoff exactly for copy / components.
5. Client-side validation must mirror server-side rules.
6. Add or update component / integration tests for every new code path. Add regression tests for guardrails that map to frontend behavior.
7. Run full frontend test suite. Must end green.
8. Write `docs/custom-iters/<SLUG>/handoffs/frontend.md`:
   - `## Baseline test result`
   - `## Files changed`
   - `## New tests added`
   - `## Final test result`
   - `## Manual verification steps` — how to run the dev server and exercise the new behavior end-to-end
   - `## Notes for QA`
   - `## Pre-existing failures` (if any)
9. Update _meta.json.phaseLog. Write contracts/frontend.json.

REQUIRED OUTPUTS:
- Code changes (UNCOMMITTED)
- docs/custom-iters/<SLUG>/handoffs/frontend.md
- docs/custom-iters/<SLUG>/contracts/frontend.json
- Updated _meta.json

DO NOT:
- Commit anything.
- Modify files outside the architect's change map without surfacing.
- Touch backend code (Backend phase handled it).
- Touch workflow/state.json or .claude/skills/*.
```

Wait for Frontend to complete. If `contracts/frontend.json.status === "fail"`, stop and surface to human.

---

## Phase 6 — QA | model: sonnet

Spawn an Agent with:

- **description:** `"[QA / sonnet] — verify <SLUG>"`
- **model:** `"sonnet"`
- **prompt:**

```
You are the QA agent for /custom-iter <SLUG> (project: <project>).

Workspace: docs/custom-iters/<SLUG>/

<HARD RULES BLOCK — paste verbatim>

CONTEXT — read in this order:
1. docs/custom-iters/<SLUG>/PRD_NORMALIZED.md (especially § 6 AC and § 7 Regression guardrails)
2. docs/custom-iters/<SLUG>/handoffs/po.md
3. docs/custom-iters/<SLUG>/handoffs/architect-for-qa.md (read first; full architect.md only if needed)
4. docs/custom-iters/<SLUG>/handoffs/backend.md (if Backend ran)
5. docs/custom-iters/<SLUG>/handoffs/frontend.md (if Frontend ran)
6. docs/custom-iters/<SLUG>/handoffs/design.md (if Design ran)
7. .claude/agents/qa.md — sections [general] and [impl]. Output paths below override.
8. .claude/skills/qa-skill.md — read-only.
9. The actual code changes in the working tree (run `git diff --stat` to scope your review).

YOUR WORK:
1. Build a **test catalog** mapping each Acceptance Criterion in PRD § 6 → tests that cover it (existing tests, new tests by Backend/Frontend, gaps).
2. Build a **regression matrix** mapping each item in PRD § 7 → verification: existing test | new test added | manual probe needed.
3. Run the full test suite (backend + frontend + any e2e). Record results. For each failure:
   - If it's pre-existing (in any baseline noted by Backend/Frontend): mark as `pre_existing` and continue.
   - If it's a regression caused by this run: file a BUG entry in your handoff § Bugs found, identify the responsible agent (backend|frontend), and surface to orchestrator.
4. If Playwright MCP is available and the change is user-facing, run a basic E2E probe covering at least the primary acceptance criterion.
5. Verify the manual verification steps in backend.md / frontend.md actually work end-to-end. Walk through them yourself.
6. Write `docs/custom-iters/<SLUG>/handoffs/qa.md`:
   - `## Test catalog` — table: AC-N | test ids covering it | pass/fail
   - `## Regression matrix` — table: guardrail | mechanism (existing test | new test | manual) | result (pass | manual_verify_needed | fail)
   - `## Test execution` — exact commands and results (counts)
   - `## Bugs found` — file/line + which agent should fix
   - `## Manual probes for human` — anything not covered by automation; the human runs these from the review checklist
   - `## How to verify` — copy-paste commands the human runs from REVIEW_CHECKLIST step 5
   - `## Sign-off` — green | blocked | conditional (+ reason)
7. Update _meta.json.phaseLog. Write contracts/qa.json with status = pass only if Sign-off is green or conditional with documented deferrals.

REQUIRED OUTPUTS:
- docs/custom-iters/<SLUG>/handoffs/qa.md
- docs/custom-iters/<SLUG>/contracts/qa.json
- Updated _meta.json
- Any new test files added under the test paths the Architect specified (UNCOMMITTED)

DO NOT:
- Commit.
- Mark sign-off green if any non-pre-existing test is failing.
- Touch workflow/state.json or .claude/skills/*.
```

Wait for QA to complete. Then:

1. Read `handoffs/qa.md` § Sign-off and § Bugs found.
2. If Sign-off is **blocked** with bugs assigned to backend/frontend:
   - Spawn a Backend or Frontend **fix agent** (same prompt as the original phase, prepend: "FIX MODE — read `docs/custom-iters/<SLUG>/handoffs/qa.md` § Bugs found. Fix ONLY those items. Do not re-scaffold. Run tests. Do not commit.").
   - Re-spawn QA after the fix.
   - **Two-cycle cap.** If after two fix+re-QA rounds bugs remain, stop and surface to the human. Do not call sign-off green over the QA agent.

---

## Phase 7 — Tech Lead | model: sonnet

Spawn an Agent with:

- **description:** `"[Tech Lead / sonnet] — review <SLUG>"`
- **model:** `"sonnet"`
- **prompt:**

```
You are the Tech Lead for /custom-iter <SLUG> (project: <project>).

There is NO Pull Request. You review the working tree directly via `git diff`. Same security and architecture standards as a /iter Tech Lead review, just no PR comments.

Workspace: docs/custom-iters/<SLUG>/

<HARD RULES BLOCK — paste verbatim>

CONTEXT — read in this order:
1. docs/custom-iters/<SLUG>/PRD_NORMALIZED.md
2. docs/custom-iters/<SLUG>/handoffs/po.md
3. docs/custom-iters/<SLUG>/handoffs/architect.md (and slim variants)
4. docs/custom-iters/<SLUG>/handoffs/design.md (if present)
5. docs/custom-iters/<SLUG>/handoffs/backend.md (if present)
6. docs/custom-iters/<SLUG>/handoffs/frontend.md (if present)
7. docs/custom-iters/<SLUG>/handoffs/qa.md
8. .claude/agents/tech_lead.md — sections [general] and [impl]. Output paths below override.
9. .claude/skills/tech_lead-skill.md — read-only.
10. The full diff of the working tree: `git diff` and `git diff --stat`. Read EVERY changed file in full.
11. `git status --short` — confirm nothing is committed (it shouldn't be).

YOUR WORK:
- Walk every diff hunk against the architect's change map. Flag any file not in the map.
- Security sweep: no secrets committed, no SQL string concat, no XSS sinks, no PII in logs, auth respected, CORS respected.
- Architecture adherence: repo layout intact, env vars used (no hardcoded URLs), API shape matches contract, ERD vs migration consistent.
- Test adequacy: every AC has a test that would fail without the change; not trivially-true assertions.
- Regression risk: read `qa.md § Regression matrix` and confirm no `fail` rows. For `manual_verify_needed` rows, list them clearly so the human runs them.
- Verify HARD RULES were followed: no git commits, no PR creation, no touches to protected files. If any rule was violated, status = needs_changes.

Write `docs/custom-iters/<SLUG>/handoffs/tech_lead.md`:
- `## Verdict` — ready_for_human_review | needs_changes
- `## Files reviewed` — full list from git diff --stat
- `## Findings` — table: file:line | severity (blocker|major|minor|nit) | issue | required fix
- `## Security findings` — separate section
- `## Architecture adherence` — pass/fail per item
- `## Test adequacy` — pass/fail per AC
- `## Regression risk summary` — pass | needs_human_verify | fail
- `## Manual probes the human must run before commit`
- `## Limitations / known-edge-cases the human should be aware of`
- `## Recommended commit message` — for the human to copy when they decide to commit

Update _meta.json.phaseLog. Write contracts/tech_lead.json.

DO NOT:
- Commit anything.
- Open a PR. There is no PR in /custom-iter.
- Modify code yourself. If you find an issue, set verdict = needs_changes and let the orchestrator spawn a fix agent.
```

Wait for Tech Lead to complete. Then:

1. Read `handoffs/tech_lead.md § Verdict`.
2. If **needs_changes** with blocker / major findings:
   - For backend findings: spawn a Backend fix agent (same Phase 4 prompt, prepend: "TECH LEAD FIX MODE — read `docs/custom-iters/<SLUG>/handoffs/tech_lead.md § Findings`. Fix the listed items only. No commits.")
   - For frontend findings: same for Phase 5.
   - Re-spawn Tech Lead.
   - **Two-cycle cap.** If unresolved after two cycles, stop and surface to the human.
3. Only proceed when Verdict = `ready_for_human_review`.

---

## Phase 8 — PO close-out | model: sonnet

Spawn an Agent with:

- **description:** `"[PO / sonnet] — close-out for <SLUG>"`
- **model:** `"sonnet"`
- **prompt:**

```
You are the PO agent closing out the /custom-iter run for <SLUG>.

There is no commit, no PR, no merge. Your job is to produce the human's review checklist and a final summary.

Workspace: docs/custom-iters/<SLUG>/

<HARD RULES BLOCK — paste verbatim>

CONTEXT:
1. docs/custom-iters/<SLUG>/PRD_NORMALIZED.md
2. All handoffs in docs/custom-iters/<SLUG>/handoffs/
3. All contracts in docs/custom-iters/<SLUG>/contracts/
4. docs/custom-iters/<SLUG>/_meta.json
5. scripts/templates/custom-iter-review-checklist.md — the template you'll fill into REVIEW_CHECKLIST.md
6. `git diff --stat` and `git status --short` — capture the working-tree state

YOUR WORK:
1. Fill the review checklist template into `docs/custom-iters/<SLUG>/REVIEW_CHECKLIST.md`. Replace every `<...>` placeholder. The Phase chain comes from `_meta.json.phaseLog`. Optional follow-ups are collected from every handoff's "Notes" / "Out of scope" / "Follow-ups" sections.
2. Write `docs/custom-iters/<SLUG>/SUMMARY.md`:
   - `## Goal` (from PRD § 2)
   - `## What changed` — bulleted list of high-level changes, grouped by area
   - `## Files modified` — output of `git diff --stat`
   - `## Tests` — counts from QA handoff
   - `## Risks / regression watchlist` — anything Tech Lead flagged as needs_human_verify
   - `## Recommended commit message` — copy from tech_lead handoff
   - `## Workspace files to keep` — confirm `docs/custom-iters/<SLUG>/` should be committed with the change as part of the analysis trail
3. Update `_meta.json`:
   - `status: "ready_for_human_review"`
   - `completedAt: "<ISO UTC>"`
   - Append final phaseLog row for "po_close".
4. Write `contracts/po_close.json`.

REQUIRED OUTPUTS:
- docs/custom-iters/<SLUG>/REVIEW_CHECKLIST.md
- docs/custom-iters/<SLUG>/SUMMARY.md
- docs/custom-iters/<SLUG>/contracts/po_close.json
- Updated _meta.json

DO NOT:
- Touch product-level docs (PRD.md, PLAN.md, ITERATION_HISTORY.md, PRODUCT_STATUS.md).
- Touch workflow/state.json or .claude/skills/*.
- Commit.
```

Wait for PO close-out to complete.

---

## Final wrap-up (you execute this directly)

1. Verify the workspace contains all required artifacts. Minimum tree:
   ```
   docs/custom-iters/<SLUG>/
     _meta.json (status: ready_for_human_review)
     PRD_NORMALIZED.md
     SUMMARY.md
     REVIEW_CHECKLIST.md
     handoffs/po.md
     handoffs/architect.md
     handoffs/[architect-for-*.md when applicable]
     handoffs/[design.md if Design ran]
     handoffs/[backend.md if Backend ran]
     handoffs/[frontend.md if Frontend ran]
     handoffs/qa.md
     handoffs/tech_lead.md
     contracts/<phase>.json (one per phase that ran)
     analysis/* (any extra artifacts agents produced)
   ```

2. Run `git status --short` and `git diff --stat`. Print both to the user.

3. Print the final report to the user (one block):
   ```
   ▶ /custom-iter — <SLUG> complete (status: ready_for_human_review)
     workspace : docs/custom-iters/<SLUG>/
     phases    : <phase chain from _meta.json>
     verdict   : <ready_for_human_review|needs_changes>  ← from tech_lead.md
     test sign-off: <green|conditional|blocked>          ← from qa.md
     working tree: <N> files changed (run `git diff` to inspect)

   Next steps for you:
   1. Open docs/custom-iters/<SLUG>/REVIEW_CHECKLIST.md and walk it top-to-bottom.
   2. If accepted: commit the working tree with your own message. Recommended message is in docs/custom-iters/<SLUG>/SUMMARY.md § Recommended commit message.
   3. If rejected: `git restore .` to discard, then `rm -rf docs/custom-iters/<SLUG>/` and re-run with an edited source note.

   This run did NOT touch: docs/PRD.md, docs/PLAN.md, docs/ITERATION_HISTORY.md, docs/PRODUCT_STATUS.md, workflow/state.json, .claude/skills/.
   ```

4. Do NOT run `git commit`, `git push`, or `gh pr create`. Ever. Even if it feels obvious. The human commits.
