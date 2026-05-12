# Agentes de desarrollo — rideglory-api

Este monorepo usa **sub-agentes** definidos como reglas `.cursor/rules/agent-*.mdc`. Cursor puede aplicarlas por tipo de archivo o puedes **referenciar la regla** en el chat según tu cliente.

## Roles

| Rol | Regla | Uso típico |
|-----|--------|------------|
| **Backend dev** | `agent-backend-developer.mdc` | NestJS, gateway, MS, Prisma, contratos |
| **DevOps** | `agent-devops.mdc` | Docker, compose, workflows, variables de entorno |
| **Arquitecto** | `agent-architect.mdc` | Revisiones, límites entre servicios, lints, contratos |
| **Senior Code Reviewer (Clean Architecture)** | `agent-clean-architecture-reviewer.mdc` | Modo *Judge*: límites gateway/MS, contratos, capas NestJS |

## Harness implementador ↔ revisor

1. Lanza un subagente **Task** (`generalPurpose`) para implementar.
2. Al completarse bien, el hook **`subagentStop`** (`.cursor/hooks.json`) ejecuta `.cursor/hooks/subagent-clean-arch-review.sh` y envía un mensaje automático al agente principal para que actúe como **Senior Code Reviewer**.
3. El revisor sigue el formato de la regla `agent-clean-architecture-reviewer.mdc` y devuelve feedback accionable al implementador si corresponde.

Requiere **Python 3** en el PATH. Matcher: solo subagentes `generalPurpose`.

## App móvil

El cliente Flutter está en el repo **Rideglory**, con reglas equivalentes (`agent-flutter-developer.mdc`, `agent-architect.mdc`). Para cambios de API que afecten la app, alinea **DTOs en `rideglory-contracts`** antes de implementar solo en un lado.

## Flujo recomendado

1. Diseño del contrato (`rideglory-contracts`) y revisión de impacto.
2. Implementación en el microservicio y exposición vía gateway si aplica.
3. Actualización del cliente Flutter y pruebas integradas según disponibilidad.
