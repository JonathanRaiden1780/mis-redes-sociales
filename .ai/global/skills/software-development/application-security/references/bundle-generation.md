# Bundle Generation for AIEP Installer

How to generate the encrypted `bundle.aiep` that ships with the installer. The bundle contains base Hermes configuration (config, skills, platforms) encrypted with a shared passphrase.

## The Pitfall: `generate_bundle.py` Hangs on Large Directories

`BundleManager.create_bundle()` does `config_dir.rglob("*")` over the entire config directory. If you point it at `~/.hermes`, it will hang or OOM because:

- `~/.hermes/hermes-agent/` = 2.1GB, 112,009 files (git repo with full history)
- `~/.hermes/node/`, `~/.hermes/lsp/`, `~/.hermes/bin/` = hundreds of MB more
- Total: ~2.2GB+ of non-config files

**Symptom:** Script times out at any timeout limit (30s, 60s, even 600s). No output.

## Correct Workflow

Build a clean config directory from `~/.config/aiep/hermes/` (the actual AIEP-managed Hermes config), not from `~/.hermes`:

```bash
# 1. Create clean temp directory
TMPDIR=$(mktemp -d)
mkdir -p "$TMPDIR/hermes"

# 2. Copy only the config files that should ship in the bundle
cp ~/.config/aiep/hermes/config.yaml   "$TMPDIR/hermes/"
cp ~/.config/aiep/hermes/SOUL.md       "$TMPDIR/hermes/"
cp -r ~/.config/aiep/hermes/skills     "$TMPDIR/hermes/"
cp -r ~/.config/aiep/hermes/platforms  "$TMPDIR/hermes/"

# 3. Generate bundle from the clean directory
python3 scripts/generate_bundle.py \
  --config-dir "$TMPDIR" \
  --output bundle.aiep \
  --passphrase "your-passphrase"

# 4. Verify it decrypts
python3 -c "
import sys, tarfile, io
sys.path.insert(0, 'src')
from pathlib import Path
from aiep.security.crypto import EncryptedBlob, decrypt

blob = EncryptedBlob.deserialize(Path('bundle.aiep').read_bytes())
tar_data = decrypt(blob, 'your-passphrase')
tar_buffer = io.BytesIO(tar_data.encode('latin-1'))
with tarfile.open(fileobj=tar_buffer, mode='r') as tar:
    print(f'OK: {len(tar.getmembers())} files')
    for m in tar.getmembers()[:5]:
        print(f'  {m.size:>8} {m.name}')
"

# 5. Clean up
rm -rf "$TMPDIR"
```

## What Goes in the Bundle

| File | Purpose | Source |
|------|---------|--------|
| `hermes/config.yaml` | Default model/provider config | `~/.config/aiep/hermes/config.yaml` |
| `hermes/SOUL.md` | System prompt for the agent | `~/.config/aiep/hermes/SOUL.md` |
| `hermes/skills/` | Default skill packs (14 packs) | `~/.config/aiep/hermes/skills/` |
| `hermes/platforms/` | Platform pairing state | `~/.config/aiep/hermes/platforms/` |

**Do NOT include:** `auth.json`, `.env`, `state.db`, `logs/`, `cache/`, `sessions/`, `hermes-agent/`, `node/`, `lsp/`. These are runtime state or installed separately by the installer.

## Verifying Bundle Validity

A valid bundle:
1. Deserializes as `EncryptedBlob` (JSON with `ciphertext`, `salt`, `iterations`, `algorithm`)
2. Decrypts with the correct passphrase (wrong passphrase → `EncryptionError: Invalid passphrase or corrupted data`)
3. Contains a valid tar archive with the expected files
4. Has `chmod 0o600` set on the bundle file itself

## Installer Integration

The installer (`install.sh`) extracts the bundle to `$CONFIG_DIR/hermes/` (which is `~/.config/aiep/hermes/`). The Python snippet in `copy_hermes_config()` uses `BundleManager.extract_bundle()` with the user-supplied passphrase. If extraction fails, it falls back to `generate_fresh_config()` which writes a minimal `config.yaml` from a heredoc.
