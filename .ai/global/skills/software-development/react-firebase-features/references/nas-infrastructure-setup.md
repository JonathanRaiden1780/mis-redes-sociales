# NAS Infrastructure Setup (2026-08-20)

Complete infrastructure for MiNegocio NAS at `~/proyectos/nas-infrastructure/`.

## Service Inventory (12 services)

| Service | Port | Location | Purpose |
|---------|------|----------|---------|
| Cloudflare tunnel | — | root | Remote access |
| Tailscale | — | root | VPN mesh |
| **Portainer CE** | 9000 | `portainer/` | Docker management UI |
| nas-app-gateway | 8790 | `core/nas-app-gateway/` | Push notifications |
| nas-automation-engine | 8791 | `core/nas-automation-engine/` | IF-THEN rule engine |
| nas-backup-server | 8787 | `core/nas-backup-server/` | App backups |
| nas-ocr-server | 8788 | `core/nas-ocr-server/` | PDF invoice OCR |
| Home Assistant | 8123 | `homeassistant/` | Domotics |
| Navidrome | 4533 | `media/` | Music streaming |
| Music syncer | 8088 | `media/` | Spotify/youtube sync |
| Picard | 5800 | `media/` | Music metadata |
| Telegram downloader | 5027 | `utilities/` | Media downloads |

## Portainer CE

```yaml
# portainer/docker-compose.yml
services:
  portainer:
    image: portainer/portainer-ce:latest
    container_name: portainer
    restart: unless-stopped
    ports:
      - "9000:9000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - portainer_data:/app/data
```

- Access: `http://<nas-ip>:9000`
- Manages all Docker containers on NAS
- No need to SSH for routine operations

## nas-app-gateway

Express + Firebase Admin + token auth, port 8790.

### Endpoints:

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | None | Health check |
| `/apps` | GET | `x-gateway-token` | List registered apps |
| `/jobs/notifications/run` | POST | `x-gateway-token` | Run pending notifications |
| `/jobs/app-release/notify` | POST | `x-gateway-token` | Send app release push |

### `/jobs/app-release/notify` payload:

```json
{
  "appId": "minegocio-mk",
  "versionName": "1.0.12",
  "versionCode": "13",
  "downloadUrl": "/downloads/mi-negocio-android.zip"
}
```

### App config format (`config/apps/<appId>.json`):

```json
{
  "appId": "minegocio-mk",
  "firebaseProjectId": "minegocio-mk",
  "serviceAccountPath": "/app/config/service-accounts/minegocio-mk.json",
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

### Environment variables:

| Variable | Description |
|----------|-------------|
| `PORT` | Gateway port (default: 8790) |
| `NAS_GATEWAY_TOKEN` | Auth token for job endpoints |
| `NAS_GATEWAY_CONFIG_DIR` | Path to app configs |
| `NAS_GATEWAY_LOG_LEVEL` | Logging level (default: info) |

## nas-automation-engine

IF-THEN rule engine for MiNegocio:

| Component | Details |
|-----------|---------|
| Triggers | `days_inactive`, `threshold_reached` |
| Conditions | `lifecycle` (prospect/inicio), `status` |
| Actions | `send_whatsapp`, `add_bitacora`, `change_status`, `send_push` |
| Cron | Every 12h (configurable via `CRON_SCHEDULE`) |
| Endpoints | `/health`, `/POST /jobs/automations/run`, `/GET /rules` |

## Dockerfile Best Practices

### Use `npm install --omit=dev` not `npm ci --production`

`npm ci` requires `package-lock.json` which may not exist. Use:

```dockerfile
COPY package*.json ./
RUN npm install --omit=dev
```

### Avoid carriage return in filenames

Portainer fails to clone repos with `\r` in filenames:

```
Unable to clone git repository: failed to clone git repository:
invalid path "configuration.yaml\r": contains control character
```

**Fix:**
```bash
git rm "path/to/file$(printf '\r')"
git commit -m "fix: remove file with carriage return in filename"
```

**Detection:**
```bash
find . -name "*\r*" -o -name "*$(printf '\r')*" 2>/dev/null | cat -A
```

## Unified docker-compose.yml

Single file at root controls all 12 services. Deploy via:

```bash
cd ~/proyectos/nas-infrastructure
docker compose up -d --build
```

Or via Portainer → Stacks → Add Stack → paste YAML.

## Sync to NAS production

Production NAS share: `smb://192.168.0.129/minegociomk/` (mounted at `/home/jonathanh/share/docker NAS/`).

### Option 1: Manual Sync Script

```bash
#!/bin/bash
# sync-to-nas.sh - run from nas-gateway/ or nas-infrastructure/

NAS_DIR="/home/jonathanh/share/docker NAS"

# Gateway
cp gateway/server.js "$NAS_DIR/nas-app-gateway/"
cp gateway/package.json "$NAS_DIR/nas-app-gateway/"
cp -r gateway/lib "$NAS_DIR/nas-app-gateway/"
cp -r gateway/modules "$NAS_DIR/nas-app-gateway/"

# Automation
cp automation/server.js "$NAS_DIR/nas-automation-engine/"
cp automation/package.json "$NAS_DIR/nas-automation-engine/"

echo "=== Reiniciando servicios ==="
echo "En la NAS: cd $NAS_DIR && docker compose down && docker compose up -d --build"
```

### Option 2: Git on NAS (recommended for frequent updates)

```bash
# First time
ssh admin@<nas-ip>
cd /volume1/docker\ NAS
git clone https://github.com/JonathanRaiden1780/nas-infrastructure.git

# Update
cd /volume1/docker\ NAS/nas-infrastructure
git pull origin develop
cd /volume1/docker\ NAS
docker compose down
docker compose up -d --build
```

### Option 3: Portainer Stacks

1. Go to `http://<nas-ip>:9000`
2. **Stacks** → **Add Stack**
3. Name: `minegocio-nas`
4. Paste `docker-compose.yml` content
5. Click **Deploy the stack**

To update:
1. Edit `docker-compose.yml` in repo
2. In Portainer: **Stacks** → **minegocio-nas** → **Editor**
3. Paste updated content → **Update the stack**

## Troubleshooting

### Git not found in SSH session (Synology NAS)

Git installed but not in PATH:

```bash
# Find git location
find /usr -name git -type f 2>/dev/null

# Add to PATH
export PATH=$PATH:/usr/bin:/usr/local/bin
git --version

# Make permanent
echo 'export PATH=$PATH:/usr/bin:/usr/local/bin' >> ~/.bashrc
```

### Container fails with `npm ci` error

Check Dockerfile uses `npm install --omit=dev` not `npm ci --production`.

### Portainer 404 on `/jobs/app-release/notify`

The deployed gateway version may not have this endpoint. Check:

```bash
curl -X POST -H "x-gateway-token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"appId":"test"}' \
  http://<nas-ip>:8790/jobs/app-release/notify
```

If 404: update `server.js` to add endpoint, rebuild container.

### Portainer git clone fails with "control character"

Check for files with `\r` in name:

```bash
find . -name "*\r*" 2>/dev/null | cat -A
```

Remove them and commit.

### NAS Gateway push returns 401 Unauthorized

Token may be invalid or `.env` file corrupted. Check:

```bash
# On NAS
cat /volume1/services/core/nas-app-gateway/.env
```

Ensure format is clean (no duplicate lines, no `^M` characters):

```
PORT=8790
NAS_GATEWAY_TOKEN=your_token_here
NAS_GATEWAY_CONFIG_DIR=/app/config/apps
NAS_GATEWAY_LOG_LEVEL=info
```
