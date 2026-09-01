# Typer mypy strict-mode override — detailed walkthrough

## What happens

When `pyproject.toml` has `strict = true` under `[tool.mypy]`, mypy reports:

```
src/aiep/commands/security.py:16: error: Untyped decorator makes function "run" untyped  [misc]
```

Line 16 is `@app.command()` where `app` is a `typer.Typer` instance.

## Root cause

Typer v0.27.x (current at session time) does not ship complete type stubs for the `@app.command()` decorator's return type. The decorator's signature in the installed package shows:

```
(command.__doc__) -> collections.abc.Callable[[~CommandFunctionType], ~CommandFunctionType]
```

But `~CommandFunctionType` is not fully resolved in the stubs, so mypy treats the decorated function as untyped. With `strict = true`, `disallow_untyped_decorators` is enabled by default, which triggers the `[misc]` error.

## Why `# type: ignore[misc]` is not stable

Adding `# type: ignore[misc]` to the decorator line:

```python
@app.command()  # type: ignore[misc]
def run(...) -> None:
```

works when running mypy directly from the dev venv (`.venv/bin/mypy src/aiep/commands/security.py`), but pre-commit's mypy hook (mirrors-mypy v1.17.1) may still flag it:

```
src/aiep/commands/security.py:16: error: Unused "type: ignore" comment  [unused-ignore]
```

This happens because:
1. Pre-commit's mypy may run with a different configuration context than the dev venv.
2. The `# type: ignore` comment may be seen as covering an error that doesn't exist in the hook's mypy run, making it "unused".

The pyproject.toml override is the stable solution because it lives in the project configuration and applies consistently.

## The fix: pyproject.toml override

```toml
[[tool.mypy.overrides]]
module = "aiep.commands.security"
disallow_untyped_decorators = false
```

### Rules

- Use the **full module path** (e.g. `aiep.commands.security`, not just `security`).
- One `[[tool.mypy.overrides]]` section per Typer command module that uses `@app.command()`.
- Do NOT blanket-disable `disallow_untyped_decorators` globally — only for specific Typer command modules.

### Example: multiple command modules

```toml
[[tool.mypy.overrides]]
module = "aiep.cli"
disallow_untyped_decorators = false

[[tool.mypy.overrides]]
module = "aiep.commands.security"
disallow_untyped_decorators = false

[[tool.mypy.overrides]]
module = "aiep.commands.review"
disallow_untyped_decorators = false
```

## Verification

After adding the override:

```bash
cd /home/jonathanh/Projects/AI-Engineering-Platform
source .venv/bin/activate

# Direct mypy check
mypy src/aiep/commands/security.py

# Pre-commit check
pre-commit run mypy --all-files
```

Both should pass without `[misc]` or `[unused-ignore]` errors.

## Session evidence (2026-08-12)

- Typer version: 0.27.1
- mypy version: 2.3.0 (both dev venv and pre-commit)
- Error with `# type: ignore[misc]`: `Unused "type: ignore" comment [unused-ignore]` from pre-commit
- Fix applied: pyproject.toml override for `aiep.commands.security`
- Result: pre-commit passes (`ruff`, `black`, `mypy` all green)
- Commit: `96fa2ed feat: add security guardrails stack`
