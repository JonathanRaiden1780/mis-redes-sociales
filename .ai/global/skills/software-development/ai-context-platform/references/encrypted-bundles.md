# Encrypted Bundle Pattern

## Bundle Purpose

A bundle is an encrypted package containing **generic base configuration** that ships with the installer. During installation, it gets decrypted with a shared passphrase to provide initial config for all machines.

## Bundle Contents (Generic Only)

```
bundle.aiep (encrypted)
├── config.yaml    # Model, provider, agent defaults
├── SOUL.md        # Agent personality
├── platforms/     # Platform configs (without real credentials)
└── skills/        # Base skills
```

**NEVER contains:** API keys, tokens, real credentials from the host machine.

## Bundle Creation

```bash
python3 scripts/generate_bundle.py \
  --config-dir ./base-config \
  --output bundle.aiep \
  --passphrase "shared-passphrase"
```

For development only — generates the bundle that ships with the installer.

## Bundle Extraction (During Install)

```python
from aiep.security.bundle import BundleManager

manager = BundleManager(passphrase="shared-passphrase")
extracted = manager.extract_bundle(
    Path("bundle.aiep"),
    Path("~/.config/aiep/hermes")
)
```

## Implementation Pattern

```python
class BundleManager:
    def create_bundle(self, config_dir, output_path, passphrase):
        # Create tar archive
        tar_buffer = io.BytesIO()
        with tarfile.open(fileobj=tar_buffer, mode="w") as tar:
            for file_path in config_dir.rglob("*"):
                if file_path.is_file():
                    tar.add(file_path, arcname=file_path.relative_to(config_dir))
        
        # Encrypt with Fernet + PBKDF2
        blob = encrypt(tar_buffer.getvalue().decode("latin-1"), passphrase)
        output_path.write_bytes(blob.serialize())

    def extract_bundle(self, bundle_path, output_dir, passphrase):
        # Decrypt
        blob = EncryptedBlob.deserialize(bundle_path.read_bytes())
        tar_data = decrypt(blob, passphrase)
        
        # Extract tar
        with tarfile.open(fileobj=io.BytesIO(tar_data.encode("latin-1"))) as tar:
            tar.extractall(output_dir)
```

## Key Decisions

- **Generic only** — bundle is the same for all users, no personal credentials
- **Passphrase shared** — same passphrase for all installations
- **Fallback to fresh config** — if bundle missing or invalid, generate generic config
- **Tar + encrypt** — bundle multiple files into single encrypted blob

## Session Source

Implemented 2026-08-15 for AI Engineering Platform (SPEC-053).
