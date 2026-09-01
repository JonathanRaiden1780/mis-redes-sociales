---
name: python-typer-cli
description: Build Typer CLIs with mypy strict mode and pre-commit hooks.
---

# Python Typer CLI

## Trigger

Use when:
- Building a new CLI command or subcommand with Typer (`typer.Typer`, `@app.command()`, `typer.Option`).
- Registering a Typer subapp as a subgroup of an existing CLI.
- Running mypy in strict mode against Typer-based CLI code.
- Setting up pre-commit hooks for a Typer project.

## Typer app structure

### Single app with commands

```python
from __future__ import annotations

import typer

app = typer.Typer(name="my-cli", help="Description of the CLI")


@app.command()
def hello(
    name: str = typer.Argument(..., help="Name to greet"),
    excited: bool = typer.Option(False, "--excited", "-e", help="Add exclamation"),
) -> None:
    """Greet someone."""
    msg = f"Hello, {name}!"
    if excited:
        msg += "🎉"
    print(msg)


if __name__ == "__main__":
    app()
```

### Subgroups (subapps) for namespaced commands

Use a subapp when a feature area has multiple related commands:

```python
from typer import Typer

security_app = Typer(
    name="security",
    help="Run deterministic security checks against the current project",
)


@security_app.command()
def run(...) -> None:
    """Run security checks."""


@security_app.command(name="status")
def status() -> None:
    """Show security status."""


# In the main CLI module:
app.add_typer(security_app, name="security")
```

This gives `ai security run` and `ai security status`.

## Registering in the main CLI

In `cli.py`:

1. Import: `from aiep.commands.security import app as security_app`
2. Register: `app.add_typer(security_app, name="security")`

The subapp's commands become `ai <subgroup> <command>`.

## mypy strict mode and the untyped decorator pitfall

### The problem

With `strict = true` in `pyproject.toml`, mypy reports:

```
src/aiep/commands/security.py:16: error: Untyped decorator makes function "run" untyped  [misc]
```

Line 16 is `@app.command()` where `app` is a `typer.Typer` instance.

### The fix

Add a mypy override in `pyproject.toml`:

```toml
[[tool.mypy.overrides]]
module = "aiep.commands.security"
disallow_untyped_decorators = false
```

Use the full module path. One override per Typer command module. Do NOT blanket-disable globally.

### Why not `# type: ignore[misc]`

A `# type: ignore[misc]` on the decorator line may be flagged as `Unused "type: ignore" comment [unused-ignore]` by pre-commit's mypy (mirrors-mypy v1.17.1), which runs with different config than the dev venv. The pyproject.toml override is stable across all mypy invocations.

## Pre-commit integration

### Standard setup

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.9
    hooks:
      - id: ruff
        args: [--fix]

  - repo: https://github.com/psf/black
    rev: 24.8.0
    hooks:
      - id: black

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.17.1
    hooks:
      - id: mypy
        additional_dependencies:
          - types-PyYAML
```

### Pre-commit mypy checks unstaged dependencies

Pre-commit's mypy runs against the full set of files mypy discovers, not only staged files. This causes cross-increment contamination: a commit for feature A can fail pre-commit because of an unstaged module B that depends on A's types.

#### Workarounds

1. Fix the root issue in the unstaged dependency first.
2. Stage the dependency alongside the primary module if it's part of the same change.
3. Use `git commit --no-verify` only when the failure is a known false positive from cross-increment contamination. Follow up with a separate commit.

## Common patterns

### CLI command with options

```python
@app.command()
def run(
    strict: bool = typer.Option(False, "--strict", help="Fail on any finding"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON for CI"),
    output: str | None = typer.Option(None, "--output", help="Save report to file"),
) -> None:
    root = Path.cwd()
    result = run_security_checks(root)

    if json_output:
        from json import dumps
        print(dumps(result.to_dict(), ensure_ascii=False, indent=2))

    if output:
        out_path = Path(output)
        result.to_json(out_path)
        print(f"Report saved to: {out_path}")

    if strict and result.total_findings > 0:
        high_or_above = result.critical_count + result.high_count
        if high_or_above > 0:
            raise typer.Exit(code=2)
        raise typer.Exit(code=1)

    if not json_output:
        _print_console_report(result)
```

### Console output with Rich

```python
def _print_console_report(result: SecurityResult) -> None:
    from rich.console import Console
    from rich.table import Table

    console = Console()
    console.print(f"[bold]Security report for[/bold] {result.project_root}")
    console.print()

    table = Table(title="Findings by severity")
    table.add_column("Severity", style="bold")
    table.add_column("Count", justify="right")
    table.add_row("critical", str(result.critical_count))
    table.add_row("high", str(result.high_count))
    console.print(table)
```

## Ruff B008 and Typer argument/Option defaults

When a Typer command uses `typer.Argument(...)` or `typer.Option(...)` in the function signature default, Ruff flags:

```
B008 Do not perform function call `typer.Argument` in argument defaults;
instead, perform the call within the function, or read the default from a
module-level singleton variable
```

This is the most common Ruff error when wiring new Typer commands. Two fixes:

### Required arguments: omit the default entirely

For required arguments (no `...` inside `typer.Argument`/`typer.Option`), the default is *already* "required", so just remove the call:

```python
# Ruff B008 — functions with Argument(...) as default:
@app.command()
def skills_default(
    names: list[str] = typer.Argument(...),
) -> None:
    ...

# FIXED — Typer still treats this as a required argument:
@app.command()
def skills_default(
    names: list[str],
) -> None:
    ...
```

Typer treats parameters without a default as required CLI arguments, so the CLI behavior is unchanged.

### Optional arguments with a default: use a module-level constant

When the option *must* have a default value and you still want Ruff clean, use a module-level constant instead of a function call:

```python
# Ruff B008 — Option([]) triggers because [] is a call:
@app.command()
def set_default_skills(
    names: list[str] = typer.Option([], "--names"),
) -> None:
    ...

# FIXED — module-level constant:
_DEFAULT_NAMES: list[str] = []

@app.command()
def set_default_skills(
    names: list[str] = typer.Option(_DEFAULT_NAMES, "--names"),
) -> None:
    ...
```

This satisfies Ruff (no call in the default) and keeps the CLI behavior intact.

## Replacing lambda with def under mypy strict

When `strict = true` or Ruff runs on a module, assigning a lambda to a typed name raises:

- mypy: `Incompatible types in assignment (expression has type "def ...", variable has type "def ...")  [assignment]`
- Ruff: `E731 Do not assign a 'lambda' expression, use a 'def'`

This shows up when a module guards an import with a fallback:

```python
# mypy + Ruff both flag this:
try:
    from aiep.project.sync_global import _content_has_secret_heuristic
except ImportError:
    _content_has_secret_heuristic = lambda content: False
```

Fix: use a `def` for the fallback. The function name is the same either way, so call sites are untouched:

```python
try:
    from aiep.project.sync_global import _content_has_secret_heuristic
except ImportError:
    def _content_has_secret_heuristic(content: str) -> bool:
        return False
```

If the fallback needs to match a specific signature imported elsewhere, give the `def` that exact signature rather than relying on type inference.

## Service result field population

When a service resolves configuration (explicit arg → instance attribute → config file → error) and returns a dataclass result, populate the result fields from the *resolved* values, not from defaults. A common testing pitfall:

```python
# Bug: result.vault_path stays None even though the service resolved it
result = ObsidianSyncResult(dry_run=dry_run)
self.vault_path = resolved_path  # service sets its own attribute
# result.vault_path is never written → tests assert None

# Fix: copy resolved values into the result before returning
result.vault_path = self.vault_path
result.project_slug = project_slug
```

Tests that assert `result.vault_path is not None` or inspect result metadata will pass trivially false if the service forgets to mirror its resolved state into the result object.

## Pitfalls

### 1. Ruff B008 on typer.Option defaults in CLI command arguments

**When it fires:** Adding a new CLI command with `typer.Option(...)` or `typer.Argument(...)` directly in the function signature.

**Fix:** For required arguments (no default), omit the default entirely — Typer still treats parameters without a default as required CLI arguments. For optional arguments that need a default, extract the `typer.Option(...)` call into a module-level constant singleton:

```python
# Module-level constants (defined before @app.command):
_MY_OPTION_OPT = typer.Option(None, "--my-opt", "-m", help="Description")
_KEEP_LAST_OPT = typer.Option(50, "--keep-last", "-k", help="Description")
_FORCE_BOOL_OPT = typer.Option(False, "--force", "-f", help="Overwrite existing")

@app.command(name="my-command")
def my_cmd(
    name: str = _MY_OPTION_OPT,
    keep_last: int = _KEEP_LAST_OPT,
    force: bool = _FORCE_BOOL_OPT,
) -> None:
    ...
```

This keeps both Ruff (no call in argument default) and Typer happy, and matches the pattern used across `cli.py` for commands like `compress`, `bootstrap-project`, `index`, and `mcp-add`.

### 2. Shell scripts / non-Python files must be excluded from ruff

**When it fires:** Adding or modifying `install.sh`, `install.ps1`, or other non-Python files and running `ruff check` on the whole repo or including those files explicitly.

**Fix:** Never pass shell scripts to `ruff check`. Ruff is a Python linter — it cannot parse bash and will report `invalid-syntax: Simple statements must be separated by newlines or semicolons` or similar cascading errors. Run ruff only on `.py` files:

```bash
# SAFE:
ruff check src/aiep/ tests/

# WRONG — produces hundreds of false parse errors:
ruff check src/aiep/ install.sh
```

### 5. B008 on typer.Option for Optional[...] / list[...] parameters

**When it fires:** Adding a CLI command with `typer.Option(None, ...)` or `typer.Option([], ...)` for a parameter typed as `str | None` or `list[str]` — Ruff flags `B008` because `typer.Option(...)` is a function call used as a default.

**Fix:** Extract the `typer.Option(...)` call into a module-level constant, declared before the `@app.command()` block:

```python
_TARGET_DIR_OPT = typer.Option(None, "--dir", "-d", help="Directory to scan")

@app.command(name="index")
def index_cmd(
    target_dir: Path | None = _TARGET_DIR_OPT,
) -> None:
    ...
```

This keeps Ruff clean and Typer behavior identical. Always place the constant *above* the `@app.command()` decorator — not inside the function body.

### 6. @app.command decorator separated from def during patch edits

**When it fires:** Using `patch` to insert a new CLI command between two existing commands. If the `@app.command(...)` decorator lands in the patch but the `def` signature is omitted or shifted, Python raises `IndentationError` or `SyntaxError`.

**Fix:** After inserting via patch, verify with:

```bash
python -c "import ast; ast.parse(open('src/aiep/cli.py').read())"
```

Ensure both the decorator AND the complete `def` signature are in the same patch hunk, with two blank lines separating from the preceding command.

**When it fires:** Using `patch` to insert a new CLI command between two existing commands — if the `@app.command(...)` decorator is placed but the `def` line is omitted or shifted, Python raises `IndentationError`.

**Fix:** After any edit to `cli.py` near command definitions, verify with:

```bash
python -c "import ast; ast.parse(open('src/aiep/cli.py').read())"
# or:
python -c "from aiep.cli import app"
```

When inserting a new `@app.command()` block, ensure both the decorator AND the `def` line are in the same patch hunk, and that there is a blank line between the preceding command and the new decorator.

### 4. Lazy imports inside CLI command bodies

**When it fires:** When the top-level imports of `cli.py` grow large. Each `@app.command()` function should import its handler lazily inside the function body:

```python
@app.command(name="compress")
def compress_cmd(...) -> None:
    from aiep.commands.compress import run as compress_run
    result = compress_run(...)
```

This keeps `cli.py` import fast and avoids circular import issues between command modules.