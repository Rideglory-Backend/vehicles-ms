# Architect slim handoffs (token optimization)

The Architect writes four **compact** role-targeted files alongside `docs/handoffs/architect.md` during Phase 2 of `/iter N`.

| File | Primary reader | Contents (keep under ~120 lines each) |
|------|----------------|----------------------------------------|
| `architect-for-backend.md` | Backend | Repo path for API, migration tool, schema summary, each endpoint (method, path, request/response shapes, status codes), env vars, test commands, link to DIAGRAMS.md for ERD |
| `architect-for-frontend.md` | Design, Frontend | App path, API base URL env var, each endpoint from UI perspective, error JSON shape, password policy constants, CORS note |
| `architect-for-devops.md` | DevOps | Docker/compose services, CI matrix commands, health path, required secrets names, branch naming |
| `architect-for-qa.md` | QA | API base URL for tests, seed strategy, pytest/API commands, Playwright scope if any, acceptance-linked test hints |

Downstream agents read their slim file **first**. They read full `architect.md` only when the slim file says **"See full handoff"** or they hit ambiguity, schema mismatch, or blocker.

Full handoff remains the source of truth for Tech Lead review (Tech Lead may read all four slims + `DIAGRAMS.md` instead of one 30KB file when slims exist).
