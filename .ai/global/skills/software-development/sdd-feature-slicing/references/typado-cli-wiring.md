# Reference: typado estricto + CLI wiring — lecciones de SDD feature slicing

## Context

Session 2026-08-12: implementar Global-Project Sync (SPEC-032) como primer bloque
de un feature transversal de Knowledge System.

## Pitfall: mypy strict mode en Typer modules

El módulo `src/aiep/project/sync_global.py` usa `@app.command()` en el CLI wiring
pero no es un Typer subapp — es un service module.

Problema encontrado: `tests/unit/test_sync_global.py` fallava mypy por `Missing type
arguments for generic type "dict"`. Los dicts usados en los tests eran `dict` sin
type arg, y mypy strict mode (inherit from pyproject.toml) lo marcaba como error.

Solución: en helpers de test que usan dicts arbitrarios, usar `dict[str, Any]` explícito.
Ejemplo:

```python
def _write_project_state(root: Path, data: dict[str, Any]) -> None:
    ...
```

Esto reduce fricción de mypy en features nuevas sin tener que bajar la estrictitud
global.

## Pitfall: dedup con comparación de dicts arbitrarios

La función `_note_dicts_equal(left: dict[str, Any], right: dict[str, Any])` compara
dos dicts de nota extraídos. La primera implementación tenía comparación campo por
campo con `if left_project != right_project: return False` que ruff marcaba como
SIM103 (return condition directly).

Simplificación aplicada:

```python
return left_project == right_project
```

Este patrón es genérico: si una función auxiliar de comparación devuelve True/False
condicional, evaluar si se puede reducer a return directo.

## Pitfall: Typer h trompezando con assignment expressions

En `_sync_single_report`, la línea:

```python
note = self._make_note(project_name, str(project_root := report_path.parent.parent), ...)
```

dio error de sintaxis. Assignment expression dentro de str() en una f-string context
puede ser problemático. Solución: separar la asignación.

```python
project_root = report_path.parent.parent.resolve()
note = self._make_note(project_name, str(project_root), ...)
```

## Pattern: service module como CLI command

El patrón usado: `src/aiep/commands/sync_global.py` es un command module thin que
llama a `GlobalProjectSyncService` desde `src/aiep/project/sync_global.py`.

Esto mantiene el negocio en `project/` y el wiring CLI en `commands/`, siguiendo
la separación que ya existe en el proyecto (ej: `commands/run.py` → `execution/service.py`).

## Pattern: dedup con inyección de GlobalMemoryStore

Para testability, `GlobalProjectSyncService.__init__` acepta
`global_memory_store: GlobalMemoryStore | None = None`. Si es None, crea uno por
defecto. En tests, se inyecta un store apuntando a tmp_path para aislamiento.

Esto evita que los tests toquen el global memory real del usuario.

## Patrón de secret heuristic como función pura apartada

La función `_content_has_secret_heuristic(content: str) -> bool` es pura, deterministic,
y testeable independientemente del servicio. Eso permite testearla con
`@pytest.mark.parametrize` sin montar proyecto completo.

Se recomienda este patrón para cualquier filtro defensivo nuevo: función pura aparte,
con tests parametrizados, consumida por el servicio.
