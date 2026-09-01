# Per-container CPU/RAM/IO from the Docker socket

Answering "which service is eating my RAM?" inside a dashboard that has no
`docker` binary, only the mounted socket. The endpoint is
`GET /containers/<name>/stats?stream=0` — one sample, then close.

Two things are **not** in that payload and have to be derived, and getting either
wrong produces numbers that disagree with `docker stats` and destroy trust in the
whole panel.

## CPU percentage must be computed from deltas

The API gives cumulative nanosecond counters, never a percentage. Docker includes
the *previous* sample as `precpu_stats` precisely so one request is enough:

```python
def _cpu_percent(stats: dict) -> float:
    try:
        cpu = stats["cpu_stats"]
        pre = stats.get("precpu_stats") or {}

        cpu_delta = cpu["cpu_usage"]["total_usage"] - \
            pre.get("cpu_usage", {}).get("total_usage", 0)
        sys_delta = cpu.get("system_cpu_usage", 0) - pre.get("system_cpu_usage", 0)

        if sys_delta <= 0 or cpu_delta < 0:      # first sample, or counter reset
            return 0.0

        # online_cpus is absent on some daemons; fall back to counting percpu_usage
        ncpu = cpu.get("online_cpus") or \
            len(cpu["cpu_usage"].get("percpu_usage") or []) or 1

        return round((cpu_delta / sys_delta) * ncpu * 100.0, 2)
    except (KeyError, TypeError, ZeroDivisionError):
        return 0.0
```

Multiplying by the CPU count is what makes the number match `docker stats`, where
a container saturating four cores reads `400%`, not `100%`.

Guard `sys_delta <= 0`: on the very first sample after a container starts,
`precpu_stats` is empty and the subtraction is meaningless.

## Memory must have the page cache subtracted

`memory_stats.usage` includes the page cache, which inflates the figure — often by
hundreds of MB for anything that reads files. `docker stats` subtracts inactive
file cache, and the key differs by cgroup version:

```python
def _mem_bytes(stats: dict) -> tuple[int, int]:
    try:
        mem = stats["memory_stats"]
        usage = mem.get("usage", 0)
        detail = mem.get("stats") or {}
        # cgroup v1: total_inactive_file · cgroup v2: inactive_file
        cache = detail.get("total_inactive_file", detail.get("inactive_file", 0))
        if cache < usage:                        # never go negative
            usage -= cache
        return usage, mem.get("limit", 0)
    except (KeyError, TypeError):
        return 0, 0
```

`limit` is the *host* total when the container has no explicit memory cap, so a
percentage against it is only meaningful when a limit was actually set. Emit
`mem_pct: null` rather than a misleading 0.5%.

## Sample in parallel — each request costs about a second

The daemon deliberately waits between the two internal samples it needs for the
CPU delta. Serially, fifteen containers is a fifteen-second endpoint:

```python
running = [c["name"] for c in list_containers() if c["state"] == "running"]
with ThreadPoolExecutor(max_workers=min(len(running), 12)) as pool:
    rows = list(pool.map(_stats_one, running))
```

Measured: 2 containers in 2.0 s serially, ~1 s in parallel. Cap the pool so a
large stack doesn't open dozens of simultaneous socket connections.

Sample only **running** containers; a stopped one returns an empty body that
parses to nothing useful.

## Return per-container errors instead of failing the batch

One unreadable container must not blank the whole table:

```python
def _stats_one(name: str) -> dict:
    try:
        stats = json.loads(_request(f"/containers/{quote(name)}/stats?stream=0", timeout=12))
    except (DockerSocketError, json.JSONDecodeError) as e:
        return {"name": name, "error": str(e)}   # rendered as one bad row
    ...
```

Sort the good rows, then append the errored ones at the end so they stay visible.

## Verify against `docker stats`, not against plausibility

The whole point of these formulas is agreement with the reference implementation.
Assert it directly:

```bash
docker stats --no-stream --format "{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.PIDs}}"
curl -s localhost:PORT/api/stats?sort=mem | jq '.containers[] | {name, cpu_pct, mem_used_mb, pids}'
```

Matching to one decimal (82.38 MiB vs 82.4 MB) and exact PID counts means the
cache subtraction and CPU maths are right. A figure that is ~2× or ~30% off is
the signature of a missing `ncpu` multiplier or an unsubtracted cache.

Also unit-test the pure functions with a hand-built payload — no daemon needed,
and it pins the arithmetic:

```python
sample = {
  'cpu_stats': {'cpu_usage': {'total_usage': 200_000_000},
                'system_cpu_usage': 1_000_000_000, 'online_cpus': 4},
  'precpu_stats': {'cpu_usage': {'total_usage': 100_000_000},
                   'system_cpu_usage': 900_000_000},
  'memory_stats': {'usage': 500*1024**2, 'limit': 2048*1024**2,
                   'stats': {'total_inactive_file': 100*1024**2}},
}
assert _cpu_percent(sample) == 400.0            # 100M/100M × 4 cores
assert _mem_bytes(sample)[0] == 400*1024**2     # 500 − 100 cache
```

Cover the borders too: empty dict, missing `precpu_stats`, no memory limit.

## Presentation notes

- Bars scaled to the **maximum observed value**, not to 100% — with a 15 GB host
  limit every bar is invisible otherwise.
- Flag the hogs: red fill above ~80% of one core, or above ~85% of an explicit
  memory limit. Everything else stays neutral so the outlier pops.
- "Top consumer" cards (most CPU / most RAM / most network) answer the actual
  question without reading the table.
- Network and block IO are **cumulative since container start**, not rates. Label
  them as totals or the user reads them as throughput.
- Offer sort by cpu/mem/net/disk/name, and keep auto-refresh opt-in — each
  refresh costs a second of daemon work per container.
