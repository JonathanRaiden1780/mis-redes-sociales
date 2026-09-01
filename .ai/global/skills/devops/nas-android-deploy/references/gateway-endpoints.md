# NAS Gateway Endpoints Reference

## Current Version (nas-infrastructure/core/nas-app-gateway)

### Implemented Routes

```
GET  /health                    — No auth, health check
GET  /apps                      — x-gateway-token required
POST /jobs/notifications/run    — x-gateway-token required
POST /jobs/app-release/notify   — x-gateway-token required
```

### Auth Mechanism

```javascript
// lib/httpAuth.js
export const assertGatewayToken = (req, token) => {
  const expected = String(token || '').trim();
  const received = String(req.header('x-gateway-token') || '').trim();
  if (expected !== received) {
    const error = new Error('Unauthorized.');
    error.statusCode = 401;
    throw error;
  }
};
```

Token configured via `NAS_GATEWAY_TOKEN` env var in container.

### App Release Notify Payload

```json
{
  "appId": "minegocio-mk",
  "versionName": "1.0.12",
  "versionCode": "13",
  "downloadUrl": "/downloads/mi-negocio-android.zip"
}
```

### Config File Format

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

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `401 Unauthorized` | Token mismatch | Verify `NAS_GATEWAY_TOKEN` matches container env |
| `404 Not Found` for `/jobs/app-release/notify` | Gateway version too old | Sync `nas-gateway` repo to NAS and rebuild container |
| `500 App config not found` | Config file missing | Add config JSON to `/app/config/apps/` |
| Token works for `/health` but not endpoints | `/health` doesn't authenticate | This is expected behavior |

## Portainer Integration

- Repo: `https://github.com/JonathanRaiden1780/nas-infrastructure.git`
- Branch: `develop`
- Compose file: `docker-compose.yml`
- Build services need `platform: linux/arm64` for Synology NAS

## Repo Sync: nas-gateway vs nas-infrastructure

The `nas-gateway` repo (public, gateway-only) and `nas-infrastructure` repo (unified NAS stack) share gateway code. When adding endpoints to `nas-gateway`, manually sync to `nas-infrastructure/core/nas-app-gateway/`:

```bash
# Copy gateway files
cp nas-gateway/gateway/server.js nas-infrastructure/core/nas-app-gateway/
cp nas-gateway/gateway/lib/*.js nas-infrastructure/core/nas-app-gateway/lib/
cp -r nas-gateway/gateway/modules/* nas-infrastructure/core/nas-app-gateway/modules/

# Then rebuild in Portainer
```

**Lesson learned**: `nas-infrastructure` was missing `/jobs/app-release/notify` endpoint that existed in `nas-gateway`. Always check both repos when gateway behavior differs from expected.
