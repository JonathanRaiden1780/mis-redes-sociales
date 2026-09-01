# Live-reload dev stack: seeing app changes online without rebuilding

When the user asks to "see the app online and have changes show up easily", the
answer is a **dev-server stack**, not a production build. The repo is mounted as a
volume and the framework's dev server runs inside the container, so saving a file
reloads the browser. No image rebuild per change.

This is explicitly a *preview-while-developing* surface, not production. Say so —
a dev server has no asset optimisation and no process supervision.

## Self-contained per-project stack (user's request pattern)

When the user asks "each project its own yaml I can upload manually to Portainer",
give each repo its **own `docker-compose.yml`** inside the project root. One stack
per project, deployable independently, no shared services.

**Stack skeleton per repo:**

```
<project>/
├── docker-compose.yml      # listo para subir a Portainer
├── docker-compose.localtest.yml  # variante x86 para probar sin NAS
├── Dockerfile.dev
├── docker/
│   └── entrypoint.sh
├── .dockerignore
└── .env.example
```

The compose uses **relative bind mount** (`.:/app`) so Portainer resolves the path
against the cloned repo. Keep `platform: linux/arm64` in the NAS version, remove it
from the localtest variant for x86 machines. Use `environment` for secrets, never
hardcode.

See the "Portainer bind mounts" note below — relative mounts work here because the
`build:` directive resolves the context against the cloned repo.

---

## Verifying native modules actually compile

**This is the failure that cost the most time and appeared twice.**

After `pnpm install`, the `node_modules` directory has the JS sources for
`better-sqlite3` but no `build/Release/better_sqlite3.node`. The entrypoint must:

1. Detect if the build is missing (`node -e 'require("better-sqlite3")'` fails)
2. Run `npm rebuild better-sqlite3 --build-from-source`
3. Verify it loaded before continuing
4. Latch with a marker file so restarts skip the slow compile

```bash
if [ ! -f node_modules/.native-built ]; then
  echo "compiling better-sqlite3 from source..."
  npm rebuild better-sqlite3 --build-from-source 2>&1 | tail -3
  if node -e 'require("better-sqlite3")' 2>/dev/null; then
    echo "better-sqlite3 OK"; touch node_modules/.native-built
  else
    echo "ERROR: native build failed, backend will not start"
  fi
fi
```

**Never swallow build failures with `|| true`.** That's what hid the failure
through a full deploy cycle and made the frontend look "merely broken" while the
backend was dead. Reading the container logs for the specific error is what
diagnoses it: `docker compose logs <svc> | grep -A6 -iE "error|cannot|bindings"`.

**Testing with a warm modules volume hides every first-boot failure.** Delete the
volume between runs to re-test the install-and-compile branch.

---

## Healthcheck must probe BOTH processes

One container runs two processes (API + dev server). Checking only the web port
marks the container `healthy` with a crashed API. Check the app's real routes
before writing the healthcheck (`grep "app.use('/api" src/server/index.js`) rather
than assuming `/api/health` exists. If the app has no `/api/health`, assert the
port answers *at all* — a 404 proves the server is up.

```yaml
healthcheck:
  test: ["CMD-SHELL", "curl -fsS http://localhost:5173/ && curl -fsS http://localhost:3001/api/health"]
  start_period: 240s   # first boot installs deps AND compiles native modules
```

---

## Git-sync sidecar (push-to-deploy)

So `git push` propagates without SSH-ing into the NAS:

```yaml
apps-git-sync:
  image: alpine/git:latest
  platform: linux/arm64
  volumes:
    - ${PLAYSCORE_SRC}:/repos/playscore
    - ${FAMILIAAPP_SRC}:/repos/familiaapp
  entrypoint: ["/bin/sh","-c", "git config --global --add safe.directory '*'; while true; do for pair in \"playscore:${PLAYSCORE_BRANCH}\" \"familiaapp:${FAMILIAAPP_BRANCH}\"; do name=${pair%%:*}; branch=${pair##*:}; dir=/repos/${name}; if [ -d \"${dir}/.git\" ]; then git -C \"${dir}\" fetch --quiet origin \"${branch}\" || true; git -C \"${dir}\" reset --hard --quiet \"origin/${branch}\" || true; fi; done; sleep \"${SYNC_INTERVAL}\"; done"]
```

**State the tradeoff explicitly:** `reset --hard` discards NAS-side edits. That
makes the repo the single source of truth — usually right, but it must be the
user's stated choice, not a surprise. Offer the alternative (stop the sidecar and
edit over SMB).

---

## Port allocation on a populated NAS

Read the ports already taken from the main compose rather than guessing:

```bash
grep -oE '"[0-9]{2,5}:[0-9]{2,5}"' docker-compose.yml | tr -d '"' | sort -t: -k1 -n | uniq
```

Both apps default to 3001/5173, so they collide by default — each needs a distinct
host mapping while keeping container ports identical. Free ports on this NAS:
**8795** (PlayScore) and **8799** (FamiliaApp).

---

## Portainer bind mounts (the gotcha)

**Relative bind mounts DON'T work** in Portainer stacks deployed from git. But
**`build:` context resolves correctly** against the cloned repo. Use this:

```yaml
services:
  app:
    build:
      context: .          # resolves to the cloned repo
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app            # also works because context set the repo path
```

If you get "mount path not absolute", the stack wasn't deployed from the git
context. Deploy via Portainer's *Repository* option or use absolute NAS paths.

---

## The four constraints that decide whether it works

### 1. `node_modules` must be a named volume, never bind-mounted

Host modules are compiled for the host architecture and break inside ARM64. A
named volume mounted *over* the source path shadows the host copy:

```yaml
volumes:
  - ${APP_SRC}:/app              # source, live
  - app-modules:/app/node_modules # shadows host's node_modules
  - app-data:/data               # DB outside the code tree
  - pnpm-store:/pnpm             # shared cache across apps
```

### 2. File watching needs polling

Volumes backed by NAS/network storage emit no inotify events, so the dev server
never notices edits. Two settings, both required:

```yaml
environment:
  CHOKIDAR_USEPOLLING: "true"
```
```js
server: { watch: { usePolling: process.env.CHOKIDAR_USEPOLLING === 'true', interval: 400 } }
```

### 3. Databases live outside the source tree

If a git-sync sidecar runs `reset --hard`, anything inside the repo is destroyed.
Point the app at `/data` via `DATABASE_PATH` and mount a separate volume there.

### 4. Don't reinstall on every boot

Hash the lockfile and only install when it changes, or every restart costs
minutes. Latch with `node_modules/.lock-hash`.

---

## `pnpm rebuild` does not compile native modules

The bug that broke this stack on first boot.

`better-sqlite3` ships a prebuilt `.node` for the host arch. Inside the container:

```
Error: Could not locate the bindings file. Tried:
 → /app/node_modules/.pnpm/better-sqlite3@11.10.0/.../build/Release/better_sqlite3.node
```

`pnpm rebuild <pkg>` **exits 0 without compiling** — pnpm blocks dependency build
scripts by default, so `build/Release/` is never created. `npm rebuild` does:

```bash
npm rebuild better-sqlite3 --build-from-source
```

The image needs a toolchain: `apk add --no-cache python3 make g++`.

---

## Shared entrypoint for both apps

One image serves every app; `APP_NAME`/`WEB_PORT`/`API_PORT` differentiate them.
Detect the backend entry rather than hardcoding it — projects disagree
(`server.cjs` vs `src/server/index.js`):

```bash
for candidate in server.cjs src/server/index.js server.js; do
  [ -f "$candidate" ] && SERVER_ENTRY="$candidate" && break
done
PORT="$API_PORT" node --watch "$SERVER_ENTRY" &
pnpm exec vite --host 0.0.0.0 --port "$WEB_PORT" &
trap 'kill $! 2>/dev/null; exit 0' SIGTERM SIGINT
wait -n     # if either dies, exit so Docker restarts the container
```

---

## Dev servers reject unknown hostnames

Vite answers `Blocked request. This host is not allowed` for any Host header it
wasn't told about, so a working container errors through a tunnel. Drive it from
env:

```js
const allowed = (process.env.VITE_ALLOWED_HOSTS || '')
  .split(',').map(h => h.trim()).filter(Boolean)

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: Number(process.env.WEB_PORT) || 5173,
    allowedHosts: allowed.length ? allowed : true,
    proxy: { '/api': { target: `http://localhost:${process.env.API_PORT || 3001}` } },
    hmr: { clientPort: process.env.VITE_HMR_PORT ? Number(process.env.VITE_HMR_PORT) : undefined },
  },
})
```

Behind an HTTPS tunnel the HMR websocket must go over 443: set
`VITE_HMR_PORT=443`.

---

## Compose anchor for DRY stacks

Use a compose anchor for everything the apps share, so per-app blocks stay short
and can't drift apart:

```yaml
x-dev-app: &dev-app
  build: { context: ., dockerfile: Dockerfile.dev }
  platform: linux/arm64
  networks: [nas-net]
  restart: unless-stopped
  stop_grace_period: 10s
  logging:
    driver: json-file
    options: { max-size: "10m", max-file: "3" }

services:
  playscore:
    <<: *dev-app
    container_name: playscore
    ports: ["8795:5173", "8895:3001"]
    environment: { JWT_SECRET: "${PLAYSCORE_JWT_SECRET:-default-dev-secret}" }
```

---

## Exposing through an existing Cloudflare Tunnel

`cloudflared` already on `nas-net` resolves the new containers by service name.
Add public hostnames pointing at the container port:

| Hostname | Service |
|---|---|
| `playscore.example.com` | `http://playscore:5173` |
| `familia.example.com` | `http://familiaapp:5173` |

Then put those domains in `VITE_ALLOWED_HOSTS`, or Vite blocks them.

Tailscale is the zero-config fallback: `http://<nas-hostname>:8795`.

---

## Prove it locally before handing over

Keep a second compose file without `platform: linux/arm64` and without the
external network, and actually run it:

```bash
docker compose -f docker-compose.localtest.yml config --quiet   # schema valid
docker compose -f docker-compose.localtest.yml up -d --build
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:18795/
curl -s http://localhost:18895/api/health
docker ps --format "{{.Names}} {{.Status}}"                     # (healthy)?

# hot-reload proof
cp src/client/pages/LoginPage.jsx /tmp/bak
sed -i 's/Bienvenido/HOT RELOAD OK/' src/client/pages/LoginPage.jsx
sleep 10
curl -s http://localhost:18795/src/client/pages/LoginPage.jsx | grep -c "HOT RELOAD OK"
docker compose logs --tail 5 <svc> | grep hmr
cp /tmp/bak src/client/pages/LoginPage.jsx
```

Tear down with `down -v` afterwards.

---

## Slop checklist

- [ ] Each project has its OWN `docker-compose.yml` (self-contained)?
- [ ] `.dockerignore` excludes node_modules, .git, .env?
- [ ] `.env.example` documents every required variable?
- [ ] `pnpm rebuild` replaced with `npm rebuild --build-from-source` for native modules?
- [ ] Build failure NOT swallowed by `|| true`?
- [ ] Healthcheck probes BOTH frontend AND backend?
- [ ] Healthcheck uses a route that EXISTS (`grep app.use`)?
- [ ] `node_modules` is a NAMED volume, not bind-mounted?
- [ ] Polling enabled (`CHOKIDAR_USEPOLLING=true`) for NAS volumes?
- [ ] `VITE_ALLOWED_HOSTS` set for tunnel access?
- [ ] Database path OUTSIDE the repo (`/data`)?
- [ ] Tested with `down -v` (fresh modules volume)?
- [ ] Free port chosen (8795/8799 on this NAS)?
- [ ] Log size capped (`max-size: "10m"`) for chatty dev servers?
