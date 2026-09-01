# AIEP Documentation Patterns

## Session Reference — SPEC-053 Global Auto-Distribution

### Architecture Decision: Same-repo sync

The global memory lives in `.ai/global/` **inside the same project repository**. This was a deliberate design choice confirmed by the user:

- No external URL needed
- Memory travels with the project via git push/pull
- Works offline (local repo has everything)
- Auto-sync happens on every `ai` command via middleware hooks

### Directory Structure

```
<project>/
├── .ai/
│   ├── memory.yaml          # Local project memory
│   ├── state.yaml           # Local project state
│   ├── global/              # ← Global memory (shared across team)
│   │   ├── memory.yaml      # Team insights
│   │   ├── index.yaml       # Tool/skill index
│   │   ├── notifications.yaml
│   │   └── sync-state.yaml
│   └── ...
└── ...
```

### Key Components Created

| Component | Path | Purpose |
|-----------|------|---------|
| `GlobalSyncService` | `src/aiep/global_sync.py` | Syncs `.ai/global/` via git |
| `GlobalSyncTrigger` | `src/aiep/sync/trigger.py` | Decides when to sync |
| `SyncMiddleware` | `src/aiep/sync/middleware.py` | Hooks into CLI commands |
| `SyncTracker` | `src/aiep/sync/tracker.py` | Persists sync state |
| `NewToolNotifier` | `src/aiep/sync/notifier.py` | Registers new tools |
| `SecureProviderStore` | `src/aiep/providers/secure_store.py` | Encrypted credentials |
| `TOTP2FA` | `src/aiep/security/two_factor.py` | Two-factor auth |
| `crypto.py` | `src/aiep/security/crypto.py` | Fernet + PBKDF2 encryption |

### Auto-Sync Flow

```python
# In cli.py — main_callback
@app.callback(invoke_without_command=True)
def main_callback(ctx: typer.Context) -> None:
    if ctx.invoked_subcommand:
        _auto_sync_before_command()      # Pull before
        ctx.call_on_close(_auto_sync_after_command)  # Push after
```

### Documentation Files Created

| File | Purpose |
|------|---------|
| `docs/specs/SPEC-053-global-auto-distribution.md` | Technical spec with ADRs |
| `docs/SECURITY.md` | Security guide (2FA, encryption, troubleshooting) |
| `docs/GETTING_STARTED.md` | Team onboarding guide |
| `docs/COMMAND_REFERENCE.md` | All commands including new security/sync commands |
| `docs/QUICKSTART.md` | Updated with security setup step |
| `docs/USER_GUIDE.md` | Updated with security section |

### Install.sh Changes

```bash
setup_git_sync() {
    # No longer asks for external URL
    # Creates .ai/global/ in current project
    mkdir -p "${project_root}/.ai/global"
    touch "${project_root}/.ai/global/.gitkeep"
    # Adds to .gitignore
}
```

### Security Features

- Fernet (AES-128-CBC) for encryption
- PBKDF2-HMAC-SHA256 with 600,000 iterations (OWASP 2023)
- TOTP-based 2FA (RFC 6238)
- chmod 0o600 on credential files
- fcntl.flock for file locking
- Git URL validation against remote helper injection
- Checksum verification for installer downloads

### User Preference Signals

- **Language**: All docs in Spanish (user communicates in Spanish)
- **Format**: ASCII diagrams, not mermaid
- **Sync model**: Same-repo, not external repo
- **Auto-sync**: Must be automatic, no manual git commands needed
