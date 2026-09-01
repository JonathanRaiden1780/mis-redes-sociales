# Headless / CI-safe GTK widget testing

## The trap, restated

```bash
uv run pytest tests/ -q
# → 60 passed          ... and 6 GUI tests silently skipped
```

`uv run` (and `tox`, `nox`, `pipx run`, any fresh `python -m venv` without
`--system-site-packages`) builds an **isolated** environment. PyGObject ships as
a distro package (`python3-gi`), so `import gi` fails there and an
`importorskip` guard turns every GTK test into a skip. Without `-rs`, pytest
prints no reason and the total still looks healthy.

Diagnose in one line:

```bash
uv run python -c "import gi" ; echo "uv venv gi -> $?"
<app-venv>/bin/python -c "import gi; print('gi OK')"
```

Confirm the app venv inherits system packages:

```bash
grep include-system-site-packages <app-venv>/pyvenv.cfg   # want: true
```

## Correct invocation

```bash
<app-venv>/bin/pip install -q pytest pytest-cov
<app-venv>/bin/python -m pytest tests/ -q -rs -p no:cacheprovider
```

- `-rs` — print skip reasons. Non-negotiable for GUI suites.
- `-p no:cacheprovider` — avoid writing `.pytest_cache` into the repo.
- `--no-cov` when running a single file, so a coverage gate configured for the
  whole suite doesn't fail a targeted run.

Coverage may resolve to `site-packages` rather than `src/`. Force the repo tree:

```bash
PYTHONPATH=src <app-venv>/bin/python -m pytest tests/ -q --cov=src/<pkg>
```

and prove the two copies agree:

```bash
diff -q src/<pkg>/gui/window.py \
        <app-venv>/lib/python3.*/site-packages/<pkg>/gui/window.py && echo IDENTICAL
```

## Module-level skip guard

Skip only when the runtime is genuinely unusable — never so broadly that a real
failure hides.

```python
"""Regression: the All/Dev filter must work without Adw.ToggleGroup (libadwaita < 1.7)."""

from __future__ import annotations

import pytest

gi = pytest.importorskip("gi", reason="PyGObject unavailable")

try:
    gi.require_version("Gtk", "4.0")
    gi.require_version("Adw", "1")
    from gi.repository import Adw, Gtk

    if not Gtk.init_check():
        raise RuntimeError("no display")
    Adw.init()
except (ValueError, ImportError, RuntimeError) as exc:  # pragma: no cover - environment
    pytest.skip(f"GTK4/libadwaita unusable: {exc}", allow_module_level=True)

from portkiller.gui.window import _FilterToggles  # noqa: E402  (after the GTK skip)
```

Notes:
- `Gtk.init_check()` returns a bool; `Gtk.init()` can abort the process.
- `Adw.init()` is required before instantiating Adw-derived widgets.
- Catch `ValueError` too — that's what `gi.require_version` raises for a missing
  or wrong-version namespace.
- The post-skip import genuinely violates E402. Silence it inline with a reason.

## Testing widget logic without clicking

No pointer automation, no display interaction, no approval prompts:

```python
@pytest.fixture
def toggles() -> _FilterToggles:
    group = _FilterToggles(all="Todos", dev="Dev")
    group.set_active_name("all")
    return group


def test_starts_on_all(toggles):
    assert toggles.get_active_name() == "all"


def test_set_active_name_changes_filter(toggles):
    toggles.set_active_name("dev")
    assert toggles.get_active_name() == "dev"


def test_toggles_are_mutually_exclusive(toggles):
    toggles.set_active_name("dev")
    assert not toggles._buttons["all"].get_active()


def test_user_click_updates_active_name(toggles):
    toggles._buttons["dev"].set_active(True)     # simulates a real click
    assert toggles.get_active_name() == "dev"


def test_notifies_on_every_change(toggles):
    seen: list[str] = []
    toggles.connect("notify::active-name",
                    lambda g, _p: seen.append(g.get_active_name()))
    toggles.set_active_name("dev")
    toggles.set_active_name("all")
    assert seen == ["dev", "all"]


def test_reselecting_same_filter_does_not_duplicate_notifications(toggles):
    seen: list[str] = []
    toggles.connect("notify::active-name",
                    lambda g, _p: seen.append(g.get_active_name()))
    toggles.set_active_name("dev")
    toggles.set_active_name("dev")
    assert seen == ["dev"]
```

`set_active(True)` on the underlying button is the honest stand-in for a user
click: it fires the same `toggled` signal GTK would. Reaching into `_buttons` is
acceptable in the widget's own regression test — it is what proves exclusivity.

The last test is the one that pins down the no-duplicate-notify behaviour and
therefore justifies deleting the re-entrancy guard.

## Prove the test can fail

```bash
cp src/<pkg>/gui/window.py /tmp/window.fixed.py
git show <pre-fix-sha>:src/<pkg>/gui/window.py > src/<pkg>/gui/window.py
<app-venv>/bin/python -m pytest tests/test_gui_toggles.py -q --no-cov
# expect: ImportError / TypeError at collection — RED
cp /tmp/window.fixed.py src/<pkg>/gui/window.py
git diff --stat
```

If the fix is already committed, `git stash` reverts to a tree that *includes*
it, and the test misleadingly passes. Always name the pre-fix blob explicitly.
