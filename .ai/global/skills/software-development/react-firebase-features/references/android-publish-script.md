# Android Publish Script Pattern — Session 2026-08-20

## Context

MiNegocio uses a Python script (`scripts/publish_android_zip.py`) to build the Android APK, package it as ZIP, generate metadata, deploy to Firebase Hosting, and notify the NAS Gateway for push notifications.

## Package Manager Detection

The script auto-detects which package manager to use based on lockfiles:

```python
def detect_package_manager(root: Path) -> str:
    """Detect which package manager to use based on lockfiles."""
    if (root / "pnpm-lock.yaml").exists() or (root / "pnpm-workspace.yaml").exists():
        return "pnpm"
    if (root / "bun.lockb").exists():
        return "bun"
    if (root / "yarn.lock").exists():
        return "yarn"
    # Default to pnpm for this project
    return "pnpm"
```

## RULE: No npm (USER PREFERENCE)

**Explicit user rule (2026-08-20)**: `npm` is NOT a supported package manager. Only `pnpm`, `bun`, and `yarn` are allowed. This is enforced in:
- `detect_package_manager()` — no `package-lock.json` branch
- `--package-manager` CLI flag choices: `["pnpm", "bun", "yarn"]`
- Install and build commands: only 3 branches (no `else: npm` fallback)

**Why**: User explicitly stated "npm quitalo ese ya no estara disponible como regla" (remove npm, it's no longer available as a rule).

## Script Flow

1. `--bump` → increment `versionCode` + patch `versionName` in `android/app/build.gradle`
2. `--install` → run `{pm} install`
3. Build web → `{pm} run build`
4. `npx cap sync android`
5. `./gradlew assembleDebug` (or `assembleRelease` with `--release`)
6. Copy APK to NAS if `--nas-apk-dir` provided
7. Create ZIP at `public/downloads/mi-negocio-android.zip`
8. Write metadata JSON at `public/downloads/mi-negocio-android.json`
9. `npx firebase-tools deploy --only hosting`
10. POST to NAS Gateway `/jobs/app-release/notify` for push notifications

## CLI Usage

```bash
# Auto-detect PM + bump version + release build + install
python3 scripts/publish_android_zip.py --bump --release --install

# Force PM
python3 scripts/publish_android_zip.py --bump --release --package-manager pnpm

# NAS APK copy
python3 scripts/publish_android_zip.py --bump --release --nas-apk-dir /path/to/nas/web

# With download URL for metadata
python3 scripts/publish_android_zip.py --bump --release --download-url https://nas.example.com/downloads/mi-negocio-android.zip
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `NAS_GATEWAY_URL` | Gateway base URL for push notification trigger |
| `NAS_GATEWAY_TOKEN` | Auth token for Gateway API |
| `NAS_APK_DIR` | Local mount point of NAS web directory |
| `MI_NEGOCIO_DOWNLOAD_URL` | Public HTTPS URL for metadata |
| `CLOUDFLARE_TOKEN` | Cloudflare Tunnel token |
| `TAILSCALE_KEY` | Tailscale auth key |

## Docker Alternative

For CI/CD or reproducible builds, consider wrapping the script in a Docker image with:
- Android SDK + NDK
- Node.js 20.19+ (Vite 7 requirement)
- Python 3.11+
- Bun or pnpm preinstalled

## Verification

```bash
# Python syntax check
python3 -c "import ast; ast.parse(open('scripts/publish_android_zip.py').read()); print('Syntax OK')"

# CLI help
python3 scripts/publish_android_zip.py --help

# Verify PM detection
python3 -c "from scripts.publish_android_zip import detect_package_manager; from pathlib import Path; print(detect_package_manager(Path('.')))"
```
