# ARM64 Docker Compatibility

## Supported Base Images

| Image | Architecture | Notes |
|-------|-------------|-------|
| `node:20-alpine3.20` | amd64, arm64 | Preferred for Node.js services |
| `python:3.11-slim` | amd64, arm64 | Use `-alpine` variant for smaller size |
| `cloudflare/cloudflared:latest` | amd64, arm64 | Multiarch |
| `tailscale/tailscale:stable` | amd64, arm64 | Multiarch |
| `portainer/portainer-ce:latest` | amd64, arm64 | Multiarch |
| `deluan/navidrome:latest` | amd64, arm64 | Multiarch |
| `ghcr.io/home-assistant/home-assistant:stable` | amd64, arm64 | Multiarch |

## Unsupported / Problematic

| Image | Issue |
|-------|-------|
| `node:20-bookworm-slim` | Usually amd64 only |
| `node:20-alpine` (unpinned) | May lack ARM64 manifest |
| `mikenye/picard:latest` | Check manifest for arm64 support |
| `tangyoha/telegram_media_downloader:latest` | Check manifest |

## Docker Compose Syntax for ARM64

For build-based services:
```yaml
services:
  nas-app-gateway:
    build: ./core/nas-app-gateway
    platform: linux/arm64
```

For prebuilt images:
```yaml
services:
  music-syncer:
    image: python:3.11-slim
    platform: linux/arm64
```

## Verifying ARM64 Support

```bash
# Check manifest
docker manifest inspect node:20-alpine3.20 | grep architecture

# Build with explicit platform
docker build --platform linux/arm64 -t myimage .

# Buildx for multiarch
docker buildx build --platform linux/amd64,linux/arm64 -t myimage .
```

## Common Docker Build Errors

### `npm ci` fails
```
ERROR: failed to solve: process "/bin/sh -c npm ci --production" did not complete successfully
```
**Cause**: `npm ci` requires `package-lock.json`.
**Fix**: Use `npm install --omit=dev` instead.

### `no matching manifest for linux/arm64/v8`
```
Failed to deploy a stack: compose build operation failed: failed to solve: no matching manifest for linux/arm64/v8
```
**Cause**: Base image doesn't support ARM64.
**Fix**: Switch to `node:20-alpine3.20` or add `platform: linux/arm64`.

### `invalid path contains control character`
```
Unable to clone git repository: failed to clone git repository: invalid path "configuration.yaml\r"
```
**Cause**: File with carriage return in filename.
**Fix**: Find and remove:
```bash
find . -name "*\r*"
git rm "path/to/file$(printf '\r')"
```
