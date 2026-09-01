---
name: project-knowledge-sync
description: Sync de insights de proyecto a memoria global compartida.
---

# Project Knowledge Sync

Patrón para sincronizar conocimiento de proyectos locales hacia una memoria global compartida, de forma controlada, idempotente, y sin exponer información sensible.

## Cuándo aplicar

- El proyecto tiene una capa project-local (`.ai/`, `docs/adr/`, `.ai/reports/`, etc.) y un store de memoria global separado.
- Se quiere que el global aprenda de los proyectos sin dump crudo de archivos.
- Se necesita una forma explícita y opt-in de mover insights, no sync automático silencioso.

## Arquitectura del sync

```
Project `.ai/` artifacts
    ↓
SyncService (extract → filter → deduplicate → write)
    ↓
Global memory store (labeled notes)
```

### Patrón: Global Vault en el Mismo Repositorio

Si la memoria global vive en `.ai/global/` del **mismo repositorio del proyecto** (no en un repo externo), el sync es más simple:

```
Tu repo
├── .ai/
│   ├── memory.yaml          # Memoria local del proyecto
│   ├── state.yaml           # Estado local
│   └── global/              # ← Cerebro compartido (mismo repo)
│       ├── rules/           # Reglas del equipo
│       ├── skills/          # Skills descubiertos
│       ├── patterns/        # Patrones de arquitectura
│       ├── projects/        # Índice de proyectos
│       └── index.yaml       # Búsqueda rápida
├── src/
└── ...
```

**Ventajas:**
- Sin configuración externa (no hay que pedir URL)
- La memoria viaja con el proyecto en `git push`/`git pull`
- Funciona offline (el repo local ya tiene todo)
- Las IAs externas (Claude, Trae) leen `.ai/` y `.ai/global/` como contexto

**Flujo:**
1. `cd ~/proyecto` → `ai init` → genera MASTERPROMPT + lee global
2. Claude/Trae leen MASTERPROMPT → trabajan con contexto completo
3. `ai sync` → Hermes lee lo que hizo Claude, actualiza global
4. Auto-sync → otras máquinas tienen la nueva memoria

### Patrón: Context Provider para IAs Externas

Cuando el usuario describe "memoria global" o "cerebro", el sistema puede tener **dos roles distintos**:

| Rol | Descripción | Ejemplo |
|-----|-------------|---------|
| **Task Executor** | La plataforma ejecuta tareas directamente usando LLMs | `ai run` llama al LLM |
| **Context Provider** | La plataforma prepara contexto para que IAs externas lo lean | Claude/Trae leen `.ai/global/` |

**Pregunta clave antes de diseñar:**
> "Cuando dices que el global guarda memoria y aprendizaje, ¿la plataforma usa ese contexto directamente cuando ejecuta tareas, o prepara el contexto para que IAs externas (Claude Code, Trae, etc.) lo lean?"

### Qué extraer

- **Project memory** (`.ai/memory.md`) — el contenido persistente del proyecto.
- **Project state** (`.ai/state.yaml`) — solo campos seguros explícitamente (whitelist, no blacklist).
- **Execution reports** (`.ai/reports/`) — resumen de agent, provider, success/failure, excerpt de output/error.
- **Review results** (`.ai/reviews/`) — resumen de task, status, verdict, conclusion.
- **Decision records** (`docs/adr/`) — frontmatter + decision summary de ADRs.
- **Skills descubiertos** — nuevas herramientas o patrones encontrados durante el trabajo.

### Cómo escribir (estructurado, no dump)

Cada insight se escribe como una nota etiquetada con:
- `source_project` — nombre del proyecto
- `source_path` — ruta del proyecto al sync
- `captured_at` — timestamp ISO
- `kind` — memory, state, execution, review, decision, skill, pattern
- `content` — el insight extraído (acotado en longitud, nunca dump completo)
- `status` — new o duplicate

Esto mantiene la memoria global legible, acotada en tokens, y útil para tooling futuro.

## Decisiones clave

### One-way, opt-in

El sync va project → global memory, no al revés. Se trigger con un comando CLI explícito, no automáticamente. Esto evita movimiento de datos inesperado y da control al usuario.

### Cada artifact es opcional

Si el proyecto no tiene memoria, state, reports, reviews, o ADRs, el sync no falla. Cada artefacto es opcional y el resultado refleja lo que pudo extraer.

### Filtro de secretos

La heuristica debe detectar asignaciones de secrets (`api_key=...`, `token: ...`) y keys crudas (`sk-...`, `ghp_...`, `AKIA...`), pero NO menciones semánticas de nombres de campos sin asignación (`api_key field disclosed`).

Patrones recomendados:
- Asignación: `(?:api[_-]?key|apikey)\s*[:=]\s*`, `\b(?:token|password|secret[_-]?key|secret)\s*[:=]\s*`
- Bearer: `authorization\s*:\s*bearer\s+[a-zA-Z0-9+/=]{20,}`
- Keys crudas: `sk-[a-zA-Z0-9-]{20,}`, `ghp_[a-zA-Z0-9]{36,}`, `AKIA[0-9A-Z]{16}`

### Reglas del proyecto

Si el proyecto tiene una regla explícita que bloquea el sync (ej: "no-global-sync" en `.ai/rules.md`), el sync se salta con mensaje claro. Respeta la autonomía del proyecto.

### Deduplicación

Antes de escribir, verificar que el insight no es duplicado de un existente en global memory. La comparación debe ser por contenido + proyecto origen, no solo por timestamp o kind. Si ya existe, marcar como duplicate y no reescribir.

### Whitelist para state, no blacklist

Al extraer campos de state, usar una whitelist explícita de campos seguros (`active_agent`, `provider`, `status`, `notes`, etc.), no intentar filtrar todo lo que parece sensible. La whitelist es más maintainable y menos propensa a falsos negativos.

## CLI command

El command debe ser project-scoped (opera sobre el project `.ai/` actual), no global. Opciones:

- `--dry-run` — muestra qué se capturaría sin escribir.
- `--quiet` — solo resumen, sin detalle de cada insight.
- `--project PATH` — opera sobre un project específico, no el actual.

Output típico:
- Listado de insights capturados (kind, project, preview).
- Listado de skipped items con razón.
- En dry-run, claro que es preview.

## Implementación de deduplicación

```python
def _is_duplicate(self, note: NoteRecord, result: SyncResult) -> bool:
    existing = self.global_memory_store.load()
    existing_notes = existing.get("notes", [])
    candidate = {
        "source_project": note.source_project,
        "content": note.content,
    }
    for existing_note in existing_notes:
        if _note_dicts_equal(existing_note, candidate):
            note.status = "duplicate"
            return True
    return False
```

La función de igualdad compara contenido normalizado + proyecto origen. No usar timestamp o kind para deduplicación — dos insights diferentes del mismo proyecto pueden tener el mismo kind y timestamp cercano.

## Referencias

- `sdd-feature-implementation` — flujo SDD completo para implementar este patrón como feature.
- `references/global-vault-same-repo.md` — patrón de Global Vault en el mismo repositorio (context provider para IAs externas).
