# Estrategia de regex para secretos y reglas

## Problema típico

Las regex que buscan palabras clave sueltas (`api[_-]?key`, `token`, `password`) generan falsos positivos cuando el texto contiene menciones semánticas de esos campos sin que sean asignaciones de secrets reales.

Ejemplos de falsos positivos:
- "api_key field was disclosed in the log"
- "Missing OPENAI_API_KEY"
- "The api_key should not be logged"

## Estrategia correcta

### 1. Detectar asignaciones, no menciones

Usar patrones que requieran un operador de asignación después del nombre del campo:

```python
SECRET_ASSIGNMENT_PATTERNS = [
    # api_key=... o api_key: ... o apikey=...
    r"(?i)(?:api[_-]?key|apikey)\s*[:=]\s*",
    # token=... o token: ...
    r"(?i)\btoken\s*[:=]\s*",
    # password=... o password: ...
    r"(?i)\bpassword\s*[:=]\s*",
    # secret=... o secret_key=... o secret: ...
    r"(?i)\bsecret[_-]?key?\s*[:=]\s*",
]
```

### 2. Detectar keys crudas inequívocos

Estos patrones son específicos de formatos de keys reales y no generan falsos positivos en texto libre:

```python
RAW_KEY_PATTERNS = [
    # OpenAI: sk-... o sk-proj-... con 20+ caracteres alfanuméricos/hyphen
    r"sk-[a-zA-Z0-9-]{20,}",
    # GitHub PAT: ghp_ + 36 caracteres alfanuméricos
    r"ghp_[a-zA-Z0-9]{36,}",
    # AWS Access Key ID: AKIA + 16 caracteres alfanuméricos mayúsculas
    r"AKIA[0-9A-Z]{16}",
    # Bearer token en Authorization header
    r"(?i)authorization\s*:\s*bearer\s+[a-zA-Z0-9+/=]{20,}",
]
```

### 3. Combinar ambos enfoques

```python
SECRET_HEURISTIC_PATTERNS = SECRET_ASSIGNMENT_PATTERNS + RAW_KEY_PATTERNS
```

Esto detecta:
- `api_key=secret` → sí (asignación)
- `sk-proj-abc123def456ghi789jkl012mno345` → sí (key cruda)
- `Authorization: Bearer eyJhbGci...` → sí (bearer)
- `api_key field was disclosed in the log` → no (mención sin asignación)
- `Missing OPENAI_API_KEY` → no (mensaje de error, no asignación)

### 4. Regex para indicadores de reglas

Los indicadores de reglas como "Disable global sync for this project" contienen espacios entre palabras. Los patrones con `[_-]?` no matchean espacios.

```python
# Incorrecto: solo matchea guion o underscore entre palabras
r"(?i)no[_-]?global[_-]?sync"

# Correcto: matchea espacios, guiones, o underscores entre palabras
r"(?i)no[\s_-]*global[\s_-]*sync"
r"(?i)disable[\s_-]*global[\s_-]*sync"
r"(?i)no[\s_-]*sync[\s_-]*to[\s_-]*global"
```

### 5. Debugging de regex

Cuando un caso de test falla:

1. Identificar la string exacta que no matchea (pytest --tb=short muestra la parametrización).
2. Verificar si la string tiene espacios, caracteres especiales, o formato diferente al esperado.
3. Probar la regex en un REPL o con `re.search` directamente:
   ```python
   import re
   pattern = r"(?i)no[\s_-]*global[\s_-]*sync"
   bool(re.search(pattern, "Disable global sync for this project."))
   ```
4. Ajustar el regex para aceptar variaciones (espacios con `\s*`, guiones con `[-_]`, etc.).
5. Ajustar los casos de test para que usen strings que coincidan con la regex, o cambiar la regex para que sea más permisiva donde sea correcto.
