---
description: Diagnose where the last iteration stopped, then continue the SDLC from the next phase
allowed-tools: Agent, Read, Write, Bash, Glob, Grep
---

**Optional target iteration: $ARGUMENTS** (if empty, use `currentIteration` from `workflow/state.json`)

You **resume** a mid-flight iteration: validate state, show the human a clear status line, then **spawn real subagents** (via the Agent tool) for only the remaining phases — do not re-run completed phases.

Hard rule for resume diagnosis:
- Treat `workflow/state.json`, `docs/handoffs/`, `docs/handoffs/iteration_checkpoint.md`, and `workflow/artifact_log.json` as the **source of truth**.
- **Do not** run exploratory git/history inspection for diagnosis (`git log`, `git diff`, `git branch`, `git status`) unless the human explicitly asks.

---

## 1) Load and validate (you execute this directly)

1. Read `workflow/state.json`. Confirm `planStatus` is `"approved"`.
2. Let `N` = integer from **$ARGUMENTS** if present, else `currentIteration`. Confirm `iterations[]` contains an entry with `id === N`.
3. Let `iterRow` be that iteration.
   - `"done"` → stop. Iteration N is closed; suggest `/iter {N+1}` or `/solo-plan` if PRD changed.
   - `"planned"` → stop. Nothing in progress — use `/iter N` for a cold start, not resume.
   - `"active"` → proceed.

---

## 2) Determine what completed (you execute this directly)

### Canonical phase order

| Order | Phase key   | Agent     | Model  |
| ----- | ----------- | --------- | ------ |
| 1     | `po_scope`  | po        | sonnet |
| 2     | `architect` | architect | opus   |
| 3     | `design`    | design    | sonnet |
| 4     | `backend`   | backend   | sonnet |
| 5     | `frontend`  | frontend  | sonnet |
| 6     | `qa`        | qa        | sonnet |
| 7     | `devops`    | devops    | sonnet |
| 8     | `pr`        | system    | —      |
| 9     | `tech_lead` | tech_lead | sonnet |
| 10    | `po_close`  | po        | sonnet |

### Primary signal — `events[]`

Collect every event where `type === "phase_complete"` and `iteration === N`.
Build the set of completed `phase` keys from those events.

**After an iteration is fully closed**, per-phase events may have been **compressed** into a single `iteration_summary` event (token optimization). If `phase_complete` entries for `N` are missing but `iteration_summary` with `iteration === N` exists, iteration **N** is already **done** — stop and suggest `/iter {N+1}`.

### Fallback — handoffs (if phase_complete events are missing or incomplete)

Infer completion by reading `docs/handoffs/*.md` plus `docs/handoffs/iteration_checkpoint.md`:

- Substantive `po` handoff with stories for iteration N → `po_scope` complete
- Architect handoff for N → `architect` complete
- Same pattern for design, backend, frontend, qa, tech_lead, devops
- `docs/handoffs/iteration_context.md` updated for N → `po_close` complete

If ambiguous, stop and ask the human which phase to start from (list the ten phases).

### Checkpoint sync (mandatory)

Let **next** = first phase in the table above whose key is NOT in the completed set.

Update `docs/handoffs/iteration_checkpoint.md`: `## Active — Iteration N`, Last phase = last completed, Next = **next**, Phase log rebuilt from events.

### Artifact log (mandatory before spawning agents)

Read **`workflow/artifact_log.json`** (create from `scripts/templates/artifact_log.json` only if missing — normally it already exists).

1. Collect all `entries` where `iteration === N`, preserve time order (`at`).
2. Print them for the human (compact list: `at`, `phase`, `agent`, `paths`).
3. If **any** entry has `phase === next` (the phase you are about to resume) **and** that phase is **not** in the completed set from `phase_complete`, print a bold line: **Mid-phase artifact trail — review paths below before re-running or continuing `<next>`.**
4. When spawning the next subagent, **include** the printed artifact lines in the orchestrator context so the subagent knows what already exists on disk.

---

## 3) Status line for the human (print before spawning any agent)

- Iteration **N** goal (from iterRow.goal)
- Completed phases: <list or "none">
- **Next phase to resume from:** <next>
- Checkpoint: `docs/handoffs/iteration_checkpoint.md` (now synced)
- Artifact log: `workflow/artifact_log.json` (recent entries for N summarized above)

---

## 4) Git setup (minimal and non-exploratory)

If `.git` exists and branch `iter-N` exists: `git checkout iter-N`.
If `iter-N` does not exist yet (resume before branch creation): stay on current branch and continue from local evidence; do not inspect git history to infer progress.

---

## 5) Execute remaining phases as real subagents

Read `.claude/commands/iter.md` now. It contains the exact Agent spawn definition for each phase (Phase 1 through Phase 10), including the model, description, and self-contained prompt for each agent.

**Starting from the phase that matches `next`**, spawn each remaining phase's Agent call exactly as defined in `iter.md`, in canonical order. Pass `N` as the iteration number wherever `$ARGUMENTS` appears in those prompts.

Skip any phase whose key is already in the completed set. Do not re-run completed phases.

After each spawned agent completes:

- Verify its handoff file was written
- Confirm the `phase_complete` event was appended to `workflow/state.json`
- Confirm `docs/handoffs/iteration_checkpoint.md` was updated
- Confirm `workflow/artifact_log.json` has new `entries[]` for iteration N and that the completed phase paths include (at minimum) handoff + state + checkpoint + phase contract
- Run hard gates before next phase:
  - `python3 scripts/run_quality_gates.py --iteration N --phase <completed-phase>`
  - Add `--strict-drift` when CI policy requires drift to block
- Then spawn the next remaining phase

**Phase 8 (PR)** has no subagent — execute it directly as described in `iter.md` Phase 8.

---

## 6) Finalize after `po_close`

1. Set `iterations[N].status` = `"done"` in `workflow/state.json`
2. Set all `agents.*.status` = `"idle"`
3. Append event: `{ "type": "iteration_done", "iteration": N, "at": "<ISO UTC>", "agent": "system", "detail": "Iteration N complete (resumed). All phases passed." }`

---

## 7) End message

Summarize: iteration N resumed, phases that ran in this session, PR URL if applicable, next command (`/iter {N+1}` or `/solo-status`).
