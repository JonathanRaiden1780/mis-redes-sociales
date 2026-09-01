# Pattern: cross-repo continuity for greenfield and legacy projects

Use when entering an existing repo (new or old) and needing to bootstrap the platform's continuity layer without losing existing knowledge. Different from greenfield initialization — this handles migration of existing artifacts (ADRs, specs, docs) into the platform structure.

## Pattern shape

Cross-repo continuity has four pieces:

### 1. ProjectDetector (`src/aiep/continuity/detector.py`)
- `ProjectType` enum: `GREENFIELD`, `LEGACY`, `MANAGED`
- `ProjectDetector` with `detect(root) -> DetectionResult`
- Detection criteria:
  - `MANAGED`: has `.ai/` directory
  - `LEGACY`: has `.git` but no `.ai/`
  - `GREENFIELD`: no `.git`, no `.ai/`
- `DetectionResult` carries: `project_type`, `has_git`, `has_ai_dir`, `has_specs`, `has_adrs`, `has_memory`, `has_readme`, `has_architecture`, `legacy_adr_paths`, `legacy_spec_paths`, `legacy_doc_paths`
- Legacy discovery: scans `docs/adr/`, `docs/decisions/`, `adr/` for ADRs; `docs/specs/`, `docs/specifications/`, `specs/` for specs; `ARCHITECTURE.md`, `CONTRIBUTING.md`, `DESIGN.md` for docs

### 2. ContinuityBootstrap (`src/aiep/continuity/bootstrap.py`)
- `ContinuityBootstrap` with `bootstrap(root, project_type, standards) -> BootstrapResult`
- Creates `.ai/` directory structure: `memory.yaml`, `state.yaml`, `rules.md`, `context.yaml`
- Seeds global standards into project memory via YAML
- Idempotent — returns `created=False` if `.ai/` already exists

### 3. LegacyImporter (`src/aiep/continuity/legacy.py`)
- `LegacyImporter` with `import_artifacts(root, adr_paths, spec_paths, doc_paths) -> ImportResult`
- Copies legacy ADRs to `docs/adr/`, specs to `docs/specs/`, docs to `docs/`
- Skips files already in correct location (compares resolved paths)
- Returns count of imported items

### 4. StandardsSeeder (`src/aiep/continuity/standards.py`)
- `StandardsSeeder` with `seed(root, standards)` and `load_global_standards()`
- `seed()` writes standards into project `memory.yaml`
- `load_global_standards()` reads from `GlobalMemoryStore`

## File layout

```
src/aiep/continuity/__init__.py           # Package exports
src/aiep/continuity/detector.py           # Project type detection + legacy discovery
src/aiep/continuity/bootstrap.py          # .ai/ creation + standards seeding
src/aiep/continuity/legacy.py             # Import existing ADRs/specs/docs
src/aiep/continuity/standards.py          # Global standards seeding
src/aiep/commands/enter.py                # CLI: enter, detect, migrate
src/aiep/cli.py                           # Wire commands
tests/unit/test_cross_repo_continuity.py  # Tests with tmp_path
```

## CLI Commands

- `ai enter` — smart entry point. Detects project type, bootstraps `.ai/`, imports legacy artifacts. Adapts flow: managed → no-op, greenfield → bootstrap only, legacy → bootstrap + import.
- `ai detect` — shows project type and detected artifacts without modifying anything.
- `ai migrate` — legacy project migration wizard with confirmation prompt.

## Decisions encoded in this pattern

- **Detection drives flow.** Same command (`ai enter`) behaves differently based on project type.
- **Legacy import preserves source.** Copies files, doesn't move them — original location untouched.
- **Idempotent operations.** Running multiple times is safe — skips existing files, reports no-op.
- **Global standards inheritance.** New projects automatically inherit team standards from global memory.

## Pitfalls

- **Do not move legacy files, copy them.** Original locations may be referenced elsewhere.
- **Check resolved paths for identity.** `src.resolve() == dst.resolve()` means file is already in place.
- **Do not import unused symbols.** Keep imports tight — ruff F401 flags unused.
- **Use specific exception handling.** `OSError`, `KeyError`, `TypeError` — not blind `Exception`.
- **Do not shadow builtins.** Use `list_servers`, not `list` as method name.

## Testing

- **Detector tests:** Use `tmp_path` with `.git` dir, `.ai/` dir, README.md, ARCHITECTURE.md.
- **Bootstrap tests:** Verify directory creation, file creation, idempotency, standards seeding.
- **Legacy importer tests:** Create source files in tmp, verify copy, verify skip-existing.
- **Standards seeder tests:** Verify seed to memory.yaml, noop without memory file.

## QA gate

```bash
black src/ tests/
ruff check src/ tests/
mypy src/ tests/
pytest tests/ -q
```

## When to reach for this pattern

- User enters an existing repo (new clone, inherited project)
- Need to bootstrap `.ai/` without losing existing docs/ADRs/specs
- Migrating legacy repos to the platform's continuity layer
- Auto-inheriting global team standards into new projects

## Example (validated)

### Cross-Repo Continuity (SPEC-043 / TASK-042)

1. `src/aiep/continuity/detector.py` — `ProjectType` enum, `ProjectDetector.detect()` returns `DetectionResult` with legacy paths.
2. `src/aiep/continuity/bootstrap.py` — `ContinuityBootstrap.bootstrap()` creates `.ai/` with `memory.yaml`, `state.yaml`, `rules.md`, `context.yaml`.
3. `src/aiep/continuity/legacy.py` — `LegacyImporter.import_artifacts()` copies ADRs/specs/docs to platform dirs.
4. `src/aiep/continuity/standards.py` — `StandardsSeeder.seed()` writes standards; `load_global_standards()` reads from `GlobalMemoryStore`.
5. `src/aiep/commands/enter.py` — `enter()` adapts flow by project type; `detect()` reports; `migrate()` confirms before import.
6. `src/aiep/cli.py` — `@app.command(name="enter")`, `detect`, `migrate`.
7. `tests/unit/test_cross_repo_continuity.py` — 18 tests with `tmp_path`.

---

**Key lesson:** Cross-repo continuity is about meeting projects where they are — detecting what exists, preserving what's there, and layering on the platform's structure without destruction.
