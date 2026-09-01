---
name: python-gtk-desktop-apps
description: "Fix PyGObject GTK4/libadwaita apps and test them."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [gtk, gtk4, libadwaita, pygobject, python, desktop, appindicator, tray, gui-testing]
    related_skills: [systematic-debugging, test-driven-development, requesting-code-review]
---

# Python GTK4 / libadwaita Desktop Apps

## When to Use

- A PyGObject GUI dies with `AttributeError: 'gi.repository.Adw' object has no attribute 'X'`
- Porting/patching a GTK4 + libadwaita app to run on an older distro runtime
- Writing tests for GTK widgets that must not silently skip
- A system-tray / AppIndicator entry doesn't appear or the process exits instantly
- Any "this app used to work and now doesn't" on a GTK desktop

## Prime Directive: Version-Gate, Don't Assume

libadwaita moves fast and distros lag badly. An app written against
libadwaita 1.7 **hard-crashes at window construction** on Ubuntu 24.04 / Zorin,
which ship **1.5.0**. The traceback points at the widget, not at the version —
so always check the runtime version before theorizing.

```bash
python3 -c "
import gi; gi.require_version('Adw','1')
from gi.repository import Adw
print('libadwaita', Adw.MAJOR_VERSION, Adw.MINOR_VERSION, Adw.MICRO_VERSION)
print('ToggleGroup:', hasattr(Adw,'ToggleGroup'))
"
apt list --installed 2>/dev/null | grep -i libadwaita
```

Probe **every** Adw widget the file touches in one shot, so you fix all gaps in
one pass instead of crash-by-crash:

```bash
python3 -c "
import gi; gi.require_version('Adw','1'); gi.require_version('Gtk','4.0')
from gi.repository import Adw
for w in ['ToastOverlay','Banner','StatusPage','AlertDialog','Clamp',
          'ToolbarView','HeaderBar','Toggle','ToggleGroup','Spinner','BreakpointBin']:
    print(w, hasattr(Adw, w))
"
```

Grep the source for what it actually uses before probing:
`search_files(pattern=r"Adw\.\w+", path="src/")`

## The Shim Pattern (preferred fix)

Do **not** rewrite the UI or bump the user's distro. Replace the too-new widget
with a plain-GTK subclass exposing **the same API the call site already
consumes**, so only the construction line changes. Full worked example:
`references/adw-toggle-group-shim.md`.

Key points:
- `GObject.Property(type=str)` is what makes `connect("notify::active-name", ...)`
  work — the whole reason the call site keeps working unchanged.
- Pass `group=` to the **constructor**; `Gtk.ToggleButton` grouping gives radio
  exclusivity for free. No manual `_updating` re-entrancy flag is needed: the
  `toggled` handler only acts on the button becoming active, and assigning an
  unchanged GObject property emits no notify. Resist guard flags — they were
  removable dead weight in review.
- `css_classes=["linked"]` preserves the segmented look.
- `Gtk.Box` defaults to horizontal; don't spell out the orientation.

## Testing GUI Code — The Silent-Skip Trap

**Highest-value lesson here.** A GUI suite that reports `60 passed` while
quietly skipping every GTK test looks identical to success.

PyGObject is a **system** package (`python3-gi`); it is essentially never in a
fresh isolated venv. So:

```bash
uv run pytest tests/ -q        # ⚠ isolated venv → NO gi → GUI tests skip
```

The suite goes green, your fix is unverified, and nothing warns you.

Run GUI tests with an interpreter that actually has `gi` — a venv created with
`--system-site-packages` (check `include-system-site-packages = true` in
`pyvenv.cfg`):

```bash
<app-venv>/bin/pip install -q pytest pytest-cov
<app-venv>/bin/python -m pytest tests/ -q -rs -p no:cacheprovider
```

**Always pass `-rs`** so skips print their reason. Then read the count:
`66 passed` and `66 passed, 6 skipped` are very different outcomes. Core/non-GUI
tests can still run under `uv`.

To exercise the repo tree rather than the installed copy:
```bash
PYTHONPATH=src <app-venv>/bin/python -m pytest tests/ -q --cov=src/<pkg>
diff -q src/<pkg>/mod.py <venv>/lib/python3.*/site-packages/<pkg>/mod.py
```

Module-level skip guard and widget-logic test patterns (no clicking required):
`references/gtk-headless-testing.md`.

## Prove the Regression Test Actually Fails

A test written after the fix may assert nothing real. Verify it goes RED against
the pre-fix code, then restore:

```bash
cp src/<pkg>/gui/window.py /tmp/window.fixed.py
git show <pre-fix-sha>:src/<pkg>/gui/window.py > src/<pkg>/gui/window.py
<app-venv>/bin/python -m pytest tests/test_gui_toggles.py -q --no-cov   # expect RED
cp /tmp/window.fixed.py src/<pkg>/gui/window.py
git diff --stat        # confirm restored
```

`git stash` is the wrong tool when the fix is already committed — it reverts to a
tree that *contains* the fix. Check out the specific pre-fix blob.

## Editable vs Installed Copies

Editing `src/` changes nothing if the launcher imports `site-packages`.
Confirm where the import resolves, and reinstall after edits:

```bash
<venv>/bin/python -c "import <pkg>.gui.window as w; print(w.__file__)"
<venv>/bin/pip install -q --no-deps --force-reinstall .   # or -e . for dev loops
```

Leave the app in the same install mode you found it.

## Verifying a GUI Actually Runs

Never conclude "it works" from an exit code alone.

```bash
timeout 20 app-gui 2>&1 | grep -v libEGL   # exit 124 = still alive = good sign
```

`libEGL warning: DRI3 error` is benign noise; filter it out.

For a real check, launch in background (`terminal(background=true)`, use `exec`
so the pid is the app, never `&`/`nohup`), then screenshot with
`computer_use(action='capture', app='<name>', mode='som')` and confirm the widget
renders and is in the AX tree. Clicking may require user approval — if it times
out, assert the same behaviour programmatically instead of retrying the click.
Kill test instances afterwards (`pkill -f app-gui`) and re-list to confirm.

Runtime probes: `ps aux | grep <app>`, `busctl --user list | grep <app>`.

## System Tray / AppIndicator

GTK4 dropped status icons, so trays commonly live in a separate GTK3 +
`AyatanaAppIndicator3` process. Namespace checks, D-Bus registration proof, and
the `timeout`-trips-single-instance-guard pitfall:
`references/tray-appindicator.md`.

## Generalizable lesson: verify the loop is red-capable

This bug class taught a rule that outlives GTK. A test loop that *cannot fail* is
worse than no loop — it manufactures false confidence. Two silent degradations to
check for in **any** stack:

- **Skips masquerading as passes.** Missing system dep, no display, absent optional
  package → the tests covering your bug become skips while the total still looks
  healthy. Surface skip reasons (`pytest -rs`) and read the skipped count.
- **Wrong interpreter / wrong copy.** Isolated runners build a fresh venv lacking
  system packages; editing `src/` proves nothing if the code under test resolves to
  an installed `site-packages` copy. Confirm where the import comes from.

Then prove the new test goes RED against pre-fix code before trusting it green.

## Pitfalls

1. `uv run pytest` silently skips GUI tests (no `gi` in the isolated venv). Use
   the system-site-packages venv and always `-rs`.
2. A skip-heavy green suite is not a pass. Compare passed *and* skipped counts.
3. `git stash` won't reveal a pre-fix state once the fix is committed; use
   `git show <sha>:<path>`.
4. `AttributeError` on an `Adw.*` widget = version gap, not a typo. Check the
   runtime version first.
5. Editing `src/` without reinstalling tests the old installed copy.
6. `libEGL`/`DRI3` warnings are noise, not the bug.
7. `timeout <n> <tray-app>` false-positives single-instance detection.
8. Don't repackage or upgrade the user's distro to satisfy a widget — shim it.
9. Assigning an unchanged GObject property emits no `notify`; extra re-entrancy
   flags are dead code.

## Workflow

1. Reproduce and read the traceback to the exact widget/line.
2. Probe the runtime version and every `Adw.*` symbol the file uses.
3. Shim the too-new widget, preserving the call site's API.
4. Add a regression test; prove it fails pre-fix.
5. Run the FULL suite with the `gi`-capable interpreter, `-rs`, zero skips.
6. `ruff check` + `ruff format --check` on `src/` and `tests/`.
7. Reinstall, launch, screenshot-verify, then clean up test processes.
8. Commit (no `Co-authored-by`), report real numbers, and wait for an explicit
   push instruction.

Report the actual commands and counts as evidence — never a summary of intent.
Worked case study: `references/adw-toggle-group-shim.md`.
