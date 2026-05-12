---
description: Approve the iteration plan, generate domain skills, and unlock /iter N execution
---

Read `docs/PLAN.md`, `docs/PRD.md`, and `workflow/state.json`.

1. Confirm `planStatus` is `"awaiting_approval"`. If not: stop and tell the human to run `/solo-plan` first.

2. If $ARGUMENTS is non-empty, treat it as a last-minute note:
   - Write it to `docs/PLAN_FEEDBACK.md` under a new `## Last-minute note before approval` section.
   - Assess whether it requires a full re-plan (`/solo-plan`) or is minor enough to incorporate directly. State your conclusion clearly.
   - If re-plan is needed: set `planStatus` back to `"awaiting_approval"`, tell the human to re-run `/solo-plan`, and stop.

3. **Generate domain-level skills for all 8 agents** now that the plan is locked. Use `.claude/skills/_template.md` as the base structure. These are **domain skills only** (stack-agnostic). Extract from the PRD and the approved plan:

   **`po-skill.md`**: Product domain summary, personas, recurring acceptance pattern, out-of-scope items, story writing conventions.

   **`architect-skill.md`**: PRD constraints affecting stack, known integrations, quality expectations, risks with architectural implications.

   **`design-skill.md`**: Personas + UX expectations, tone/copy style, key UX rules, which iterations need design work.

   **`backend-skill.md`**: Server-side business rules, security requirements, observability, API design style.

   **`frontend-skill.md`**: User-facing behavior, accessibility, complex state management stories, backend integration surface.

   **`qa-skill.md`**: All acceptance criteria from all iterations, security test cases, definition of done patterns, edge cases.

   **`tech_lead-skill.md`**: Security checklist, success criteria → reviewable properties, assumptions to validate, risks for extra scrutiny.

   **`devops-skill.md`**: Infra constraints, operability requirements, CI requirements.

   Write each file to `.claude/skills/{role}-skill.md`. If a file already exists, **update** it (append to change log, do not overwrite prior entries).

4. Set `planStatus` to `"approved"` in `workflow/state.json`.

5. Clear `docs/PLAN_FEEDBACK.md` back to its template state (placeholder content only).

6. Append event: `type: plan_approved`, `detail: "Plan approved. N iterations locked. Domain skills generated."`.

7. If `.git` exists, create **all planned iteration branches** now (idempotent):
   - Collect all `iterations[]` entries with `status: "planned"` ordered by `id`. If none found, warn the human ("no planned iterations — run `/solo-plan` first") and skip this step.
   - For **each** planned iteration with id = `K`:
     - If `iter-K` already exists locally: skip (idempotent).
     - Else: `git checkout -b iter-K` from current HEAD, then return to HEAD.
   - After creating all branches: `git checkout iter-<first-planned-id>` (the branch for the first iteration to run).
   - This is the **only place** iteration branches are created. `/iter N` will check out `iter-N` but never creates it; if `iter-N` is missing at `/iter` time, the pre-flight will stop and tell the human to re-run `/solo-approve`.

8. Print confirmation:
   - Each iteration: ID + goal (one line).
   - Confirmation: domain skills generated in `.claude/skills/` (technical skills will be added by Architect in iteration 1).
   - Confirmation: iteration branches created (list all `iter-K` branch names).
   - Instruction: run `/iter <first-planned-id>` to start building.

Optional last-minute note: $ARGUMENTS
