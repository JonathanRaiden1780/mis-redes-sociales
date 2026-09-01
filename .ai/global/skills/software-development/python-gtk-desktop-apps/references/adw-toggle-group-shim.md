# Case study: Adw.ToggleGroup on libadwaita 1.5

## Symptom

`port-killer-gui` (linux-port-killer v2.0.0) died instantly. CLI worked fine;
only the GUI crashed:

```
File ".../portkiller/gui/window.py", line 73, in _build_ui
    self._toggle_group = Adw.ToggleGroup()
AttributeError: 'gi.repository.Adw' object has no attribute 'ToggleGroup'
```

## Root cause

`Adw.ToggleGroup` / `Adw.Toggle` were introduced in **libadwaita 1.7**. The host
(Zorin / Ubuntu 24.04) ships **1.5.0**. Every other Adw widget the file used
(`ToastOverlay`, `Banner`, `StatusPage`, `AlertDialog`, `Clamp`, `ToolbarView`,
`HeaderBar`) existed in 1.5 — the single missing symbol was enough to kill the
whole window at construction, since it ran inside `_build_ui()`.

Diagnostic that pinned it in one shot:

```bash
python3 -c "
import gi; gi.require_version('Adw','1'); gi.require_version('Gtk','4.0')
from gi.repository import Adw
for w in ['ToastOverlay','Banner','StatusPage','AlertDialog','Clamp',
          'ToolbarView','HeaderBar','Toggle','ToggleGroup']:
    print(w, hasattr(Adw, w))
"
# → Toggle False / ToggleGroup False, everything else True
```

## Fix — the shim

The call site consumed exactly three things: the notifiable `active-name`
property, `set_active_name()`, and `get_active_name()`. Replicating just that
surface meant one changed line at the construction point.

```python
class _FilterToggles(Gtk.Box):
    """Segmented filter with Adw.ToggleGroup's API.

    ToggleGroup only exists from libadwaita 1.7; on 1.5 (Ubuntu 24.04, Zorin)
    replicate what the window consumes over grouped Gtk.ToggleButton.
    """

    active_name = GObject.Property(type=str, default="")

    def __init__(self, **labels: str) -> None:
        super().__init__(css_classes=["linked"])
        self._buttons: dict[str, Gtk.ToggleButton] = {}
        for name, label in labels.items():
            group = next(iter(self._buttons.values()), None)
            button = Gtk.ToggleButton(label=label, group=group)
            button.connect("toggled", self._on_toggled, name)
            self.append(button)
            self._buttons[name] = button

    def _on_toggled(self, button: Gtk.ToggleButton, name: str) -> None:
        if button.get_active():
            self.active_name = name

    def get_active_name(self) -> str:
        return self.active_name

    def set_active_name(self, name: str) -> None:
        self._buttons[name].set_active(True)
```

Call site — kwargs keep labels and keys together, no positional coupling:

```python
# Filter All / Dev in the title (see _FilterToggles)
self._toggle_group = _FilterToggles(all=_("All"), dev=_("Dev"))
self._toggle_group.set_active_name("all")
self._toggle_group.connect("notify::active-name", self._on_filter_changed)
header.set_title_widget(self._toggle_group)
```

Everything downstream (`get_active_name() == "dev"` in `_on_filter_changed`)
kept working untouched.

## Simplification pass (worth doing)

The first draft carried an `_updating: bool` re-entrancy guard, positional
`(all_label, dev_label)` args, an explicit
`orientation=Gtk.Orientation.HORIZONTAL`, a `first`-button variable for grouping,
and defensive `if self.active_name != name` checks. **All of it was removable:**

- Grouped `Gtk.ToggleButton`s already enforce exclusivity → drop `first` juggling
  in favour of `next(iter(self._buttons.values()), None)`.
- GObject does not emit `notify` when a property is assigned its current value →
  the `!=` guards and `_updating` flag were dead code.
- `Gtk.Box` is horizontal by default.
- A 4-line comment restating the docstring was noise.

Net: 55 insertions → 38, and the behaviour tests were unchanged and still green.
Lesson: write the shim, then delete every guard you cannot make a test fail
without.

## Verification actually performed

```
pytest (app venv, with gi)          66 passed, 0 skipped
pytest PYTHONPATH=src --cov=src     66 passed, coverage 84.67% (gate 80%)
ruff check src/ tests/              All checks passed!
ruff format --check src/ tests/     27 files already formatted
diff src/ vs installed              IDENTICAL
```

Plus a `computer_use` screenshot confirming the "Todos / Dev" segmented control
rendered in the header bar and appeared in the AX tree as two toggle buttons,
and a D-Bus check that the tray registered as `port_killer`.

Ruff needed one inline exemption; the test-file import must sit below the
module-level GTK skip:

```python
from portkiller.gui.window import _FilterToggles  # noqa: E402  (after GTK skip)
```

## Commit shape

Conventional-commit subject, body explaining *why the version gap matters*, no
`Co-authored-by`. Amended once to fold in the simplification and the new test
file, then stopped and waited for an explicit push instruction.
