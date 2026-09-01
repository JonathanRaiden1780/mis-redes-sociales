# Pattern: global machine bootstrap (skills + MCP + security + providers)

Use when setting up a new machine with the platform's full registry. This orchestrates installation of skills, MCP servers, security policies, and provider configuration in one idempotent flow.

## Pattern shape

Global machine bootstrap has five pieces:

### 1. GlobalBootstrap (`src/aiep/setup/bootstrap.py`)
- `GlobalBootstrap` with `run() -> SetupResult`
- Orchestrates all setup steps in deterministic order:
  1. Install default skills
  2. Register MCP servers globally
  3. Load security policies
  4. Configure default providers
- Idempotent — running multiple times only adds missing components
- `SetupResult` carries: `skills_installed`, `mcp_servers_registered`, `security_policies_loaded`, `providers_configured`, `errors`, `success`

### 2. SkillInstaller (`src/aiep/setup/skills.py`)
- `SkillInstaller` with `install_defaults() -> int`
- Reads from `SkillRegistry.defaults()` (defined in global config)
- Enables each default skill via existing `enable_skill()` function

### 3. McpGlobalRegistrar (`src/aiep/setup/mcp.py`)
- `McpGlobalRegistrar` with `register_defaults() -> int`
- Writes MCP server definitions to `~/.config/aiep/mcp.yaml`
- Default servers include filesystem and GitHub (npx-based)
- Idempotent — skips already-registered servers

### 4. SecurityPolicyLoader (`src/aiep/setup/security.py`)
- `SecurityPolicyLoader` with `load_policies() -> dict`
- Loads from `~/.config/aiep/security.yaml` or returns defaults
- Default policies: `scan_on_commit`, `block_secrets`, `require_signed_commits`, `allowed_providers`, `blocked_tools`

### 5. ProviderConfigurator (`src/aiep/setup/providers.py`)
- `ProviderConfigurator` with `configure_defaults() -> int`
- Writes default provider config to `~/.config/aiep/providers.yaml`
- Default providers: ollama (enabled), openai (disabled), anthropic (disabled)

## File layout

```
src/aiep/setup/__init__.py           # Package exports
src/aiep/setup/bootstrap.py          # GlobalBootstrap orchestrator
src/aiep/setup/skills.py             # SkillInstaller
src/aiep/setup/mcp.py                # McpGlobalRegistrar
src/aiep/setup/security.py           # SecurityPolicyLoader
src/aiep/setup/providers.py          # ProviderConfigurator
src/aiep/commands/setup.py           # CLI: setup, doctor_fix
src/aiep/cli.py                      # Wire commands
tests/unit/test_global_bootstrap.py  # Tests with tmp_path
```

## CLI Commands

- `ai setup` — full machine bootstrap wizard with confirmation prompt
- `ai doctor --fix` — auto-repair common issues (runs bootstrap)

## Decisions encoded in this pattern

- **Orchestrator pattern.** `GlobalBootstrap` delegates to specialized installers, each owning one concern.
- **Idempotent by design.** Every installer checks existing state before writing.
- **Config at `~/.config/aiep/`.** Consistent with platform conventions (providers.yaml, mcp.yaml).
- **Skills via existing registry.** `SkillInstaller` reuses `SkillRegistry` and `enable_skill()` — doesn't bypass the skill system.

## Pitfalls

- **Do not catch blind `Exception`.** Use specific exceptions: `OSError`, `KeyError`, `TypeError`.
- **Do not write to home dir directly in tests.** Use `tmp_path` for all filesystem operations.
- **Do not import unused symbols.** Keep imports tight.
- **Use `yaml.safe_dump()` with `default_flow_style=False`** for readable config files.
- **Do not shadow builtins.** Use `list_servers`, not `list`.

## Testing

- **Bootstrap tests:** Use `tmp_path` as home dir, test success path and error handling.
- **Installer tests:** Test with empty tmp, test idempotency, test custom registration.
- **Policy loader tests:** Test defaults, test save-and-load roundtrip.
- **Provider configurator tests:** Test defaults creation, test idempotency.

## QA gate

```bash
black src/ tests/
ruff check src/ tests/
mypy src/ tests/
pytest tests/ -q
```

## When to reach for this pattern

- Setting up a new machine with the platform
- Re-running setup after platform updates
- Auto-repairing common configuration issues
- Registering MCP servers globally across all projects

## Example (validated)

### Global Machine Bootstrap (SPEC-044 / TASK-043)

1. `src/aiep/setup/bootstrap.py` — `GlobalBootstrap.run()` orchestrates 4 installers, returns `SetupResult`.
2. `src/aiep/setup/skills.py` — `SkillInstaller.install_defaults()` enables skills from `SkillRegistry.defaults()`.
3. `src/aiep/setup/mcp.py` — `McpGlobalRegistrar.register_defaults()` writes filesystem + GitHub servers to `~/.config/aiep/mcp.yaml`.
4. `src/aiep/setup/security.py` — `SecurityPolicyLoader.load_policies()` returns defaults or reads from config.
5. `src/aiep/setup/providers.py` — `ProviderConfigurator.configure_defaults()` writes ollama/openai/anthropic to `~/.config/aiep/providers.yaml`.
6. `src/aiep/commands/setup.py` — `setup()` wizard with confirmation; `doctor_fix()` auto-repair.
7. `src/aiep/cli.py` — `@app.command(name="setup")`.
8. `tests/unit/test_global_bootstrap.py` — 11 tests with `tmp_path` as home dir.

---

**Key lesson:** Global bootstrap is an orchestrator of specialized installers. Each installer owns one concern and is independently testable. The pattern scales by adding new installers without modifying the orchestrator.
