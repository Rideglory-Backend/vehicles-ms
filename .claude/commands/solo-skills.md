---
description: Refresh agent skills from current state — use after PRD change, major re-plan, or mid-project pivot
---

You are performing a **skill refresh** for all agents. Skills are the accumulated project knowledge each agent pre-loads before working. This command regenerates them from current state without running a full plan or iteration.

**Step 1 — Read everything:**
1. `docs/PRD.md`
2. `docs/PLAN.md` (if exists)
3. `docs/handoffs/architect.md` (if exists) — source of truth for stack decisions
4. All files in `docs/handoffs/` (if they exist)
5. `workflow/state.json`
6. All existing `.claude/skills/*.md` files

**Step 2 — Assess what has changed:**
- Has the PRD changed? → Update domain context in all skills.
- Has the Architect handoff changed? → Update technical context in all skills.
- Have iterations been completed? → Add learnings and gotchas from handoffs.
- Was this triggered by a pivot or re-plan? → Note it in each skill's change log.

**Step 3 — Update each skill file:**

For each `.claude/skills/{role}-skill.md`:
- Keep all prior content.
- Update sections that are now outdated.
- Add new learnings under **Gotchas and learnings** if any handoffs contain useful discoveries.
- Append to `## Change log`: `{date}: Skills refreshed by /solo-skills — reason: {reason from $ARGUMENTS or inferred}.`

**Step 4 — Report:**
- List which skill files were updated and what changed in each.
- Flag any skills that could not be fully updated due to missing information (e.g. Architect handoff not yet written).

Optional reason for refresh: $ARGUMENTS
