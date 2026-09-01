---
name: nas-android-deploy
description: Build, deploy Android apps to Firebase and push to NAS.
trigger: "Use when building Android APKs, deploying to Firebase Hosting with NAS gateway push, managing Synology NAS Docker stacks (ARM64), or configuring nas-app-gateway / nas-infrastructure repos."
---

# NAS Android Deploy

Build and deploy Android apps with Synology NAS backend integration.

## Architecture

- **Frontend** (MiNegocio): React + Vite + TypeScript + Capacitor
- **Build script**: `scripts/publish_android_zip.py` — auto-detects package manager (pnpm/bun/yarn, NO npm), builds web, syncs Capacitor, compiles APK
- **NAS Gateway** (`nas-app-gateway`): Express + Firebase Admin, port 8790, token auth via `x-gateway-token` header
- **NAS Infrastructure** (`nas-infrastructure`): Unified Docker Compose with all services

## ARM64/Synology Compatibility (CRITICAL)

Synology NAS uses ARM64. All Docker images MUST support it:

```dockerfile
# CORRECT — multiarch supported
FROM node:20-alpine3.20

# WRONG — no ARM64 manifest
FROM node:20-bookworm-slim
FROM node:20-alpine  # unpinned, may lack ARM64
```

For services using prebuilt images, add to docker-compose.yml:
```yaml
services:
  my-service:
    image: some/image:tag
    platform: linux/arm64
```

Alpine-based images (`node:20-alpine3.20`, `python:3.11-alpine`) support ARM64 natively. Debian slim images usually work but verify with `docker manifest inspect`.

## Android Build Environment

```bash
# JAVA_HOME (JDK 17 required for Gradle 8.x)
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$JAVA_HOME/bin:$PATH

# ANDROID_HOME
export ANDROID_HOME=~/Android/Sdk
export PATH=$ANDROID_HOME/platform-tools:$PATH

# Quick fix without env vars:
echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties
```

## Publish Script Usage

```bash
# Full build (web + Android + Firebase deploy + NAS push)
python3 scripts/publish_android_zip.py

# Skip compilation, deploy existing APK + push NAS
python3 scripts/publish_android_zip.py --push-only

# Release build
python3 scripts/publish_android_zip.py --release
```

The script auto-loads `.env` from project root or `~/.env`. Required vars:
```
NAS_GATEWAY_URL=http://192.168.0.129:8790
NAS_GATEWAY_TOKEN=<token>
```

## NAS Gateway Endpoints

- `GET /health` — no auth, returns `{"ok":true}`
- `GET /apps` — requires token, lists configured apps
- `POST /jobs/notifications/run` — requires token, runs pending notifications
- `POST /jobs/app-release/notify` — requires token, sends app release push

Gateway auth: `assertGatewayToken` compares `x-gateway-token` header against `NAS_GATEWAY_TOKEN` env var. Token mismatch returns `401 Unauthorized`.

## NAS Gateway Config Format

`/app/config/apps/<appId>.json`:
```json
{
  "appId": "minegocio-mk",
  "firebaseProjectId": "minegocio-mk",
  "serviceAccountPath": "/app/config/service-accounts/<appId>.json",
  "modules": {
    "notifications": {
      "enabled": true,
      "sourceCollection": "notifications",
      "tokenCollection": "push_tokens",
      "queryLimit": 50
    },
    "appReleaseNotifications": {
      "enabled": true,
      "tokenCollection": "push_tokens",
      "route": "/settings"
    }
  }
}
```

## Package Manager Rules

- **MiNegocio**: pnpm ONLY (no npm, no yarn, no bun)
- **NAS services**: npm (Node.js)
- **Publish script**: auto-detects from lockfiles (pnpm-lock.yaml > bun.lockb > yarn.lock)
- `publish_android_zip.py`: npm REMOVED from supported choices per user rule

## macOS Build Compatibility

On Macs with Node.js < 22.5 (e.g. v20.19.0 from Homebrew), pnpm 11+ fails with `ERR_UNKNOWN_BUILTIN_MODULE: No such built-in module: node:sqlite` because pnpm 11.18+ requires Node 22.5+.

`publish_android_zip.py` auto-detects this: if pnpm fails to run, it falls back to bun with warning `⚠️ pnpm detectado pero no ejecutable (Node.js incompatible). Using bun.`

```bash
# On Mac with bun installed at ~/.bun/bin — works automatically:
python3 scripts/publish_android_zip.py

# Or force bun explicitly:
python3 scripts/publish_android_zip.py --package-manager bun
```

**Fix options:**
1. Install bun (if not present): `curl -fsSL https://bun.sh/install | bash`
2. Upgrade Node.js to v22.5+ via nvm: `nvm install 22 && nvm use 22`
3. Use the `--package-manager bun` flag

With nvm, the script picks the highest Node version automatically from `~/.nvm/versions/node`.

## Firestore Schema Migrations

When splitting/renaming fields (e.g., `statuses` → `prospectStatuses` + `inicioStatuses`), add backward compatibility:

```typescript
const normalized = initial ? {
  ...initial,
  prospectStatuses: initial.prospectStatuses ?? (initial as any).statuses ?? [],
  inicioStatuses: initial.inicioStatuses ?? [],
} : DEFAULT_SETTINGS;
```

Also defend against undefined arrays in UI:
```tsx
const safeStatuses = statuses ?? [];
{safeStatuses.map(s => <Row key={s.id} />)}
```

## Synology NAS Git SSH

Git may not be in PATH on Synology SSH sessions:
```bash
# Find git binary
find /usr -name git -type f 2>/dev/null

# Add to PATH
export PATH=$PATH:/usr/bin:/usr/local/bin

# Make permanent
echo 'export PATH=$PATH:/usr/bin:/usr/local/bin' >> ~/.bashrc
```

Install via Package Center → search "Git" → Install, or `sudo synopkg install Git`.

## Portainer Stack from Git

When Portainer clones a repo for a stack:
- Repo must be public OR include credentials in URL (`https://token@github.com/...`)
- No carriage returns in filenames (`find . -name "*\r*"` to detect)
- All images must support the NAS architecture (ARM64 for Synology)

After updating the repo: Portainer → Stacks → Pull latest → Rebuild.

## Common Pitfalls

1. **Portainer clone fails with "invalid path contains control character"** — usually a file with `\r` in name. Check with `find . -name "*\r*"` and `git rm` the offending file.

2. **`npm ci` fails in Docker build** — requires `package-lock.json`. Use `npm install --omit=dev` if lockfile doesn't exist.

3. **GitHub Actions `hashFiles` in job-level `if:`** — not allowed. Only valid in step-level `if:` conditions.

4. **`node:20-alpine` unpinned** — may lack ARM64 manifest. Always pin: `node:20-alpine3.20`.

5. **Token works for `/health` but not `/jobs/*`** — `/health` doesn't authenticate. Token mismatch returns 401, not 403.

6. **HMR cache serves stale code** — after significant refactors, run `rm -rf node_modules/.vite` and restart dev server.

7. **`.env` not loaded by Python script** — `publish_android_zip.py` auto-loads from project root or `~/.env`. Both formats work:
   ```
   NAS_GATEWAY_URL=http://192.168.0.129:8790
   NAS_GATEWAY_TOKEN=<token>
   ```

8. **Docker Compose `platform:` placement** — must be at service level, directly under the service name, not nested under `build:` or `image:`.
