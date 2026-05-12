---
description: Print current workflow state and suggest next command
---

Read `workflow/state.json` and all files in `docs/handoffs/`. Summarize:

1. **Current iteration** and its goal (from `currentIteration` + `iterations[]`).
2. **Resume hint:** scan `events[]` for `type === "phase_complete"` on the active iteration. Report **last completed `phase`** (`po_scope` … `po_close`) and the **next phase** in sequence. If iteration status is `active` but work stalled, suggest **`/resume-iter`** (or `/resume-iter N`).
3. **Each agent's status** and last action.
4. **Open tasks** (not `done`) — grouped by agent.
5. **Open bugs** (`BUG-*` tasks).
6. **Last 5 events** from the event log.
7. **Suggested next command** — e.g. `/iter N` (cold start, `planned`), `/resume-iter` (`active` and incomplete), or a targeted `/solo-*` if blocked.

Optional note: $ARGUMENTS
