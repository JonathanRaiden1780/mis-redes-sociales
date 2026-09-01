# Project Analysis & Documentation Generation

## ProjectAnalyzer Pattern

When `ai project init` runs, it must analyze the project to detect:

```python
@dataclass
class ProjectAnalysis:
    project_name: str
    project_type: str      # web, api, cli, library, generic
    language: str          # python, javascript, typescript, go, rust
    framework: str         # fastapi, django, react, nextjs, express
    package_manager: str   # pip, npm, cargo, uv, poetry
    has_tests: bool
    has_ci: bool
    has_docker: bool
    dependencies: list[str]
    dev_dependencies: list[str]
    scripts: dict[str, str]
    directories: list[str]
    entry_points: list[str]
    config_files: list[str]
    source_files: dict[str, int]  # extension → count
```

### Detection Logic

| Signal | Detection |
|--------|-----------|
| `pyproject.toml` / `setup.py` / `requirements.txt` | Python |
| `package.json` | JavaScript/TypeScript |
| `Cargo.toml` | Rust |
| `go.mod` | Go |
| `tsconfig.json` + `package.json` | TypeScript |
| `fastapi` in deps | FastAPI framework |
| `django` in deps / `manage.py` | Django |
| `next` in deps | Next.js |
| `docker-compose.yml` / `Dockerfile` | Docker |
| `.github/workflows` | CI present |

## Documentation Generated

### ARCHITECTURE.md
- Vision general (type, language, framework)
- Estructura del proyecto (tree)
- Dependencias (prod + dev)
- Scripts disponibles
- Entry points
- Source file counts
- Infrastructure status (tests, CI, Docker, README, LICENSE)

### ROADMAP.md
- Estado actual
- Fases (Fundación → Desarrollo → Producción)
- Métricas (deps, files, entry points)

### SPEC-001-initial-setup.md
- Objetivo, alcance
- Requisitos funcionales/no funcionales
- Task table

### ADR-001-tech-stack.md
- Stack decision with context
- Consequences (positive + negative)
- Alternatives considered

## Code Graph

Indexes for fast context retrieval:

```yaml
components:
  - type: class | function | component
    name: Item
    file: main.py
apis:
  - method: GET | POST
    path: /items
    file: main.py
models:
  - type: pydantic | sqlalchemy
    name: Item
    file: main.py
tests:
  - file: tests/test_main.py
```

### Detection Regex

| Pattern | Regex |
|---------|-------|
| Python classes | `^class (\w+)` |
| Python functions | `^def (\w+)` |
| FastAPI routes | `@app\.(get\|post\|put\|delete\|patch)\s*\(\s*["']([^"']+)["']` |
| Flask routes | `@app\.route\s*\(\s*["']([^"']+)["']\s*,\s*methods\s*=\s*\[([^\]]+)\]` |
| Express routes | `(?:app\|router)\.(get\|post\|put\|delete\|patch)\s*\(\s*["']([^"']+)["']` |
| SQLAlchemy models | `class (\w+)\s*\(\s*(?:db\.Model\|Base)\s*\)` |
| Pydantic models | `class (\w+)\s*\(\s*(?:BaseModel\|Schema)\s*\)` |

## Session Source

Implemented 2026-08-15 for AI Engineering Platform (SPEC-053).
