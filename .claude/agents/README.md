# Claude agents — Rideglory

Each file is `{role}.md` with YAML frontmatter (`name`, `description`, `model`, `color`, `skills`) followed by the full playbook.

| File           | Role              | Default model |
| -------------- | ----------------- | ------------- |
| `po.md`        | Product Owner     | sonnet        |
| `architect.md` | Architect         | opus          |
| `design.md`    | Design            | sonnet        |
| `backend.md`   | API Developer     | sonnet        |
| `frontend.md`  | Flutter Developer | sonnet        |
| `qa.md`        | QA                | sonnet        |
| `tech_lead.md` | Tech Lead         | sonnet        |
| `devops.md`    | DevOps            | sonnet        |

**Flutter project context:**
- `frontend` = Flutter Developer (the "athlete") — works in `lib/` following Clean Architecture
- `backend` = API Developer — works in `/Users/cami/Developer/Personal/rideglory-api` (NestJS)
- `qa` uses `flutter test`, `dart analyze`, widget tests — no Playwright
- `devops` builds Flutter CI/CD (GitHub Actions: analyze, test, build APK/IPA)
- `tech_lead` enforces Flutter Clean Architecture + rideglory-coding-standards
