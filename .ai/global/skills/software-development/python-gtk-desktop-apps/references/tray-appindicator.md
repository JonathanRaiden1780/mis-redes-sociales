# System tray / AppIndicator on GTK4 desktops

## Why trays are a separate process

GTK4 removed `Gtk.StatusIcon`. The common pattern is a **second, lightweight
process** on GTK3 + `AyatanaAppIndicator3`, reusing the app's core modules while
the main window stays GTK4. Expect two entry points, e.g.:

```toml
[project.gui-scripts]
app-gui  = "pkg.gui.app:main"
app-tray = "pkg.tray:main"
```

So "the tray is broken" and "the GUI is broken" are independent diagnoses — check
which binary actually fails before touching code.

## Check the namespaces first

```bash
python3 -c "
import gi
for ns in ('AyatanaAppIndicator3','AppIndicator3'):
    try:
        gi.require_version(ns,'0.1'); __import__('gi.repository', fromlist=[ns])
        print(ns,'OK')
    except Exception as e:
        print(ns,'FAILS:', type(e).__name__, e)
try:
    gi.require_version('Gtk','3.0'); print('Gtk3 OK')
except Exception as e:
    print('Gtk3 FAILS:', e)
"
```

Modern distros ship only the Ayatana fork; legacy `AppIndicator3` being absent is
normal and not the bug. If **both** are missing:

```bash
sudo apt install gir1.2-ayatanaappindicator3-0.1
```

A well-written tray already prints this hint and exits 1 when neither namespace
loads — read the stderr before assuming a crash.

## Pitfall: `timeout` trips the single-instance guard

Trays typically dedupe themselves by scanning process cmdlines:

```python
def _already_running() -> bool:
    me = os.getpid()
    for process in psutil.process_iter(["pid", "cmdline"]):
        cmdline = process.info.get("cmdline") or []
        if process.info["pid"] == me:
            continue
        if any(Path(part).name == "app-tray" for part in cmdline):
            return True
    return False
```

Running `timeout 12 app-tray` puts the string `app-tray` into the **`timeout`
process's own cmdline**. The real tray sees a "duplicate", returns 0, and exits
producing **no output at all** — indistinguishable from a silent crash. Same trap
applies to `strace app-tray`, `time app-tray`, wrapper shells, and
`bash -c "app-tray"`.

Launch it for real instead and poll:

```
terminal(command="cd <dir> && exec app-tray", background=true)
process(action="poll", session_id=...)      # expect status: running
```

`exec` matters — without it the recorded pid is the shell's, and the wrapper's
cmdline can itself trip the guard.

## Prove the indicator actually registered

Process alive is not the same as icon visible. Ask the shell's watcher:

```bash
gdbus call --session --dest org.kde.StatusNotifierWatcher \
  --object-path /StatusNotifierWatcher \
  --method org.freedesktop.DBus.Properties.Get \
  org.kde.StatusNotifierWatcher RegisteredStatusNotifierItems
```

A registered tray appears in the returned array:

```
':1.486862@/org/ayatana/NotificationItem/port_killer'
```

Cross-check the owning bus name and pid:

```bash
busctl --user list | grep -iE "<app>|StatusNotifierItem"
```

Note the GUI process may own a well-known name (e.g.
`io.github._686f6c61.PortKiller`) while the tray shows only as a `:1.x` unique
name with an Ayatana object path — that is expected, not a fault.

Introspecting `org.kde.StatusNotifierItem-<pid>-1` often fails with "not provided
by any .service files" because Ayatana registers under
`/org/ayatana/NotificationItem/...` instead. Don't chase that error; trust the
`RegisteredStatusNotifierItems` list.

## Leave the system as you found it

The tray is a long-lived user-facing process. If it was running before you
started, leave it running; only kill instances you launched:

```bash
pkill -f app-gui        # test GUI instances
ps aux | grep app- | grep -v grep    # re-list to confirm what survived
```

State explicitly in your report which processes you intentionally left alive.
