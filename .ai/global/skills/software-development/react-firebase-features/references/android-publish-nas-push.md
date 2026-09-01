# Android Publish + NAS Push Workflow

Publishing Android APKs and notifying NAS Gateway of new releases.

## Publish Script (`scripts/publish_android_zip.py`)

### Invocation
```bash
# Correct way — Python, not bash source
python3 scripts/publish_android_zip.py

# With push-only (skip compilation, use existing APK)
python3 scripts/publish_android_zip.py --push-only
```

**Pitfall:** Do NOT use `. publish_android_zip.py` (bash source). The script is Python and will fail with confusing errors like "No se ha encontrado la orden `from`".

### Auto-loading `.env`
The script searches for `.env` in this order:
1. Project root (`<repo>/.env`)
2. Home directory (`~/.env`)

`.env` format:
```
NAS_GATEWAY_URL=http://192.168.0.129:8790
NAS_GATEWAY_TOKEN=your_token_here
```

**Pitfall:** The `.env` file on the NAS gateway side can get corrupted with duplicate lines. Validate format:
```bash
cat /volume1/services/core/nas-app-gateway/.env
```

Should be clean lines (no `^M` characters, no duplicate entries). Each variable on its own line:
```
PORT=8790
NAS_GATEWAY_TOKEN=valid_token_here
NAS_GATEWAY_CONFIG_DIR=/app/config/apps
NAS_GATEWAY_LOG_LEVEL=info
```

If corrupted, rewrite:
```bash
cat > /volume1/services/core/nas-app-gateway/.env << 'EOF'
PORT=8790
NAS_GATEWAY_TOKEN=valid_token_here
NAS_GATEWAY_CONFIG_DIR=/app/config/apps
NAS_GATEWAY_LOG_LEVEL=info
EOF

docker compose down && docker compose up -d --build
```

### Flags
| Flag | Purpose |
|------|---------|
| `--push-only` | Skip compilation, use existing APK at `android/app/build/outputs/apk/debug/app-debug.apk` |
| `--bump` | Increment version code |
| `--release` | Build release APK instead of debug |
| `--package-manager {pnpm,bun,yarn}` | Force package manager |
| `--download-url URL` | Custom download URL for metadata |
| `--nas-apk-dir PATH` | Copy APK to NAS web directory |

### Workflow
1. Build web (`pnpm run build`)
2. Capacitor sync (`npx cap sync android`)
3. Gradle build (`./gradlew assembleDebug`)
4. Package APK + metadata into `public/downloads/`
5. Firebase deploy (`npx firebase-tools deploy --only hosting`)
6. NAS Gateway push (if env vars configured)

## NAS Gateway Endpoint: `/jobs/app-release/notify`

### When to use
After Firebase deploy succeeds, notify the NAS gateway so it can push update notifications to registered devices via FCM.

### Payload
```json
{
  "appId": "minegocio-mk",
  "versionName": "1.0.12",
  "versionCode": "13",
  "downloadUrl": "/downloads/mi-negocio-android.zip"
}
```

### Headers
```
x-gateway-token: <token>
Content-Type: application/json
```

### Response
```json
{ "ok": true, "summary": { "sent": 5, "tokens": 7 } }
```

## Debugging NAS Gateway Errors

### 404 Not Found

The endpoint doesn't exist in the deployed gateway version. The gateway in `nas-infrastructure` repo may have it, but the deployed container doesn't.

**Check deployed routes:**
```bash
# Via curl (POST to test endpoint)
curl -s -X POST -H "x-gateway-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{"appId":"test"}' \
  http://<nas-ip>:8790/jobs/app-release/notify

# If 404: update code, rebuild container
ssh admin@<nas-ip>
cd /volume1/docker\ NAS/nas-infrastructure
git pull origin develop
cd /volume1/docker\ NAS
docker compose build --no-cache nas-app-gateway
docker compose up -d nas-app-gateway
```

**Required code in `server.js`:**
```js
import { sendAppReleasePush } from './modules/notifications/sendAppReleasePush.js';

export const buildServerRoutes = () => ['/health', '/apps', '/jobs/notifications/run', '/jobs/app-release/notify'];

app.post('/jobs/app-release/notify', async (req, res) => {
  try {
    assertGatewayToken(req, TOKEN);
    const appId = String(req.body?.appId || '').trim();
    const config = loadGatewayConfigs(CONFIG_DIR).find((item) => item.appId === appId);
    if (!config) {
      res.status(404).json({ ok: false, error: 'App config not found.' });
      return;
    }
    const summary = await sendAppReleasePush({
      adminApp: getFirebaseAdminApp(config),
      config,
      release: req.body || {}
    });
    res.json({ ok: true, summary });
  } catch (error) {
    logger.error('app release notification error', error);
    res.status(error.statusCode || 500).json({ ok: false, error: error.message });
  }
});
```

### 401 Unauthorized

Token is invalid or doesn't match what's configured in the gateway's `.env`.

```bash
# Check token on NAS
cat /volume1/services/core/nas-app-gateway/.env

# Test with curl
curl -H "x-gateway-token: YOUR_TOKEN" http://<nas-ip>:8790/health
# /health doesn't require auth — if this returns ok, gateway is alive

curl -X POST -H "x-gateway-token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"appId":"test"}' \
  http://<nas-ip>:8790/jobs/notifications/run
# If 401: token is wrong
```

### .env Corruption (duplicate lines)

If `.env` was created via multiple `>>` appends, the token may be duplicated:

```bash
# Bad example (corrupted):
NAS_GATEWAY_TOKEN=token1NAS_GATEWAY_TOKEN=token2NAS_GATEWAY_TOKEN=token3

# Fix: rewrite cleanly
cat > .env << 'EOF'
NAS_GATEWAY_URL=http://192.168.0.129:8790
NAS_GATEWAY_TOKEN=valid_token_here
EOF
```

## NAS App Config (`config/apps/<appId>.json`)

The gateway looks up app config by `appId`:

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

The `appReleaseNotifications` module controls whether push is sent. If missing or `disabled`, the endpoint returns early with `{ sent: 0, tokens: 0, disabled: true }`.

## Portainer Git Clone Issues

### "control character" error

Portainer fails to clone repos with `\r` in filenames:
```
Unable to clone git repository: failed to clone git repository:
invalid path "configuration.yaml\r": contains control character
```

**Detection:**
```bash
find . -name "*\r*" -o -name "*$(printf '\r')*" 2>/dev/null | cat -A
```

**Fix:**
```bash
git rm "path/to/file$(printf '\r')"
git commit -m "fix: remove file with carriage return in filename that breaks Portainer clone"
```

### Git not found in SSH session (Synology)

```bash
which git  # If nothing:
find /usr -name git -type f 2>/dev/null

# Add to PATH
export PATH=$PATH:/usr/bin:/usr/local/bin
git --version
```

## Build Issues

### JAVA_HOME not set

```bash
sudo apt install openjdk-17-jdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$JAVA_HOME/bin:$PATH
```

### ANDROID_HOME not set

Create `android/local.properties`:
```
sdk.dir=/home/jonathanh/Android/Sdk
```

### Gradle `npm ci` error in Docker

Dockerfile should use `npm install --omit=dev` (not `npm ci --production`):
```dockerfile
COPY package*.json ./
RUN npm install --omit=dev
```

`npm ci` requires `package-lock.json` which may not exist.
