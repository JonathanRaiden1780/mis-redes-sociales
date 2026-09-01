# Circular Imports & Frozen Exceptions en Tests Python

Aprendido en SPEC-036 / TASK-035 (Production API Clients Unification).

## Circular Imports en `__init__.py`

**Problema:** Cuando `__init__.py` re-exporta desde submódulos (`from aiep.clients import ApiError`), y esos submódulos importan desde el paquete (`from aiep.clients.base import ...`), se genera un import circular. Python inicializa el módulo parcialmente y lanza:

```
ImportError: cannot import name 'ApiError' from partially initialized module 'aiep.clients'
```

**Solución:** En `__init__.py`, importa directamente desde el submódulo, no desde el paquete:

```python
# Correcto
from aiep.clients.base import ApiError, ApiErrorReason
from aiep.clients.http import HttpProductionApiClient

# Incorrecto (causa circular import)
from aiep.clients import ApiError, HttpProductionApiClient
```

**Raíz:** Python ejecuta el `__init__.py` al importar el paquete. Si el `__init__.py` importa de `aiep.clients.algo` antes de que `algo` termine de cargar, falla. Importar directamente desde el submódulo (`aiep.clients.base`) evita depender del `__init__.py` parcialmente cargado.

## Frozen Dataclass + pytest: FrozenInstanceError

**Problema:** Cuando una excepción es un `@dataclass(frozen=True)`, pytest's `contextlib` intenta asignar `exc.__traceback__ = traceback`, lo que lanza:

```
dataclasses.FrozenInstanceError: cannot assign to field '__traceback__'
```

**Contexto:** Ocurre en tests donde el código lanza `ApiError` (congelado) y pytest maneja la excepción internamente. El framework intenta mutar el traceback pero el dataclass lo impide.

**Workaround:** Asegurar que los tests proporcionen credenciales/endpoints válidos para que el código no lance la excepción congelada durante la prueba. Esto evita que pytest tenga que manejar la excepción.

## Verificación de Fallos Pre-existentes con `git stash`

**Técnica:** Para distinguir si un fallo es nuevo (introducido por tus cambios) o pre-existente:

```bash
git stash
pytest tests/unit/test_existing.py -v  # ejecutar en limpio
git stash pop
```

Si el test falla también en limpio, es pre-existente y no es tu responsabilidad arreglarlo en esta sesión. Documenta el hallazgo y continúa.

**Cuándo usarlo:** Cuando agregas tests junto con código nuevo y tests existentes empiezan a fallar — necesitas saber si rompiste algo o si ya estaba roto.
