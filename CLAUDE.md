# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

NestJS monorepo (npm workspaces, Node 22.12) for the **Rideglory** backend — motorcycle riding event platform. All microservices communicate over TCP with `@nestjs/microservices`. The API Gateway is the sole public HTTP/WebSocket entry point.

## Workspaces

| Package | Role |
|---|---|
| `api-gateway` | HTTP REST + WebSocket entry point; Firebase auth guards; proxies to all MS via TCP |
| `users-ms` | User profiles domain |
| `vehicles-ms` | Vehicle garage domain |
| `events-ms` | Events, registrations, tracking |
| `maintenances-ms` | Maintenance log domain |
| `rideglory-contracts` | Shared DTOs and types consumed by gateway + all MS |
| `rideglory-common-lib` | Shared RPC exception filter, error interfaces |

## Commands

All commands run from repo root unless noted.

### Development

```bash
# Start databases (each MS has its own docker-compose)
npm run docker:up

# Start a microservice in watch mode (run from its directory or use --workspace)
cd users-ms && npm run start:dev
cd api-gateway && npm run start:dev

# Run all DBs down
npm run docker:down
```

### Database (Prisma — per MS)

```bash
# Migrations
npm run db:migrate:all          # migrate all MS
cd users-ms && npm run db:migrate   # single MS

# Reset
npm run db:reset:all

# Regenerate Prisma clients after schema changes
npm run prisma:generate
npm run prisma:generate:users   # single MS variant
```

### Build / Lint / Test (per workspace)

```bash
cd users-ms        # or any ms / api-gateway
npm run build
npm run lint
npm run test
npm run test:e2e
npm run test:cov
```

## Architecture rules

- **DTOs shared across services belong in `rideglory-contracts`** — never duplicate them between gateway and a MS.
- **Gateway = HTTP/WS + auth + proxy only** — no domain logic. Business logic lives in the MS.
- **MS = domain + Prisma** — each MS owns its own PostgreSQL schema; no cross-MS direct imports.
- **Shared utilities/error handling** go in `rideglory-common-lib` (`RpcAllExceptionsFilter`, RPC error interfaces).
- Transport: all MS use `Transport.TCP`. Errors thrown as `RpcException`; the gateway's `RpcCustomExceptionFilter` maps them to HTTP responses.
- Auth: Firebase ID token validated in the gateway via a guard; MS receive pre-validated identity.
- Env validation: each service uses Joi at startup (`src/config/envs.ts`) — add new vars there and update the `.env` template.
- Prisma: each MS generates its client to `src/generated/prisma`; run `prisma:generate:<service>` after schema changes.

## Agent roles (from `.cursor/rules/`)

- **`agent-backend-developer.mdc`** — NestJS implementation work.
- **`agent-architect.mdc`** — boundary/contract reviews, TS strict lint.
- **`agent-clean-architecture-reviewer.mdc`** — automated post-implementation review (Judge mode); outputs `APROBADO` | `CAMBIOS REQUERIDOS`.
- **`agent-devops.mdc`** — Docker, compose, CI workflows.

The `.cursor/hooks.json` `subagentStop` hook runs the clean-arch review automatically after a generalPurpose sub-agent completes.

## Related repos

- **Flutter app:** `/Users/cami/Developer/Personal/Rideglory` — consumes this API.
- When changing API contracts, update `rideglory-contracts` first so both sides stay in sync.
