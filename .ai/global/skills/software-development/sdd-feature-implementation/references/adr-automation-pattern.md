# Pattern: ADR (Architecture Decision Record) automation for a Python CLI project

Use when implementing ADR creation, management, and validation capabilities — turning passive documents into a managed lifecycle with programmatic generation, structured metadata, validation, and CLI commands.

## Pattern shape

An ADR automation layer has five pieces, each small and decoupled:

### 1. Models (`src/aiep/adr/models.py`)
- `AdrStatus` enum: `PROPOSED`, `ACCEPTED`, `DEPRECATED`, `SUPERSEDED`
- `Adr` dataclass: `id`, `title`, `status`, `date`, `context`, `decision`, `consequences`, `superseded_by`, `tags`, `path`
- `AdrSummary` dataclass for list views (lightweight, frontmatter-only)

Keep models in their own file. They are the boundary between the store, service, and CLI.

### 2. Store (`src/aiep/adr/store.py`)
- `AdrStore` protocol: `list()`, `get(id)`, `save(adr)`, `delete(id)`, `exists(id)`
- `FileSystemAdrStore` implementation: reads/writes `docs/adr/*.md`
- The protocol enables testing with an in-memory fake; the filesystem implementation is the production path

Store owns: file I/O, directory creation, path resolution. It does NOT validate content — that is the service's job.

### 3. Template (`src/aiep/adr/template.py`)
- `render_adr(adr) -> str` — produces markdown with YAML frontmatter (Michael Nygard format)
- `parse_adr(path) -> Adr` — reads markdown file into Adr model
- `parse_summary(path) -> AdrSummary` — lightweight frontmatter-only parse for list views

Template owns: YAML serialization/deserialization, markdown structure, section extraction. Uses `datetime.now(UTC).date()` to avoid ruff DTZ011 violations.

### 4. Service (`src/aiep/adr/service.py`)
- `AdrService(store)` with:
  - `generate(title, context, decision, consequences, status, tags) -> Adr` — creates and saves; validates uniqueness by slugified id
  - `list() -> list[AdrSummary]` — delegates to store
  - `get(id) -> Adr | None` — delegates to store
  - `validate(id | None) -> list[str]` — validates single ADR or all; returns empty list if valid
  - `supersede(id, new_id) -> tuple[Adr, Adr]` — updates status and superseded_by

Service owns: business logic, validation rules, slugification. It does NOT touch the filesystem directly — it goes through the store.

### 5. CLI Commands (`src/aiep/commands/adr.py`)
- `list_adrs()` — table with ID, title, status, date, tags
- `show_adr(id)` — full ADR content with colored status
- `generate_adr(...)` — create new ADR from flags
- `validate_adrs(id)` — validation report
- `supersede_adr(old_id, new_id)` — mark ADR as superseded

Flat `@app.command()` entries, not grouped sub-typers (match existing project convention). Wired into `cli.py` with `@app.command(name="adr-list")`, `@app.command(name="adr-show")`, etc.

## File layout

```
src/aiep/adr/__init__.py          # package marker
src/aiep/adr/models.py            # AdrStatus, Adr, AdrSummary
src/aiep/adr/store.py             # AdrStore protocol + FileSystemAdrStore
src/aiep/adr/template.py          # render_adr, parse_adr, parse_summary
src/aiep/adr/service.py           # AdrService with generate/list/get/validate/supersede
src/aiep/commands/adr.py          # CLI commands (flat @app.command())
src/aiep/cli.py                   # wire commands
tests/unit/test_adr_automation.py # Fake store + template tests
```

## Decisions encoded in this pattern

- **YAML frontmatter for structured metadata.** Enables fast indexing (list/get) without parsing full body. Compatible with Obsidian sync.
- **Store protocol for testability.** Service depends on `AdrStore`, not `FileSystemAdrStore`. Tests inject an in-memory fake.
- **Template separates rendering from business logic.** The service doesn't know how to render markdown; the template doesn't know how to validate.
- **Validation returns errors, not exceptions.** Empty list = valid; non-empty list = list of problems. Caller decides how to display.
- **Slugification for IDs.** Titles become URL-safe slugs (`use-rust` from "Use Rust"). Deterministic, no collisions (generate checks uniqueness).
- **Lightweight summaries.** `AdrSummary` avoids loading full ADR bodies for list views.

## Pitfalls

- **Do not use `datetime.date.today()`.** Ruff DTZ011 flags this. Use `datetime.now(UTC).date()` instead.
- **Do not skip the store protocol.** Always depend on `AdrStore`, not `FileSystemAdrStore`, in the service. Tests need a fake.
- **Do not put validation logic in the template.** Template renders/parses; service validates.
- **Do not crash on missing ADRs.** `get()` returns `None`; `validate()` returns error list; `generate()` raises `ValueError` for duplicates.
- **Do not forget to create the ADR directory.** `FileSystemAdrStore.save()` calls `_ensure_dir()` before writing.

## Testing

- **Service tests:** Use `FakeAdrStore` (in-memory dict). Test generate, list, get, validate (valid/invalid), supersede, duplicate detection.
- **Template tests:** Round-trip (render → parse → compare), parse_summary (frontmatter only), invalid frontmatter (returns None).
- **Slugify test:** Simple titles, special characters, empty string, unicode.
- **No real filesystem for service logic.** Template tests can use `tempfile.TemporaryDirectory()` for actual file I/O.

## QA gate order

```bash
black src/ tests/
ruff check src/ tests/
mypy src/ tests/
pytest tests/ -q
```

## When to reach for this pattern

- You need to manage ADRs (or similar documents) as a lifecycle, not just read them
- You want programmatic creation from structured input (title, context, decision, consequences)
- You need validation, status tracking, and superseding
- The documents live in a directory and should be indexed for context/search

## Examples (validated)

### ADR Automation (SPEC-039 / TASK-038)

1. `src/aiep/adr/models.py` — `AdrStatus` enum, `Adr` dataclass, `AdrSummary` dataclass
2. `src/aiep/adr/store.py` — `AdrStore` protocol, `FileSystemAdrStore` reading `docs/adr/*.md`
3. `src/aiep/adr/template.py` — `render_adr()` produces Michael Nygard format with YAML frontmatter; `parse_adr()` reads it back
4. `src/aiep/adr/service.py` — `AdrService` with generate (slugified IDs, uniqueness check), validate (field presence, status validity, duplicate detection), supersede
5. `src/aiep/commands/adr.py` — `list_adrs`, `show_adr`, `generate_adr`, `validate_adrs`, `supersede_adr`
6. `src/aiep/cli.py` — `@app.command(name="adr-list")`, `adr-show`, `adr-validate`, `adr-generate`, `adr-supersede`
7. `tests/unit/test_adr_automation.py` — 24 tests with `FakeAdrStore`, round-trip template tests, slugify tests
