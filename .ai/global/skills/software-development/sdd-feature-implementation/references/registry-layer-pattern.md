# Pattern: adding a configurable skills/registry layer to a Python CLI project

Use when implementing a feature that introduces a discoverable, loadable, configurable set of "things" (skills, rules, prompts, behaviors) that the platform can list, enable/disable, and inject into agent context — without hardcoding them in source.

## Pattern shape

A registry layer has four pieces, each small and decoupled:

### 1. Models (dataclasses)
- `SomethingRecord` — metadata for one installed item: `name`, `title`, `description`, `tags`, `version`, `enabled`, `path`, `content_files`
- `LoadedSomething` — the record plus a `content: dict[str, str]` of filename→raw text
- `SomethingLoadResult` — `skills: list[LoadedSomething]`, `missing: list[str]`

Keep models in their own file (e.g. `src/aiep/skills/models.py`). They are the boundary between discovery/loading and everything that consumes them.

### 2. Registry (discovery)
- `SkillRegistry(registry_path: Path | None = None)` — resolves path from config if None
- `list()` → `list[SomethingRecord]` — scan `registry_path` for subdirectories containing the metadata file (`skill.yaml`); skip entries without it; malformed metadata → skip (don't crash)
- `get(name: str)` → `SomethingRecord | None`
- `defaults(config_path: Path | None = None)` → `list[str]` — read from config key (e.g. `skills.default`)

Registry owns: YAML parsing for metadata files, directory discovery, type coercion from YAML (str→str, list→list, bool→bool). It does NOT load content files — that is the loader's job.

### 3. Loader (content)
- `SkillLoader(registry: SkillRegistry)` — takes a registry, not a path
- `load(names: list[str])` → `SkillLoadResult` — for each name: get record from registry; if None, add to `missing`; otherwise read all non-metadata files in the directory as utf-8 text (errors=ignore) into `content`
- Missing items are reported, not raised (caller decides how to handle)

Loader owns: reading raw content files. It does NOT parse them — content is returned verbatim as text. The consumer (agent) decides how to use it.

### 4. CLI commands (flat, @app.command())
Follow the existing project pattern: flat `@app.command()` entries, not grouped sub-typers. One command per action:

- `skills()` — list installed, mark which are in defaults (table with name/title/default flag)
- `skills-show(name)` — show metadata + content files (truncated, ~40 lines each, with clear truncation marker)
- `skills-enable(name)` — append to defaults in config
- `skills-disable(name)` — remove from defaults in config
- `skills-default(names...)` — replace defaults list; validate each name exists in registry before writing

Config read/write pattern: read YAML, modify the `skills.default` key, write back preserving other keys. Same pattern used by existing bootstrap config writes.

### 5. Bootstrap wiring + seeds
- Bootstrap already creates the registry directory (e.g. `~/.local/share/aiep/skills/`) and writes the config key with defaults
- Seed skills live in the repo under `seeds/skills/<name>/` (git-tracked)
- Bootstrap copies seeds to registry if registry is empty (`_install_skill_seeds_if_empty`)
- Each seed: `skill.yaml` + at least one content file (`prompt.md`, `rules.md`, etc.)

## File layout

```
src/aiep/skills/__init__.py          # package marker
src/aiep/skills/models.py            # SkillRecord, LoadedSkill, SkillLoadResult
src/aiep/skills/registry.py          # SkillRegistry (discovery + metadata parsing)
src/aiep/skills/loader.py            # SkillLoader (content loading)
src/aiep/commands/skills.py          # CLI commands (flat @app.command())
src/aiep/cli.py                      # wire commands under @app
seeds/skills/<name>/skill.yaml       # seed metadata
seeds/skills/<name>/prompt.md        # seed content (example)
```

## Decisions encoded in this pattern

- **Skills are data, not code.** `skill.yaml` + raw content files. No parsing of content beyond reading as text.
- **Registry and loader are separate.** Registry resolves metadata; loader resolves content. They can be tested independently.
- **CLI commands are flat, not grouped.** Match existing project convention. No typer subgroups.
- **Missing items are reported, not raised.** `SkillLoadResult.missing` lets the caller decide. CLI can print a warning; programmatic use can ignore.
- **Seeds are optional but valuable.** Registry works with empty state (graceful). Seeds make the feature feel alive on a fresh install.
- **Config is read/write preserving other keys.** Never blow away the rest of config.yaml when toggling a skill.

## Pitfalls

- **Do not put `typer.Argument(...)` in a parameter default.** Ruff B008 catches this. Use `names: list[str]` and let typer handle the argument; the `...` is implicit for required arguments.
- **Do not shadow builtins with method names.** Ruff UP037 + mypy will flag `list` as a method name on a class. Use `list_skills`, `list_rules`, etc.
- **Do not import the registry type at module level in the loader if it creates a circular import.** Use a TYPE_CHECKING guard or a string annotation `"SkillRegistry"` if needed; prefer importing from registry module directly if the dependency direction is clear (loader → registry, not the reverse).
- **Do not crash on malformed skill.yaml.** Skip the directory, log/warn if there is a logging channel, move on. A single bad pack should not break `ai skills` for everyone.
- **Do not load content in the registry.** Registry returns metadata + list of filenames. Loader returns the actual text. This separation keeps each piece testable and avoids loading files that nobody asked for.

## Testing

- Registry: list from a temp directory with valid `skill.yaml` files; get by name; None for missing; malformed YAML skipped; empty registry → empty list
- Defaults: read from a temp config.yaml with `skills.default`; missing config → empty; missing key → empty
- Loader: load skill with content files (verify content dict); skill with no content files (verify empty dict); missing skill (verify in `missing` list)
- CLI: list prints names + default flag; show prints metadata + truncated content; enable/disable modify config correctly; set-default replaces list and validates existence
- Seed skills: bootstrap copies seeds when registry empty (test the copy, not the full bootstrap)

## When to reach for this pattern

- You need agents to load reusable prompts/rules/behaviors without hardcoding them
- The set of items is configurable by the user (enable/disable/default)
- Items live in a directory, not in the repo source tree
- You want bootstrap to seed reasonable defaults so the feature is useful immediately
