---
name: docker-stack-management
description: >
  Docker stack management for ARM64 NAS devices.
version: 1.0.0
platforms: [linux]
metadata:
  hermes:
    tags: [docker, nas, arm64, synology, healthchecks, portainer, docker-compose]
    category: infrastructure-platform
---

# Docker Stack Management for ARM64 NAS

Deploy and debug Docker Compose stacks on ARM64 NAS devices (Synology, etc.).

## Verify locally before reporting done

The stack runs on a remote NAS deployed via Portainer, which makes "pushed the
commit, now pull and redeploy" feel like a finished job. It is not — that is a
handoff, not a verification, and shipping on it has repeatedly delivered broken
code.

**Run locally whatever can run locally, before the commit.** Parse every file
you touched (`node --check` on JS too — a stray backtick silently kills the whole
script), import the app with production-shaped env, exercise the routes against a
mock upstream, and open any page in a browser. Defer to the user only what is
genuinely NAS-bound: ARM64 pulls, `/volume1` mounts, physical hardware.

A green backend does not mean a working feature. `/api/services` and
`/api/config` returned flawless JSON while the dashboard rendered no links at
all, because the bug was in how the frontend consumed the shape.

Full ladder, port-shifting recipe, and mock-upstream pattern:
`references/verifying-before-reporting.md`.

## Healthcheck Patterns

Alpine-based images (node:alpine, python:3.11-slim) **do not include curl**. Use these:

| Service | Healthcheck | Why |
|---------|-------------|-----|
| Any Alpine HTTP service | `wget -qO- http://localhost:PORT/endpoint` | wget is in busybox |
| Navidrome | `wget -qO- http://localhost:4533/ping` | `/health` doesn't exist; `/ping` does |
| Ollama | `ollama list` | Image has no curl; `ollama` binary is present. **Passes even with zero models pulled** — see `references/llm-inference-sizing.md` |
| Cloudflare Tunnel | Remove healthcheck | cloudflared doesn't expose `/health` and has no curl |
| Tailscale | `tailscale status --peers=false` | Native CLI check |
| Long-polling workers (no HTTP) | `pgrep -f script.py > /dev/null \|\| exit 1` | Process liveness, not HTTP |

**Rule:** If the image doesn't have curl, don't use curl in healthchecks.

## A green healthcheck is not a working service

Healthchecks prove a process is listening, not that it can do its job. Ollama
answers `GET /api/tags` with `200 {"models": []}` and `ollama list` exits 0 with
no models installed — both pass while every prompt fails. Same shape for any
service whose readiness depends on data (a pulled model, a synced report, a
provider API key) rather than on the port being open.

When a service is "healthy" but the feature is broken, probe the **capability**,
not the port:

```bash
curl -s http://HOST:11434/api/tags | jq '.models[].name'   # is a model actually there?
curl -s http://HOST:8792/health                            # does it report degraded?
```

Prefer healthchecks that fail for the real reason, and have services report
`status: degraded` with a `*_connected` flag plus a detail string when a
dependency is unreachable. That turns an invisible failure into a visible one.

## Every service needs an explicit network

Without a `networks:` key, Compose services land on a default bridge where
service-name DNS does not resolve the way you expect, and a container that
proxies to others fails with:

```
<urlopen error [Errno -3] Temporary failure in name resolution>
```

Declare one network and attach **every** service to it:

```yaml
services:
  nas-dashboard:
    networks: [nas-net]
  nas-llm-server:
    networks: [nas-net]

networks:
  nas-net:
    name: nas-net
    driver: bridge
```

**`network_mode: host` and `networks:` are mutually exclusive.** A service using
host networking (Tailscale, typically) must not list `networks:` — Compose
rejects the file. Leave that one service on host mode and reach it via the host IP.

Symptom map for a proxying container:

| Symptom | Cause |
|---|---|
| `Temporary failure in name resolution` | Target not on the same user-defined network |
| `Connection refused` | Name resolved; target process down or wrong port |
| `502` from your own proxy endpoint | Either of the above, wrapped by your handler |

## Consolidating a UI view can orphan its data source

Merging a dashboard's endpoint-explorer tab into the service cards looked like
pure simplification, but the cards read a hand-maintained `extra_endpoints` map
(9 routes, 4 services) while the deleted tab read the generated catalog
(42 routes, 13 services). Removing the tab silently made 33 endpoints
unreachable, with nothing erroring — the cards simply rendered fewer buttons.

**Before deleting or merging a view, ask what it was the sole consumer of**, and
compare counts from both sources rather than eyeballing the page. Two numbers
that should match and don't is the entire diagnosis.

Related traps on that surface: an endpoint tester that always issues GET makes
every POST route look broken (the `400` reads as a service failure), and a
dashboard proxy that only implements `do_GET` returns 501 for POST. Card links,
per-service base-URL config, verb badges, and the browser-click isolation
technique: `references/service-dashboard-patterns.md`.

## Portainer Script Injection

Portainer injects its own scripts (`contentLogger.js`, `polyfills.js`, `contentScript.js`, `detector.js`) into served pages. This **breaks inline JavaScript**.

**Symptom:** `Uncaught ReferenceError: showTab is not defined` — even though the function exists in the code.

**Solution:** Move all JS to an external file:
```html
<!-- Instead of inline <script>...</script> -->
<script src="app.js"></script>
```

Serve it with correct Content-Type:
```python
# In your HTTP server
if self.path == "/app.js":
    self._serve_file("app.js", "application/javascript")
```

## Docker Socket API for Container Logs

Read container logs without the `docker` binary by talking to the Docker daemon via Unix socket.

**Socket path:** `/var/run/docker.sock`

**Mount in compose:**
```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro  # :ro = read-only
```

**API calls (do NOT pin version — it breaks on newer Docker):**
```bash
# List containers
curl -s --unix-socket /var/run/docker.sock "http://localhost/containers/json?all=1"

# Get logs (multiplexed format)
curl -s --unix-socket /var/run/docker.sock "http://localhost/containers/NAME/logs?stdout=1&stderr=1&timestamps=1&tail=200"
```

**Critical:** Do NOT use `/v1.43/` in URLs. Docker 29+ rejects pinned versions with "client version is too old". Use `/containers/json` (no version) — the daemon negotiates.

## Docker Log Demultiplexing

Docker logs come **multiplexed**: each frame has an 8-byte header:
```
[stream:1 byte][0000:3 bytes][length:4 bytes big-endian][payload:length]
```
- stream=1 → stdout
- stream=2 → stderr

**Containers with `tty=true`** emit plain text without headers.

**Also clean ANSI escape codes** (`[32m`, `[0m`) before displaying in HTML.

## Per-container resource stats need derived maths

`GET /containers/<name>/stats?stream=0` does **not** contain a CPU percentage and
its memory figure includes the page cache. Both have to be computed, or your
numbers won't match `docker stats` and the panel becomes untrustworthy:

- **CPU** — derive from `cpu_stats` vs `precpu_stats` deltas, then multiply by the
  core count (that factor is why a container pinning 4 cores reads `400%`).
- **RAM** — subtract inactive file cache (`total_inactive_file` on cgroup v1,
  `inactive_file` on v2) from `usage`. Without it the figure is inflated by
  hundreds of MB.
- **Sample in parallel.** The daemon waits ~1 s per request to produce the CPU
  delta, so fifteen containers serially is a fifteen-second endpoint.

Always validate against `docker stats --no-stream` — agreement to one decimal and
exact PID counts is the proof. Being ~2× or ~30% off is the signature of a missing
core multiplier or unsubtracted cache. Formulas, per-container error handling,
unit-testable payload and presentation rules:
`references/container-resource-stats.md`.

## Telegram Bot Token Conflict

Telegram allows **only ONE** `getUpdates` consumer per bot token. If two processes poll the same token:

```
Conflict: terminated by other getUpdates request; make sure that only one bot instance is running
```

**Solution:** Each consumer needs its own bot token from @BotFather (`/newbot`).

Common conflict sources:
- Hermes gateway + nas-bot using the same token
- Multiple instances of the same bot

## Match the credential to the provider's auth MODE

Before wiring any credential into compose, check whether the provider wants an
**API key** or an **OAuth token pair**. Passing a key to an OAuth provider is
silently useless: the container starts clean and then fails on every single
request with an authentication error.

Inspect a working install's credential store to find out, rather than assuming —
`access_token` + `refresh_token` means OAuth and there is no key to pass. Mount
the authenticated store into the container instead (the `refresh_token` lets it
renew itself).

Corollary: **do not reuse one env var for two consumers.** An agent and an API
wrapper in the same stack are different clients with potentially different auth
models; give them separate variables (`NOUS_API_KEY` vs `LLM_API_KEY`) so they
cannot be conflated.

Have the entrypoint print which auth mode it detected, and warn without exiting
when it found none — otherwise the failure is invisible until someone sends a
message. Details, entrypoint snippet, pairing-inside-the-container, and a
Docker-free way to test entrypoint branches with `PATH` stubs:
`references/containerising-hermes-agent.md`.

## When you also want an agent, not just an API

An API wrapper with mode prompts and a full agent are complementary, not
alternatives — but a stack that accretes both plus a task-runner plus a chat bot
*does* end up with real redundancy. When the user asks "aren't these the same
thing?", audit it honestly and say what to switch off; a second messaging bot
alongside an agent gateway is almost always waste.

The line that justifies keeping both: **the agent decides** (open-ended input,
tools, memory) while **the wrapper serves a contract** (fixed routes, stable JSON)
that a frontend can depend on.

Also warn about this before the user relies on it: **agent memory has no clock.**
Telling an agent a recurring fact makes it *know* it, not *act* on it — firing a
notification needs a row with a due date plus a scheduled job that reads it.
Verdict-table format, the memory-vs-reminder distinction, and how to bootstrap an
agent's knowledge of its own stack: `references/agent-vs-api-service-boundaries.md`.

## Exposing an agent over HTTP

When a frontend needs the agent's judgement, not just stored data, build a thin
HTTP bridge that invokes the agent's binary per request. The bridge builds
domain prompts from structured JSON and returns only the final text. Key points:

- `hermes -z` prints only the final answer. That is what you return.
- One request = one full agent turn. 20-60 s is normal; cap concurrency.
- CORS headers are required for browser callers.
- Let the agent decide what to do with a reminder (vs a fixed template) —
  a "plan project X" reminder gets *planned*, not just echoed.
- Fall back to a fixed template if the bridge is down.

Core loop, prompt construction, auth, CORS, and the scheduler-calls-agent
pattern: `references/http-bridge-for-agents.md`.

## Exposing an agent over HTTP

When a frontend needs the agent's judgement, not just stored data, build a thin
HTTP bridge that invokes the agent's binary per request. The bridge builds
domain prompts from structured JSON and returns only the final text. Key points:

- `hermes -z` prints only the final answer. That is what you return.
- One request = one full agent turn. 20-60 s is normal; cap concurrency.
- CORS headers are required for browser callers.
- Let the agent decide what to do with a reminder (vs a fixed template) —
  a "plan project X" reminder gets *planned*, not just echoed.
- Fall back to a fixed template if the bridge is down.

Core loop, prompt construction, auth, CORS, and the scheduler-calls-agent
pattern: `references/http-bridge-for-agents.md`.

## Facial recognition on camera feeds

Double-Take integrates with Frigate over MQTT, but **it requires CompreFace
which is too heavy for CPU-only NAS devices** (15GB RAM, no GPU). The verified
working alternative is a custom lightweight service using `face_recognition`
(dlib) that runs directly on CPU.

```
Frigate detects person → publishes to MQTT (frigate/events)
  → Custom face-recognizer receives event, downloads snapshot
  → Compares against /known_faces/<name>/*.jpg
  → Publishes name: frigate/cateye/person/jh
  → HA automation fires
```

Service config, training faces, HA automation example, and the full
face-recognizer service pattern (Dockerfile, recognize.py, MQTT loop):
`references/facial-recognition-service.md`.

The Double-Take reference (mount-path pitfalls, CompreFace dependency,
training) is preserved at `references/frigate-tuya-integration.md` section
"Facial recognition with Double-Take" for reference — but prefer the custom
service for ARM64 NAS.

## A documented schedule is not a running schedule

The job that is supposed to fire on a timer is the one most likely to be silently
dead: nothing crashes, the healthcheck stays green, and the manual-trigger
endpoint works perfectly. Found in this stack — a docstring saying *"scheduled to
run at 3 AM daily"*, `APScheduler` in `requirements.txt`, and **no call to
`.start()` anywhere**. It had never run unattended.

Before believing any claim of periodic work, trace the wiring:

```bash
grep -rn "BackgroundScheduler\|add_job" --include=*.py .   # is one built?
grep -rn "\.start()" --include=*.py .                      # is one started?
```

A scheduling library in the lockfile proves intent, never behaviour. Then make the
schedule observable with a status endpoint that reports each job's **next** firing
time, so `running: false` becomes diagnosable instead of invisible.

Three follow-on traps worth knowing before you write the job: recurring work must
**reschedule rather than close** (marking it done caps it at one occurrence
forever), a **failed send must not be marked delivered** (the row is the only retry
queue), and an in-process scheduler **multiplies with gunicorn workers** unless a
PID lock holds it to one. Detection greps, status-endpoint shape, PID lock with
stale-lock recovery, the duplicate-Flask-route boot failure, and a clock-free test
matrix: `references/scheduled-jobs-in-services.md`.

## Service Account Mount Path

If a service expects a file at a specific path, the mount destination must match exactly:

```yaml
# Wrong: service expects /app/config/service-accounts/minegocio-mk.json
- /volume1/Docker/secrets/service-account.json:/app/config/service-account.json:ro

# Correct: mount to the exact path the code reads
- /volume1/Docker/secrets/service-account.json:/app/config/service-accounts/minegocio-mk.json:ro
```

## Bind-mounted config is the human-editable surface

Containers write their config as root, so the user eventually needs to hand-edit
a bind-mounted file and hits `EACCES`. Two rules before you hand over any command:

**Never `chmod 600` a directory.** On a directory the `x` bit means *may
traverse*; without it the contents are unreachable even for the owner, and every
container mounting under that path starts failing. Directories `755`, files
`644`, `600` only for actual secrets. Recovery is `sudo chmod 755 <dir>`.

**Probe for the ACL tool before prescribing one.** `synoacltool` is missing from
some DSM builds and usually off the user's `PATH` (`sudo: synoacltool: command
not found`). Check `which synoacltool || ls /usr/syno/bin/synoacltool` and
`which setfacl`, then use whichever exists — POSIX `setfacl -d` is the portable
equivalent of Synology's `fd--` inheritance flag.

Also: ACL inheritance is never retroactive (already-existing directories keep
their old modes), `scp` cannot `sudo` at the destination, and a broad recursive
grant must be followed by re-tightening `secrets/` and any `auth.json`.

Treat recursive `chmod`/`chown` over a config tree as destructive: state what it
will touch first. Full decision path, the three ACL fallbacks, EACCES-on-file vs
EACCES-on-directory triage, and the live-edit vs go-through-git split:
`references/nas-bind-mount-permissions.md`.

## Bind Mounts in Portainer Git Stacks

**Relative bind mounts don't work** in Portainer stacks deployed from git:
```yaml
- ./media/music-server/syncer:/repo:ro  # ❌ Creates empty /repo
```

Portainer doesn't resolve `./` against the repo. Use `build:` instead:
```yaml
build:
  context: ./media/music-server/syncer
  dockerfile: Dockerfile
```

Services with `build:` work because the context resolves against the cloned repo.

## File vs Directory Mount Conflicts

**Mounting a file over an existing directory** fails with "read-only file system" or "is a directory":
```yaml
# ❌ Frigate creates /config/config.yml as directory; mounting file fails
- ./config/config.yml:/config/config.yml:ro

# ✅ Mount folder to subfolder
- ./config:/config/frigate:ro
# Or just don't mount — use container's default config
```

**Mosquitto config mount** also fails if config directory already exists:
```yaml
# ❌ Directory exists; can't create mosquitto.conf as file
- /volume1/Docker/mqtt/config:/mosquitto/config
# ✅ Don't mount config; use default settings
```

## ARM64 Image Compatibility

Verify ALL images support `linux/arm64` before adding to stack:

| Image | ARM64 Support | Notes |
|-------|---------------|-------|
| ollama/ollama | ✅ | |
| jellyfin/jellyfin | ✅ | |
| ghcr.io/blakeblackshear/frigate | ✅ | |
| eclipse-mosquitto | ✅ | |
| cloudflare/cloudflared | ✅ | |
| tailscale/tailscale | ✅ | |
| deluan/navidrome | ✅ | |

**Symptom of missing ARM64:** `exec format error` or container exits immediately.

## Port Conflicts on NAS

Ports may be occupied by NAS services (Synology apps, etc.) or previous stacks. Check before assigning:
```bash
# Check if port is in use
sudo netstat -tlnp | grep :8796
```

**Solution:** Change host port mapping:
```yaml
ports:
  - "8797:8796"  # Host:Container
```

## Build vs Image in Portainer

- **`image:`** — Pulls pre-built image. Fast deploy.
- **`build:`** — Builds from Dockerfile. Requires rebuild on code changes.

**After modifying a Dockerfile:** Portainer → Stack → Pull and redeploy (full rebuild).

**After modifying only code (no Dockerfile changes):** Just redeploy — the build cache is used.

## Portainer Build Context and Web Editor Limitations

**Portainer's Web Editor and Upload methods do not provide a full build context.** When you paste a `docker-compose.yml` that uses `build: .`, Portainer only has access to the compose file itself — not the surrounding repository files like `package.json`, `pnpm-lock.yaml`, or source code. The build fails with errors like:

```
ERR_PNPM_NO_PKG_MANIFEST No package.json found in /app
```

or generic "file not found" during `COPY`.

**This affects both Web Editor (paste) and Upload (single file).** Only the **Repository** method (cloning a git repo) or a pre-existing context on the NAS provides the full file tree.

### Workarounds

1. **Use a pre-built image** (recommended for Portainer): build the image elsewhere (local machine, CI) and push to a registry, or load it into the NAS via `docker save`/`docker load`. Then use `image:` in the compose.

2. **Use the Repository method**: point Portainer to a git URL and specify the compose path. Portainer clones the repo, so `build: .` works.

3. **Build on the NAS manually**: clone the repo on the NAS, then use `docker compose build` from the host, and deploy with `image:` pointing to the local image.

### Local image transfer via docker save/load (no registry)

When you don't have a registry, you can transfer a built image from your development machine to the NAS:

```bash
# On dev machine
docker build -t playscore:latest .
docker save playscore:latest | gzip > /tmp/playscore.tar.gz
scp /tmp/playscore.tar.gz user@nas:/tmp/

# On NAS
docker load -i /tmp/playscore.tar.gz
```

Then set `image: playscore:latest` in the compose. No `build:` needed.

**Note:** The image must match the NAS architecture (e.g., `linux/arm64`). Build with `--platform linux/arm64` if your dev machine is x86.

### Symptom checklist

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ERR_PNPM_NO_PKG_MANIFEST` or `COPY failed: file not found` during `docker compose build` in Portainer | Web Editor/Upload lacks build context | Use pre-built image or Repository method |
| `exec format error` | Image built for wrong architecture (e.g., amd64 on arm64) | Rebuild with `--platform linux/arm64` |
| `pull access denied` | Image doesn't exist in registry or requires login | Use local image or push to registry first |

## References

- `references/verifying-before-reporting.md` — local verification ladder: static parse, mock upstream, end-to-end HTTP, browser render; caught 5 real bugs
- `references/docker-log-demux.md` — full demultiplexing implementation
- `references/portainer-js-workaround.md` — detailed Portainer injection analysis
- `references/frigate-tuya-integration.md` — Frigate 0.14+ schema, cloud-only Tuya cameras, go2rtc restream, Scrypted as RTSP bridge, Double-Take facial recognition, dual-stream, zones, HA/MQTT automations, common error triage
- `references/llm-inference-sizing.md` — local vs remote LLM on CPU-only hardware, OpenAI-compatible client, `LLM_*` env contract
- `references/containerising-hermes-agent.md` — running the agent as a stack service: OAuth vs API-key auth, mounting `auth.json`, entrypoint auth reporting, pairing inside the container, testing entrypoints with `PATH` stubs
- `references/service-dashboard-patterns.md` — the stack's own monitoring panel: catalog-driven endpoint cards, verb-aware endpoint tester, method/body-forwarding proxy, editable per-service base URLs, isolating a click that doesn't land
- `references/container-resource-stats.md` — per-container CPU/RAM/IO from the Docker socket: deriving CPU % from deltas, subtracting page cache, parallel sampling, validating against `docker stats`
- `references/agent-vs-api-service-boundaries.md` — answering "aren't these services redundant?": honest verdict tables, why an agent and an API wrapper both earn their place, agent memory has no clock
- `references/http-bridge-for-agents.md` — the HTTP bridge pattern: thin pipe that invokes the agent binary per request, builds domain prompts, handles auth/CORS/latency, scheduler-calls-agent pattern
- `references/consuming-agent-from-frontend.md` — React/Vue calling the bridge: latency handling, 503 retry, domain endpoints (strategy, customer-insight), CORS, required fields
- `references/scheduled-jobs-in-services.md` — the dead-scheduler trap: proving a timer actually runs, status endpoints that expose `next_run`, rescheduling recurring work instead of closing it, retry-on-failed-send, one scheduler per deployment under gunicorn, duplicate-route boot failures
- `references/nas-bind-mount-permissions.md` — granting a human write access to bind-mounted config: why `chmod 600` on a directory breaks the stack, probing for `synoacltool` vs `setfacl`, non-retroactive ACL inheritance, EACCES triage, staging `scp` through `/tmp`
