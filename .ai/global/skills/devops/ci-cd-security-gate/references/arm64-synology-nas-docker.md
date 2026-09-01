# ARM64 Docker Compatibility on Synology NAS

## Context

Synology NAS devices use ARM64 processors. Docker images built for `linux/amd64` (x86_64) won't run. The error is:

```
no matching manifest for linux/arm64/v8 in the manifest list entries
```

## Pitfalls

### `platform: linux/arm64` Doesn't Create ARM64 Images

Adding `platform: linux/arm64` to docker-compose.yml only works if the **upstream image already has an ARM64 build**. Many images (e.g., `mikenye/picard:latest`) are amd64-only.

**Diagnosis:**
```bash
# Test each image individually (use sudo on Synology — no docker group)
for img in image1 image2 image3; do
  echo "=== $img ==="
  sudo docker pull --platform linux/arm64 "$img" 2>&1 | tail -2
done
```

**Note:** On Synology, `docker` commands often require `sudo` or group membership. If you get "permission denied while trying to connect to the docker API", prepend `sudo`.

### Identifying Which Image Fails

`docker compose pull` output truncates container names, making it hard to identify failures:
```
[+] pull 8/12
 ✔ nas-bac... Skipped    0.0s
 ⠇ Image m... Pulling    0.9s   ← which service?
 ⠇ Image p... Pulling    0.9s
no matching manifest for linux/arm64 in the manifest list entries
```

Use individual `docker pull` per image to isolate the culprit.

### Images Confirmed ARM64-Safe (as of 2026-08)

| Image | Status |
|-------|--------|
| `cloudflare/cloudflared:latest` | ✅ ARM64 |
| `tailscale/tailscale:stable` | ✅ ARM64 |
| `ghcr.io/home-assistant/home-assistant:stable` | ✅ ARM64 |
| `deluan/navidrome:latest` | ✅ ARM64 |
| `tangyoha/telegram_media_downloader:latest` | ✅ ARM64 |
| `node:20-alpine3.20` | ✅ ARM64 (multiarch) |
| `python:3.11-slim` | ✅ ARM64 (multiarch) |
| `mikenye/picard:latest` | ❌ amd64 ONLY — remove from compose |

### Node.js Images: Pin to `alpine3.20`

`node:20-alpine` (untagged) doesn't guarantee multiarch. Use:

```dockerfile
FROM node:20-alpine3.20  # ✅ Multiarch (ARM64 + amd64)
```

NOT:
```dockerfile
FROM node:20-alpine      # ❌ May not have ARM64
FROM node:20-bookworm-slim  # ❌ Debian bookworm may not have ARM64
```

### OCR Server: Alpine + apk (not Debian + apt)

When using `node:20-alpine3.20`, system packages must use `apk` not `apt-get`:

```dockerfile
# ✅ CORRECT — Alpine uses apk
RUN apk add --no-cache \
  ghostscript \
  ocrmypdf \
  poppler-utils \
  tesseract-ocr \
  tesseract-ocr-data-spa \
  tesseract-ocr-data-eng

# ❌ WRONG — apt-get doesn't exist on Alpine
RUN apt-get update && apt-get install -y ghostscript ...
```

### `npm ci` Requires `package-lock.json`

`npm ci --production` fails without `package-lock.json`. Use `npm install --omit=dev` instead:

```dockerfile
# ✅ CORRECT — works without lockfile
COPY package*.json ./
RUN npm install --omit=dev

# ❌ WRONG — fails if package-lock.json missing
COPY package*.json ./
RUN npm ci --production
```

## Portainer Stack Deployment

### Portainer Should NOT Be in Its Own Compose

If Portainer already runs externally (managing Docker), including it in a compose stack is redundant and causes conflicts. Remove `portainer:` service from docker-compose.yml.

### Repo Filename Issues Break Portainer Clone

Portainer can't clone repos with control characters in filenames (e.g., `configuration.yaml\r`). Fix:

```bash
# Find files with carriage returns
find . -name "*\r*" -o -name "*$(printf '\r')*"

# Remove offending files
git rm "path/to/file$(printf '\r')"
git commit -m "fix: remove file with carriage return in filename"
```

### Git Credentials on NAS

SSH sessions to NAS may not have git credentials configured. Push failures look like:

```
fatal: could not read Username for 'https://github.com': No existe el dispositivo o la dirección
```

Fix: Use token in URL or configure credential helper.

### Container Name Conflict After Stack Update

When updating a stack that replaces existing standalone containers:

```
Conflict. The container name "/telegram-downloader" is already in use by container "..."
```

**Option A — force-recreate (safer, only recreates changed):**
```bash
docker compose up -d --force-recreate
```

**Option B — full down + up (clean slate, brief downtime):**
```bash
docker compose down
docker compose up -d
```

**Option C — remove conflicting container:**
```bash
docker rm -f telegram-downloader
docker compose up -d
```

Data on volumes (`/volume1/...`) survives `docker compose down`.

### Mount File vs Directory Conflict

```
mount src=.../data.yaml, dst=/app/data.yaml, flags=MS_BIND|MS_REC: not a directory
```

This means the host path is a **file** but the container expects a **directory** (or vice-versa). Causes:
- The host path doesn't exist (Docker creates a directory instead of file)
- Type mismatch (file vs directory)

Fix: Remove the problematic service from compose or fix the host path type.

## NAS Gateway Endpoint Management

### Repo Mismatch: `nas-gateway` vs `nas-infrastructure`

Two repos define the NAS gateway:
- `nas-gateway/` — public repo, has `/jobs/app-release/notify`
- `nas-infrastructure/` — runs on NAS, may be outdated

If the NAS runs an older version without the endpoint, you get HTTP 404.

**Fix:** Sync code to NAS and rebuild:
```bash
# Copy updated files to NAS share
cp nas-gateway/gateway/server.js "/volume1/docker NAS/nas-app-gateway/"
cp nas-gateway/gateway/modules/notifications/sendAppReleasePush.js "/volume1/docker NAS/nas-app-gateway/modules/notifications/"

# Rebuild on NAS
ssh user@nas
cd /volume1/docker\ NAS
docker compose down
docker compose build --no-cache nas-app-gateway
docker compose up -d
```

### Gateway `.env` File Corruption

NAS `.env` files can get corrupted with concatenated lines (no newline between entries):

```
NAS_GATEWAY_TOKEN=aaaNAS_GATEWAY_TOKEN=bbbNAS_GATEWAY_TOKEN=ccc
```

Fix: Rewrite cleanly:
```bash
cat > .env << 'EOF'
PORT=8790
NAS_GATEWAY_TOKEN=correct_token_here
NAS_GATEWAY_CONFIG_DIR=/app/config/apps
NAS_GATEWAY_LOG_LEVEL=info
EOF
```

## Python Script .env Loading

Python scripts don't auto-load `.env`. Add explicit loading:

```python
# Add after imports, before main logic
def load_env() -> None:
    env_paths = [
        Path(__file__).resolve().parents[1] / '.env',  # project root
        Path.home() / '.env',                           # home directory
    ]
    for env_path in env_paths:
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ.setdefault(key.strip(), value.strip())
            return

load_env()
```

## Git History Rewriting to Remove Secrets

If a secret (e.g., `service-account.json`) was committed and pushed:

```bash
# Remove file from all history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch path/to/secret.json' \
  --prune-empty --tag-name-filter cat -- --all

# Verify removal
git log --all --full-history --name-only --pretty=format:"%H %s" -- "**/secret.json"
# Should return nothing

# Force push to overwrite remote history
git push --force origin develop
```

**WARNING:** This rewrites history. Anyone with old clones must re-clone.

## Git Divergent Branches on NAS

When local and remote branches diverge (common on NAS with intermittent pushes):

```bash
# Rebase local on top of remote (preferred for linear history)
git pull --rebase origin develop
git push origin develop

# If rebase has conflicts, resolve then:
git add .
git rebase --continue
git push origin develop
```

## Portainer Stack Centralization

### Merging Multiple Standalone Stacks into One

When transitioning from individual stacks (e.g., `nas-app-gateway`, `nas-backup-server`, `telegram-downloader`) to a single unified stack:

1. **Delete old stacks** in Portainer (removes from Portainer management, not containers)
2. **Remove old containers** on NAS:
   ```bash
   cd /volume1/services
   docker compose down
   ```
3. **Create new unified stack** pointing to repo with all services
4. **Data survives** on volumes (`/volume1/...`, `/volume1/Docker/...`)

### Container Name Conflicts

After centralization, old containers conflict with new ones:

```bash
# Option A: force-recreate (only recreates changed containers)
docker compose up -d --force-recreate

# Option B: full down + up (clean slate)
docker compose down
docker compose up -d

# Option C: remove specific conflicting container
docker rm -f <container_name>
docker compose up -d
```

## Standalone Containers (Not in Compose)

Some services like **Ollama** may run as standalone containers outside Portainer stacks:

```bash
# Check standalone containers
docker ps --format '{{.Names}}' | grep -v "$(docker compose ps -q)"

# Recreate Ollama if lost
docker run -d \
  --name ollama \
  -p 11434:11434 \
  -v /volume1/Docker/ollama:/root/.ollama \
  --restart unless-stopped \
  ollama/ollama:latest
```

**Note:** Standalone containers aren't managed by Portainer stacks. Document them separately.

## Verification

After changes, verify ARM64 compatibility:

```bash
# Python-based check (more reliable than bash grep)
python3 -c "
import yaml
data = yaml.safe_load(open('docker-compose.yml'))
for name, svc in data.get('services', {}).items():
    img = svc.get('image', '')
    plat = svc.get('platform', '')
    build = svc.get('build', '')
    if img and not plat:
        print(f'FAIL: {name} ({img}) missing platform')
    elif img:
        print(f'PASS: {name} ({img}) -> {plat}')
"
```

Check services are healthy after deploy:

```bash
# All containers running
docker compose ps

# Check logs for errors
docker compose logs --tail=50 <service_name>
```
