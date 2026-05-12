# Architecture diagrams (review-friendly)

**Owner:** Architect · **Formats:** [Mermaid](https://mermaid.js.org/) (primary) — renders on GitHub and in many editors; agents can diff and reason over the source.

Update this file whenever the **data model**, **service boundaries**, or **critical flows** change. Keep diagrams **small**; split into additional sections or linked files if one diagram exceeds ~40 lines.

---

## How to review

| Diagram | What to check |
|---------|----------------|
| **ERD** | Tables, PK/FK, cardinality vs migrations and ORM models |
| **Context / containers** | Matches repo layout and deploy units (`docker-compose`, CI) |
| **Sequence** | Matches implemented API calls and error paths |

Optional: duplicate the schema in **`schema.dbml`** (same folder) for [dbdiagram.io](https://dbdiagram.io) import during human reviews — not required for agents if the Mermaid ERD is complete.

---

## 1. Entity relationship (database)

Replace the example below with the real model for the **current** iteration scope.

```mermaid
erDiagram
  %% Example — replace with real entities
  EXAMPLE_USER ||--o{ EXAMPLE_SESSION : has
  EXAMPLE_USER {
    uuid id PK
    string email UK
    string password_hash
    timestamptz created_at
  }
```

---

## 2. System context (optional)

High-level actors and the system boundary.

```mermaid
flowchart LR
  User([User])
  API[API service]
  DB[(Database)]
  User --> API
  API --> DB
```

---

## 3. Key sequence flows (optional)

One diagram per critical path (e.g. registration, auth).

```mermaid
sequenceDiagram
  participant C as Client
  participant A as API
  participant D as DB
  C->>A: POST /example
  A->>D: INSERT ...
  D-->>A: ok
  A-->>C: 201
```

---

## Change log

| Date | Iteration | Change |
|------|-----------|--------|
| — | — | Initial template |
