---
name: portainer-stack-deployment
description: Deploy Docker Compose stacks to Portainer on Synology NAS.
---

# Portainer Stack Deployment (Synology NAS)

Patterns for deploying Docker Compose stacks to Portainer on a Synology NAS
(arm64/Nessi-class), covering the failure modes that arise from Portainer's
Web Editor limitations and multi-arch container builds.

## Trigger

Use when the task involves:
- Creating or fixing a `docker-compose.yml` for Portainer deploy on a NAS
- Debugging `exec: "...": is a directory: permission denied` in a container
- `ERR_PNPM_NO_PKG_MANIFEST` during a Portainer build
- `pull access denied` for a registry image that shouldn't exist yet
- `sh: pnpm: not found` in a `node:22-alpine` container
- SCP/SSH to the NAS failing with `Permission denied (publickey,password)`
- Choosing between `build:` vs `image:` in a Portainer stack

---

## Pattern 1 — Portainer Web Editor doesn't upload auxiliary files

### Symptom

```
exec: "/usr/local/bin/entrypoint.sh": is a directory: permission denied
```

or

```
Failed to deploy a stack: compose up operation failed:
  Error response from daemon: ... Bind for 0.0.0.0:PORT failed: port is already allocated
```

or (during build)

```
ERR_PNPM_NO_PKG_MANIFEST  No package.json found in /app
```

### Root cause

Portainer **Web Editor** only stores what you paste — the `docker-compose.yml`.
It does NOT upload auxiliary files like `./docker/entrypoint.sh`,
`./Dockerfile`, `package.json`, `pnpm-lock.yaml`, or the rest of the repo
source tree.

When the compose references a volume mount for a file that doesn't exist on the
host, Docker **creates a directory** in its place:

```yaml
volumes:
  - ./docker/entrypoint.sh:/usr/local/bin/entrypoint.sh:ro
```

→ Docker creates `/usr/local/bin/entrypoint.sh/` as an empty directory →
runtime tries to `exec` a directory → `is a directory: permission denied`.

When the compose uses `build: .` and the build context is just the directory
where Portainer stored the compose file (no `package.json`, no source tree),
the `COPY package.json ...` or `RUN pnpm install` steps fail because the
context is empty.

### Fix A — inline command, no external entrypoint file

Remove the volume mount for the entrypoint and put the whole startup script
inline in the compose:

```yaml
services:
  app:
    image: node:22-alpine
    command: >
      sh -c "
        set -e;
        cd /app;
        # ... install pnpm, deps, compile natives, start backend+frontend ...
      "
    # NO volumes entry for ./docker/entrypoint.sh
    # NO entrypoint: mount
```

**Pitfall — multiline `sh -c` with nested if/fi can corrupt**

A script with deep nesting (`if ! cmd; then ... fi`) inside a YAML `command: >`
block can arrive truncated in the container, producing:

```
sh: line 11: syntax error: unexpected end of file (expecting "fi")
```

**Mitigation**: keep the inline script simple and flat. If you need complex
logic, use a Dockerfile `CMD` instead, or split into a helper script baked
into the image via `COPY` in the Dockerfile.

### Fix B — use `image:` with a pre-built image, not `build: .`

For Portainer Web Editor + Upload, the reliable path is:

1. **Build the image locally** (on the dev machine, with full source tree):

   ```bash
   cd proyectos/playscore          # or familiaapp
   docker build -t playscore:latest .
   ```

2. **Export to tarball**:

   ```bash
   docker save playscore:latest | gzip > /tmp/playscore.tar.gz
   ```

3. **Transfer to NAS** (see Pattern 4 for SCP alternatives):

   ```bash
   scp /tmp/playscore.tar.gz JonathanRaiden@192.168.0.129:/tmp/
   ```

4. **Load on NAS**:

   ```bash
   ssh JonathanRaiden@192.168.0.129 "docker load -i /tmp/playscore.tar.gz"
   ```

5. **Compose uses `image:`**, not `build:`:

   ```yaml
   services:
     app:
       image: playscore:latest     # or familiaapp:latest
       # NO build: .
   ```

**Why this beats `build:.` in Portainer**: the compose file alone, pasted in
Web Editor, is enough — the image already carries the source tree, deps, and
binary compiles inside it.

---

## Pattern 2 — SSH/SCP to NAS failing

### Symptom

```
JonathanRaiden@192.168.0.129's password:
scp: dest open "/tmp/": Permission denied
scp: failed to upload file /tmp/familiaapp.tar.gz to /tmp/

# or

ssh JonathanRaiden@192.168.0.129 echo OK
Permission denied, please try again.
Permission denied (publickey,password).
```

Verbose SSH shows:

```
debug1: Offering public key: /home/user/.ssh/id_ed25519 ...
debug1: Authentications that can continue: publickey,password
debug1: Next authentication method: password
debug1: read_passphrase: can't open /dev/tty: No such device or address
Permission denied (publickey,password).
```

### Root cause

The local SSH key (`id_ed25519`, `id_rsa`, etc.) is **not in the NAS user's
`authorized_keys`**. SSH falls back to password authentication, but:

- The `scp` destination was given as a **directory path** (`/tmp/`) not a full
  file path (`/tmp/playscore.tar.gz`) → SCP tries to open the directory as a
  file → `Permission denied`.
- In a non-interactive context (no TTY), password fallback fails because
  there's no way to prompt for the password.

### Fix A — correct the SCP destination

SCP requires a **full destination file path**, not just a directory:

```bash
# WRONG — directory as destination
scp file.tar.gz user@host:/tmp/

# RIGHT — full file path
scp file.tar.gz user@host:/tmp/file.tar.gz
```

### Fix B — get the SSH key onto the NAS

On the NAS (via DSM SSH console, or any machine that has SSH access to the
NAS), add the public key to the user's `authorized_keys`:

```bash
# 1. Get the local public key content
cat ~/.ssh/id_ed25519.pub
# → ssh-ed25519 AAAA... jonathanh@host

# 2. On the NAS (via any working SSH session, or DSM > Terminal):
mkdir -p /home/JonathanRaiden/.ssh
echo "ssh-ed25519 AAAA..." >> /home/JonathanRaiden/.ssh/authorized_keys
chmod 600 /home/JonathanRaiden/.ssh/authorized_keys
chown -R JonathanRaiden:JonathanRaiden /home/JonathanRaiden/.ssh
```

Or via DSM web UI: **Control Panel > Security > Terminal & SNMP > SSH** —
enable SSH and manage keys.

### Fix C — when SSH is not available, use alternative transfer

If SSH isn't working and you can't fix it right now, transfer the `.tar.gz`
via one of these:

| Method | How |
|---|---|
| **USB physical** | Copy `.tar.gz` to a USB stick → plug into NAS → `docker load` |
| **Synology File Station** | Open http://192.168.0.129:5000 → File Station → navigate to `/tmp/` → upload files from your machine |
| **SMB mount** | Mount the NAS share locally (e.g. `/run/user/1000/gvfs/smb-share...`) → `cp` the files there |
| **Synology Drive** | If synced, copy to the synced folder on your machine → appears on NAS |

After transfer, on the NAS:

```bash
docker load -i /tmp/playscore.tar.gz
docker load -i /tmp/familiaapp.tar.gz
docker images | grep -E "playscore|familiaapp"   # verify
```

---

## Pattern 3 — pnpm in `node:22-alpine` containers

### Symptom

```
sh: pnpm: not found
```

or during build:

```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: better-sqlite3@11.10.0
The command '/bin/sh -c pnpm install --no-frozen-lockfile' returned a non-zero code: 1
```

### Root cause

`node:22-alpine` does **not** include `pnpm` by default. The `corepack` tool
is present (ships with Node 22) but `pnpm` must be explicitly prepared.

Additionally, `pnpm` in versions 9+ treats native build scripts
(`better-sqlite3`, `esbuild`, etc.) as **ignored by default** for security.
The install fails with `[ERR_PNPM_IGNORED_BUILDS]`.

### Fix — Dockerfile pattern for pnpm + approve builds

```dockerfile
FROM node:22-alpine

# Install build tools (for native modules like better-sqlite3)
RUN apk add --no-cache git python3 make g++

# Enable corepack and prepare pnpm at the version declared in package.json
RUN corepack enable \
    && corepack prepare pnpm@11.22.0 --activate \
    && echo "pnpm: $(pnpm --version 2>/dev/null || echo 'NO DISPONIBLE')"

WORKDIR /app

# Install deps — approve-builds is a SEPARATE command, not a flag of pnpm install
COPY package.json pnpm-lock.yaml ./
RUN set -e; \
    (pnpm install --no-frozen-lockfile --reporter=silent || \
     (echo "detected ignored builds, approving..." && \
      pnpm approve-builds --all && \
      echo "reinstalling after approval..." && \
      pnpm install --no-frozen-lockfile --reporter=silent))

# If the project uses better-sqlite3, compile it for the container's arch
COPY . .
RUN if [ -f package.json ] && grep -q '"better-sqlite3"' package.json 2>/dev/null; then \
      echo 'compiling better-sqlite3...' && \
      pnpm rebuild better-sqlite3 --build-from-source 2>&1 | tail -3 && \
      node -e 'require("better-sqlite3")' 2>/dev/null && echo 'better-sqlite3 OK' || \
      echo 'WARNING: better-sqlite3 did not compile'; \
    fi
```

**Key points:**
- `corepack prepare pnpm@VERSION --activate` installs pnpm at the exact version
  declared in `package.json` → aligns with `"packageManager": "pnpm@11.22.0"`.
- `pnpm approve-builds --all` is a **separate command**, NOT a flag of
  `pnpm install`. Using `--approve-builds` as an `install` flag produces:
  ```
  [ERROR] Unknown option: 'approve-builds'
  ```
- The fallback pattern (try install → if ignored builds → approve → retry) is
  robust because it handles the first-run case where the lockfile may list
  packages with build scripts that pnpm blocks by default.

---

## Pattern 4 — port conflicts on the NAS

### Symptom

```
Bind for 0.0.0.0:8795 failed: port is already allocated
```

### Diagnosis on the NAS

```bash
# Find what's using the port
ss -tlnp | grep -E ':(8795|8895|8799|8899)\b'
```

### Fix

- Kill the conflicting process, or
- Change ports in the compose (use the 7000 range: 7795/7895, 7799/7899)

---

## Pattern 5 — compose validation before deploy

Always validate YAML before pasting into Portainer:

```bash
docker compose -f docker-compose.yml config --quiet
# (ignore the "version is obsolete" warning — Docker accepts it)
```

---

## Session reference — error transcripts

See `references/` for:
- `portainer-web-editor-build-failure.md` — full transcript of `ERR_PNPM_NO_PKG_MANIFEST`
- `entrypoint-directory-error.md` — full transcript of `is a directory: permission denied`
- `scp-permission-denied.md` — full transcript of SCP + SSH failure on NAS

---

## Verification checklist

Before deploying to Portainer, confirm:

- [ ] `docker compose config --quiet` passes (warn about version ignored, OK)
- [ ] `image:` points to an image that exists on the NAS (via `docker images`)
- [ ] No `build:` if using Web Editor / Upload (unless repo is cloned on NAS)
- [ ] No volume mount for a file that Portainer won't upload
- [ ] `command:` inline script is flat (no deep if/fi nesting) or baked into Dockerfile CMD
- [ ] pnpm version in Dockerfile matches `package.json`'s `"packageManager"`
- [ ] `pnpm approve-builds --all` is a separate step if build scripts exist
- [ ] `.dockerignore` excludes `node_modules`, `.git`, `docker-compose*.yml`, `Dockerfile*`, `.env*`
- [ ] Healthcheck uses `wget` (Alpine has it; `curl` may not be present)
- [ ] Ports don't conflict with other services on the NAS (`ss -tlnp`)
- [ ] SSH key is in `authorized_keys` on the NAS OR alternative transfer method ready

