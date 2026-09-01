# Background jobs inside a service: the dead-scheduler trap

A service that is supposed to do something on a timer — send due reminders, run a
nightly analysis, poll an upstream — fails in a way that produces **no error at
all**. Nothing crashes, the healthcheck stays green, the endpoint that triggers
the job manually works perfectly. It simply never fires on its own, and nobody
finds out until the notification that should have arrived doesn't.

## Verify the wiring, not the docstring

The strongest signal that a job is scheduled is also the least reliable one: the
code says so. Found in a real service:

- `night_job.py` docstring: *"Scheduled to run at 3 AM daily."*
- `requirements.txt`: `APScheduler==3.10.4`
- Every module imported cleanly, the service was healthy for weeks

…and **nobody ever called `.start()`**. The scheduler library was a dependency
that was installed and never instantiated. The job only ran when a human hit
`POST /api/night-job/trigger`.

So don't read the docstring — trace the call. Three greps settle it:

```bash
# 1. Who instantiates a scheduler at all?
grep -rn "BackgroundScheduler\|BlockingScheduler\|add_job\|schedule\." --include=*.py .

# 2. Who actually starts one? (the step that's usually missing)
grep -rn "\.start()" --include=*.py .

# 3. Who imports the job module, and from where?
grep -rn "night_job\|from jobs import" --include=*.py .
```

If (1) matches only inside the job module and (3) matches only a manual HTTP
route, the timer does not exist. A scheduling dependency in the lockfile proves
intent, never behaviour.

Apply the same suspicion to anything whose whole purpose is to happen without
being asked: cron entries, `setInterval`, retry loops, queue consumers, watchdogs.
"It's meant to run nightly" is a hypothesis.

## Make the schedule observable

The root cause of the silence is that a schedule has no natural surface. Give it
one — a status endpoint that reports the *next* firing time turns an invisible
subsystem into a checkable one:

```python
@app.route("/api/scheduler/status")
def scheduler_status():
    jobs = [] if _scheduler is None else [
        {"id": j.id, "name": j.name,
         "next_run": j.next_run_time.isoformat() if j.next_run_time else None}
        for j in _scheduler.get_jobs()
    ]
    return jsonify({
        "running": _scheduler is not None,
        "jobs": jobs,
        "pending": len(due_items()),   # work waiting, independent of the timer
    })
```

```json
{"running": true,
 "jobs": [{"id": "reminder-check", "next_run": "2026-08-24T18:00:00-06:00"},
          {"id": "night-analysis", "next_run": "2026-08-25T03:00:00-06:00"}],
 "pending": 0}
```

`running: false` or a missing `next_run` is now a diagnosable state instead of a
guess. Pair it with a `POST /api/<thing>/check` that forces one pass, so the flow
can be exercised end to end without waiting for the clock, and log the resolved
configuration on boot:

```
Scheduler active: reminders every 1h (24h lead), night analysis at 03:00
```

That single line is what confirms the fix actually took effect after a redeploy.

## Recurring work must reschedule, not close

The bug that silently caps a recurring job at exactly one occurrence: treat
"handled" as "done". A bimonthly reminder marked `completed` after its first
notification never fires again, and the user's next clue is a bill they missed two
months later.

On success, mark the current row notified **and create the next occurrence**;
only a genuinely one-off item gets closed:

```python
RECURRENCE_DAYS = {"daily": 1, "weekly": 7, "monthly": 30,
                   "bimonthly": 60, "quarterly": 90, "yearly": 365}

conn.execute("UPDATE items SET notified = 1 WHERE id = ?", (item["id"],))

days = RECURRENCE_DAYS.get((item.get("recurrence") or "").lower())
if days:
    next_due = (datetime.fromisoformat(item["due_date"])
                + timedelta(days=days)).isoformat()
    conn.execute(
        "INSERT INTO items (title, description, due_date, recurrence)"
        " VALUES (?,?,?,?)",
        (item["title"], item["description"], next_due, item["recurrence"]),
    )
else:
    conn.execute("UPDATE items SET completed = 1 WHERE id = ?", (item["id"],))
```

Compute the next date from the **previous `due_date`**, not from `now()` —
anchoring on the run time lets the schedule drift by however late the job fired.

## A failed send is not a delivered send

If the notification transport fails (token missing, API down, rate limit), do not
mark the item as notified — the row is the only retry queue there is:

```python
if notify(text):          # returns False on failure
    mark_and_reschedule(item)
else:
    logger.warning("Could not notify: %s", item["title"])
    # notified stays 0 → next pass retries
```

Two things fall out of this. The transport wrapper must return a real boolean
rather than swallowing exceptions and returning `None`, and the periodic pass
becomes self-healing: whatever was undeliverable during an outage goes out on the
next tick. Set `coalesce=True` so a backlog of missed ticks collapses into one
run instead of a burst.

## One scheduler per deployment, not per worker

An in-process scheduler multiplies with the process. Under gunicorn with four
workers, four schedulers fire the same job and the user gets four identical
messages. Guard it with a PID lock that also recovers from an unclean shutdown:

```python
def _acquire_lock() -> bool:
    try:
        fd = os.open(str(LOCK_PATH), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.write(fd, str(os.getpid()).encode())
        os.close(fd)
        atexit.register(lambda: LOCK_PATH.unlink(missing_ok=True))
        return True
    except FileExistsError:
        try:
            os.kill(int(LOCK_PATH.read_text().strip()), 0)
            return False                      # holder alive → stand down
        except (ValueError, ProcessLookupError, PermissionError, OSError):
            LOCK_PATH.unlink(missing_ok=True)  # stale lock → reclaim
            return _acquire_lock()
```

Checking existence alone deadlocks the service after any hard kill, because the
orphaned lock file outlives its process. Also expose an off switch
(`ENABLE_SCHEDULER=false`) so the same image can run as a scheduler-less replica.

Make every knob an env var with a sane default — `ENABLE_SCHEDULER`,
`CHECK_INTERVAL_HOURS`, `LEAD_HOURS`, `JOB_HOUR` — and set `TZ` explicitly in
compose. A cron expression means nothing until you know which timezone resolved it.

Wrap the job body so a raised exception can't take the scheduler thread with it:

```python
def _run_job():
    try:
        run_analysis()
    except Exception as e:
        logger.error("Job failed: %s", e)   # thread survives; next tick still fires
```

And when tearing down, `shutdown()` on an already-stopped scheduler raises
`SchedulerNotRunningError` — guard the `atexit` handler or every clean exit prints
a traceback.

## Registering the same route twice stops the service booting

Adding a manual-trigger endpoint that a blueprint already defines is an easy
duplicate, and Flask refuses to start rather than warning:

```
AssertionError: View function mapping is overwriting an existing endpoint function
```

Before adding any route, check the whole tree — including blueprints registered
elsewhere:

```bash
grep -rn "api/night-job\|@app.route\|@bp.route" --include=*.py .
```

Caught exactly this: `/api/night-job/trigger` existed in `analysis_routes.py`, and
re-adding it in `server.py` would have taken the service down on the next deploy.

## Test the schedule without waiting for it

All of the above is verifiable in seconds against a real SQLite file and a fake
notifier — no container, no clock-watching. Insert rows at deliberate offsets
(`-1h` overdue, `+2h` imminent, `+40d` far) and assert on the resulting state:

| Check | Why it matters |
|---|---|
| Only items inside the lead window are selected | Bounds the notification horizon |
| Recurring row is duplicated at `+N` days and stays active | Otherwise it fires exactly once, ever |
| One-off row is closed and *not* duplicated | Prevents zombie items |
| Second pass notifies nothing | `notified` flag actually suppresses |
| Failed transport leaves `notified = 0` | Retry semantics hold |
| Scheduler reports its expected job ids | Proves `.start()` really ran |
| A second `start_scheduler()` returns `None` | Lock prevents duplicate delivery |
| `ENABLE_SCHEDULER=false` yields no scheduler | Off switch works |

Assert on the **date delta** (`+60` days) rather than a literal timestamp, or the
test rots the day it's run. Then confirm on the deployed service with
`/api/scheduler/status` — a `next_run` in the future is the proof the wiring
landed, which is the exact evidence the original code never had.
