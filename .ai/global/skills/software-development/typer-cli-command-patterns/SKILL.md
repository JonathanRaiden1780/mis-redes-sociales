---
name: typer-cli-command-patterns
description: "AIEP Typer CLI patterns: B008, testing, lazy imports."
---

# Typer CLI Command Patterns for AIEP

## Trigger
Use when:
- Wiring a new `ai <command>` into `src/aiep/cli.py`
- Adding CLI commands to a Typer app that uses module-level Option singletons
- Writing unit tests for command modules that use lazy imports
- Resolving Ruff B008 violations on `typer.Option(...)` defaults

## Module-Level Option Singletons (B008 Fix)

This project's `cli.py` uses module-level constants for every `typer.Option`/`typer.Argument` default to avoid Ruff B008. Follow this pattern for every new command:

```python
# Define BEFORE the @app.command() decorator
_MY_OPT = typer.Option(None, "--my-opt", "-m", help="Description")
_KEEP_LAST_OPT = typer.Option(50, "--keep-last", "-k", help="Description")


@app.command(name="my-command")
def my_cmd(
    name: str = typer.Argument(..., help="Required positional"),
    my_opt: str | None = _MY_OPT,
    keep_last: int = _KEEP_LAST_OPT,
) -> None:
    from aiep.commands.my_module import run as run_fn
    ...
```

### Why B008 isn't enforced but singletons are still preferred
The project's ruff config (`pyproject.toml`) does **not** select `B008`, so `typer.Option(...)` in defaults would not trigger a Ruff error. However, the codebase consistently uses module-level singletons (compress, bootstrap-project, index, mcp-add, continue, release commands all follow this). Match the codebase style for consistency.

## Lazy Imports for Testing

### The problem
When a command module imports symbols **inside the function body** (lazy import), `unittest.mock.patch("module.symbol")` fails with `AttributeError`:

```python
# cli.py or command module:
@app.command(name="workflow")
def workflow_cmd(...) -> None:
    from aiep.commands.continue_cmd import ContinueCommand
    # ...
```

Then in tests:
```python
# This FAILS — ContinueCommand is not at module level for patching:
patch("aiep.cli.ContinueCommand")  # AttributeError
```

### The fix: move imports to module level
For command modules that need to be unit-tested with mocks, **move imports to the top of the file**:

```python
from aiep.commands.continue_cmd import ContinueCommand  # module level

def run(self, ...) -> str:
    # No lazy import needed
    cmd = ContinueCommand()
```

This allows both:
1. `patch("aiep.commands.continue_cmd.ContinueCommand")` to work
2. `patch("aiep.commands.continue_cmd.enrich_context_with_semantics")` to work (since it's imported at module level)

### When to use lazy imports
Use lazy imports ONLY inside the CLI command functions in `cli.py` itself (to keep `import aiep.cli` fast). **Do not** use lazy imports in the command implementation modules (e.g., `src/aiep/commands/*.py`) — those should import at module level so tests can patch them.

## cli.py Registration Pattern

1. Add module-level Option singletons before the command.
2. Use `@app.command(name="kebab-case-name")`.
3. Lazy import the handler inside the function body.
4. Always validate syntax after editing: `python -c "from aiep.cli import app"`.

## Common Pitfalls

### 1. Patch target mismatch with lazy imports
If `patch("module.symbol")` raises `AttributeError`, the symbol is likely imported lazily inside a function body. Move it to module level in the production code, or patch the source module path instead.

### 2. Missing `import json` when parsing CLI input
If a command accepts `--env '{"key": "val"}'`, you need `import json` at the top of the command function (not just module level). Use `json.loads()` and handle `JSONDecodeError`.

### 3. `patch.object()` with MagicMock vs Mock
Use `MagicMock` when the patched object's children need attribute access (e.g., `mock_ctx.return_value.select.return_value`). Use `Mock` for simple return values.

### 4. Test cleanup with tmp_path
Tests that create real `.ai/` directories under `tmp_path` should clean up with `shutil.rmtree(tmp_path, ignore_errors=True)` in a `finally` block or fixture to avoid test pollution.

### 5. Duplicate command function names
When replacing an existing CLI command, ensure the old function body is fully removed — Python allows redefinition, but the second `@app.command(name="...")` registration will silently overwrite the first in Typer, causing confusion about which handler runs.

## References
- `references/patch-mock-lazy-import.md` — transcript of the AttributeError debugging session
