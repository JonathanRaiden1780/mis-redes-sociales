# Pattern: adding a new execution backend to a Python CLI project

Use when integrating a new external tool/backend (Aider, Codex, OpenRouter, OpenHands, etc.) as an execution path for a task runner / agent platform that already has a `ModelClient` protocol and `ExecutionAdapter` registry.

## Pattern shape

An execution backend has five pieces, each small and decoupled:

### 1. Client (`src/aiep/clients/<name>.py`)
- Implements `ModelClient` protocol structurally: `execute(self, task: str, config: dict[str, str] | None = None) -> str`
- Uses `_resolve_credentials(config, default_env)` from `base.py` for credential resolution — never duplicate env-reading logic
- Validates prerequisites (binary on PATH, API key, etc.) and raises `ApiError` with appropriate `ApiErrorReason`
- Returns stdout/string output; never raises raw `OSError` or `subprocess` errors — normalize to `ApiError`

### 2. Adapter (`src/aiep/execution/<name>.py`)
- Wraps the client: `def __init__(self, client: <Name>Client | None = None)`
- `execute(self, request: ExecutionRequest) -> ExecutionResult` — calls `request.prompt()` and `request.provider_config`
- Follows exact same shape as `OllamaAdapter` / `AnthropicAdapter` — no new abstractions

### 3. Runtime Checker (`src/aiep/runtime/checkers/<name>.py`)
- `check(self, provider: Provider) -> HealthResult`
- Validates: binary availability, git repo state, credentials, environment
- Returns actionable messages (not just pass/fail) so `ai status` and `ai doctor` are useful

### 4. CLI Command (`src/aiep/commands/<name>.py`)
- `status()` — shows backend health (binary path, git status, credentials)
- `run(task, ...)` — executes a task via the backend
- Flat `@app.command()` entries, not grouped sub-typers (match existing project convention)
- Wired into `cli.py` with `@app.command(name="<name>-status")` and `@app.command(name="<name>")`

### 5. Application Wiring (`src/aiep/core/application.py`)
- Register adapter: `"<name>": <Name>Adapter()` in `adapters` dict
- Register runtime checker: `"<name>": <Name>RuntimeChecker()` in `runtime_checkers` dict
- Import both at module top; add to both dicts

## File layout

```
src/aiep/clients/<name>.py          # Client with execute(task, config) -> str
src/aiep/execution/<name>.py        # Adapter wrapping the client
src/aiep/runtime/checkers/<name>.py # Runtime health checker
src/aiep/commands/<name>.py         # CLI status + run commands
src/aiep/cli.py                     # Wire commands
src/aiep/core/application.py        # Register adapter + checker
tests/unit/test_<name>_integration.py # Fake-based unit tests
```

## Decisions encoded in this pattern

- **Client implements ModelClient, not a new base class.** Structural typing via `Protocol` means no inheritance hierarchy to maintain.
- **Credential resolution is centralized.** Every client calls `_resolve_credentials` — never `os.getenv` directly.
- **Error normalization is unified.** All failures become `ApiError` with `ApiErrorReason` — the UI and logs treat all backends identically.
- **Adapters are thin.** They translate `ExecutionRequest` → client call → `ExecutionResult`. No business logic lives here.
- **Runtime checkers validate environment, not just provider config.** Binary presence, git state, credentials — the full picture for `ai doctor`.
- **CLI commands are flat.** One command per action, matching existing `@app.command()` convention.
- **Tests use fakes, never real subprocess/APIs.** Mock `shutil.which`, `subprocess.run`, and `Path.exists` for deterministic, isolated tests.

## Pitfalls

- **Do not duplicate credential logic in the client.** Always use `_resolve_credentials` from `base.py`.
- **Do not raise raw subprocess/OSError exceptions.** Wrap them in `ApiError` with appropriate `ApiErrorReason` (`TIMEOUT`, `CONNECTION`, `MISSING_CREDENTIALS`, `PROVIDER_ERROR`).
- **Do not skip the runtime checker.** Every backend needs one so `ai status` and `ai doctor` surface actionable info.
- **Do not forget to register in BOTH dicts in application.py.** Adapters and runtime checkers are separate registries — both must be updated.
- **Do not use `typer.Argument(...)` in parameter defaults.** Ruff B008 catches this. Use `task: str` and let Typer handle required args implicitly.
- **Do not import at module top if it creates circular imports.** Use `TYPE_CHECKING` guards or local imports inside functions if the dependency direction is ambiguous.
- **Do not shadow builtins with method names.** Use `list_things`, not `list` as a method name.
- **Do not let frozen exceptions propagate through `pytest.raises`.** When a client raises a frozen dataclass exception (like `ApiError`), pytest's context manager can fail with `dataclasses.FrozenInstanceError: cannot assign to field '__traceback__'`. Fix: mock the subprocess to return success instead of testing the exception path through `pytest.raises`.
- **Do not use `date.today()`.** Ruff DTZ011 flags it. Use `datetime.now(UTC).date()` instead (import `from datetime import UTC, datetime`).
- **Do not group imports randomly.** Ruff I001 flags unsorted/unformatted import blocks. The project convention is separate `from aiep.commands import (name as alias,)` blocks per command, sorted alphabetically by alias.

## Testing

- **Client tests:** Mock `shutil.which`, `subprocess.run`, `os.environ`. Test binary resolution (config vs PATH vs missing), credential resolution (config vs env vs missing), subprocess success/failure/timeout.
- **Adapter tests:** Use a fake client that records calls and returns canned output. Verify delegation, prompt passing, config forwarding, agent preservation.
- **Runtime checker tests:** Mock `Path.cwd`, `Path.exists`, `shutil.which`, `os.environ`. Test disabled provider, binary found/configured/missing, git repo present/absent, credentials present/absent.
- **No real subprocess or API calls.** Every test must be deterministic and isolated.

## QA gate order

After implementation, run in this order:

```bash
black src/ tests/
ruff check src/ tests/
mypy src/ tests/
pytest tests/ -q
```

If `black` reformats a file you edited, re-run ruff/mypy/pytest against it since formatting can change line numbers referenced in type-ignore comments.

## When to reach for this pattern

- You need to delegate tasks to an external tool/backend (Aider, Codex, OpenRouter, OpenHands, etc.)
- The platform already has a `ModelClient` protocol and `ExecutionAdapter` registry
- You want consistent error handling, runtime health checks, and CLI commands
- The backend runs as a subprocess or HTTP client (not an embedded library)

## Examples (validated)

### Aider (SPEC-037 / TASK-036)

1. `src/aiep/clients/aider.py` — `AiderClient` with `execute(task, config)` that shells out to `aider --model <m> --yes --no-auto-commits --message <task>`. Uses `_resolve_credentials` for API key. Raises `ApiError` on missing binary, missing credentials, non-zero exit, timeout.
2. `src/aiep/execution/aider.py` — `AiderAdapter` wraps `AiderClient`, follows `OllamaAdapter` pattern.
3. `src/aiep/runtime/checkers/aider.py` — `AiderRuntimeChecker` validates binary (PATH or config), git repo (`.git` exists), credentials (any of `AIDER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`).
4. `src/aiep/commands/aider.py` — `status()` and `run(task, model, aider_path)`.
5. `src/aiep/cli.py` — `@app.command(name="aider-status")` and `@app.command(name="aider")`.
6. `src/aiep/core/application.py` — Registered `"aider": AiderAdapter()` and `"aider": AiderRuntimeChecker()`.
7. `tests/unit/test_aider_integration.py` — 18 tests with `FakeAiderClient`, mocked `shutil.which`/`subprocess.run`/`Path.exists`. No real subprocess.

### Codex (SPEC-038 / TASK-037)

Same pattern, different binary/flags. Shells out to `codex --model <m> --yes --message <task>`. Default API key env is `OPENAI_API_KEY`. Runtime checker validates binary + credentials only (no git check, since Codex doesn't require a repo). 18 tests with `FakeCodexClient`. Confirms the pattern is repeatable with zero structural changes.

### OpenRouter (SPEC-040 / TASK-039)

`OpenRouterClient` wraps `OpenAICompatibleClient` with OpenRouter defaults (`endpoint: https://openrouter.ai/api/v1`, `api_key_env: OPENROUTER_API_KEY`). No subprocess — HTTP-based. Demonstrates the pattern works for non-subprocess backends too. 15 tests.

### OpenHands Enhanced (SPEC-041 / TASK-040)

Enhanced existing stub with real subprocess invocation. `OpenHandsClient` shells out to `openhands --model <m> --yes --no-auto-commits --message <task>`. Runtime checker enhanced to validate binary presence. 18 tests. Shows the pattern applies to upgrading stubs too.

### Upgrading a stub client to real subprocess

When an existing client is a stub (returns formatted string), upgrading to real subprocess requires:

1. **Update ALL existing tests** that exercised the stub — they need `patch("shutil.which")` + `patch("subprocess.run")` now.
2. **Smoke tests must include api_key + api_key_env** in config dict — the real client validates credentials.
3. **All sibling tests** that reference the stub (e.g., `TestNoRealApiCalls`) need the same mock treatment.
4. **Runtime checker** may need enhancement from "always passes" to actual binary validation.

The pattern is identical to fresh integration, but the regression surface is wider — grep for all test files that import the client class.

---

**Key lesson across all four:** Once the pattern is established, adding a new backend is mechanical — copy the structure, swap the binary/flags, write fakes, run QA gate. The pattern is the productivity multiplier.