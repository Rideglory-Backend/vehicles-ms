# Project skills

These files are generated automatically by the agent team and updated each iteration. They give each agent project-specific knowledge so they don't have to re-derive context from scratch every time.

## How they work

| Phase | Who generates | What goes in |
|-------|--------------|--------------|
| `/solo-plan` | Planning team (PO + Architect + Plan Reviewer) | Domain skills: business rules, personas, acceptance patterns, scope boundaries |
| Architect phase in `/iter N` | Architect | Technical skills: chosen stack, patterns, commands, conventions |
| Each subsequent iteration | Respective agent | Accumulated learnings, gotchas, evolved patterns |

## Files

| File | Loaded by | Contents |
|------|-----------|---------|
| `po-skill.md` | PO | Domain model, personas, story patterns, scope decisions |
| `architect-skill.md` | Architect | Stack decisions, repo layout, patterns, conventions |
| `design-skill.md` | Design | UX patterns, component library, copy tone, accessibility rules |
| `backend-skill.md` | Backend | API patterns, DB conventions, test patterns, env vars |
| `frontend-skill.md` | Frontend | Framework config, component patterns, API wiring, test setup |
| `qa-skill.md` | QA | Test catalog base, selectors strategy, seed data, known gotchas |
| `tech_lead-skill.md` | Tech lead | Review checklist, security patterns, known risks |
| `devops-skill.md` | DevOps | CI commands, env var names, infra decisions |

## Rules

- **Never delete** a skill file — update it. Skills are accumulative.
- **Always append a `## Change log`** entry when updating.
- **Stack-agnostic** until Architect decides the stack. Do not hardcode framework choices in domain-phase skills.
