# Global Vault Architecture — SPEC-053

## Directory Structure

```
.ai/global/
├── rules/              — Team rules (coding style, behavior, security)
├── skills/             — Discovered tools and skills (YAML)
├── patterns/           — Reusable architecture patterns (YAML)
├── projects/           — Index of all projects (YAML)
├── index.yaml          — Fast lookup index (auto-generated)
└── vault.yaml          — Vault config (version, team, timestamps)
```

## Data Format

All entries use YAML for machine readability:

```yaml
# skills/example.yaml
name: pytest
description: Python testing framework
added_at: '2026-08-15T16:41:59.675237+00:00'
metadata:
  source: project_memory
  category: testing
```

## Content-Hash Dedup

Projects and patterns should use content-hash versioning for distributed merge:

```python
import hashlib

def content_hash(data: dict) -> str:
    """Generate content hash for dedup."""
    content = json.dumps(data, sort_keys=True)
    return hashlib.sha256(content.encode()).hexdigest()[:12]
```

## Sync Strategy

- **Before every `ai` command**: auto-pull `.ai/global/` from git
- **After every `ai` command**: auto-push changes to git
- **Periodic sync**: cron every 6 hours for background machines
- **Conflict resolution**: content-hash dedup (last-write-wins per entry)

## Encryption at Rest

| File | Encryption |
|------|------------|
| `.env` | Fernet + PBKDF2 |
| `auth.json` | Fernet + PBKDF2 |
| `config.yaml` | Fernet + PBKDF2 (if contains secrets) |
| Other YAML | Plaintext (no secrets) |

## Session Source

Designed 2026-08-15 for the AI Engineering Platform project at `/home/jonathanh/Projects/AI-Engineering-Platform`.
