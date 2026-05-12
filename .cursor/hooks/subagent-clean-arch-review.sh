#!/usr/bin/env bash
# Tras completar un subagente tipo Task (generalPurpose), inyecta el paso "Revisor"
# del harness Implementador → Judge (Clean Architecture / NestJS).
set -euo pipefail
exec python3 -c '
import json, sys

data = json.load(sys.stdin)
status = data.get("status")
if status != "completed":
    print("{}")
    sys.exit(0)

modified = data.get("modified_files") or []
task = data.get("task") or ""
summary = (data.get("summary") or "").strip()
if len(summary) > 3500:
    summary = summary[:3500] + "\n… (truncado)"

files_lines = "\n".join(f"- `{f}`" for f in modified[:80]) or "- _(ninguno reportado — usa `git status` / `git diff`)_"

msg = f"""### Harness — Paso revisor (Clean Architecture)

El **subagente implementador** terminó correctamente. Cambia de rol: eres el **Senior Code Reviewer** del monorepo API.

**Activa la regla del repo:** `@agent-clean-architecture-reviewer` (`.cursor/rules/agent-clean-architecture-reviewer.mdc`) y coherencia con **`agent-backend-developer`** / **`agent-architect`** cuando aplique.

**Contexto del subagente**
- **Tarea:** {task}
- **Resumen:** {summary}

**Archivos modificados (hook `subagentStop`):**
{files_lines}

**Instrucciones**
1. Revisa el diff (`git diff`) con foco en gateway vs microservicios, contratos en `rideglory-contracts`, y capas NestJS.
2. Emite **Veredicto** y **Feedback para el implementador** según la regla del revisor.
3. **No implementes** correcciones salvo petición explícita; prioriza el bucle de feedback con el implementador.

_Paso automático generado por `.cursor/hooks/subagent-clean-arch-review.sh`._
"""

print(json.dumps({"followup_message": msg}))
'
