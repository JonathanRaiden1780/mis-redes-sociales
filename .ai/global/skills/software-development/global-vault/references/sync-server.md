# Sync Server — Bidirectional Vault Sync with Conflict Resolution

## Overview

A sync server that keeps `.ai/global/` directories synchronized between the NAS and AIEP repo. Uses Git for version control and supports multiple conflict resolution strategies.

## Architecture

```
nas-sync-server/
├── sync_server.py     # Core sync logic + BackupManager
├── api.py             # HTTP API (Flask/FastAPI)
├── Dockerfile
└── config/
    └── vault/         # Synced vault directory
        ├── rules/
        ├── patterns/
        ├── skills/
        ├── projects/
        └── memory.yaml
```

## Sync Flow

```
NAS Vault (.ai/global/)  ←→  Sync Server  ←→  AIEP Vault (.ai/global/)
     (local)                   (sync)            (remote repo)
```

1. **Compare files** — Hash-based comparison (MD5)
2. **Detect conflicts** — Same file modified in both locations
3. **Resolve conflict** — Apply strategy (newer/nas-wins/aiep-wins)
4. **Copy files** — Winner version copied to loser location
5. **Commit** — Git commit in both repos with sync message

## Conflict Resolution Strategies

### `newer` (Default)
```python
if nas_mtime >= aiep_mtime:
    winner = "nas"
else:
    winner = "aiep"
```

### `nas-wins`
```python
winner = "nas"  # Always prefer NAS version
```

### `aiep-wins`
```python
winner = "aiep"  # Always prefer AIEP version
```

## BackupManager

```python
class BackupManager:
    def create_backup(label="auto") -> Path
    def cleanup_old_backups(keep_days=7) -> int
    def list_backups() -> list[dict]
```

**Backup structure:**
```
/app/data/backups/
├── vault_backup_daily_20260821_030000/
│   ├── rules/
│   ├── patterns/
│   ├── skills/
│   ├── projects/
│   ├── memory.yaml
│   └── manifest.json
├── vault_backup_startup_20260820_120000/
└── ...
```

**Schedule:**
- **Daily at 3 AM:** Automatic backup
- **On startup:** Initial backup
- **Manual:** Via API `POST /backup`
- **Cleanup:** Remove backups older than 7 days

## GitSyncManager

```python
class GitSyncManager:
    def init_repo()
    def has_changes() -> bool
    def add_all()
    def commit(message: str)
    def get_last_commit_time() -> datetime
```

**Auto-commit message format:** `Auto-sync: N files synced`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server status + last sync info |
| `/status` | GET | Full status including backup list |
| `/sync` | POST | Trigger immediate sync |
| `/backup` | POST | Create manual backup |
| `/backups` | GET | List all backups |
| `/cleanup` | POST | Clean old backups (`{"keep_days": 7}`) |

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `SYNC_INTERVAL` | 300 | Sync interval in seconds (5 min) |
| `CONFLICT_STRATEGY` | `newer` | Conflict resolution strategy |

## Sync Directories

```python
SYNC_DIRS = ["rules", "patterns", "skills", "projects", "memory.yaml"]
```

## Integration with Dashboard

The sync server is displayed in the NAS Dashboard under the "Sync" category with:
- Last sync timestamp
- Number of files synced
- Number of conflicts resolved
- Backup count
- Manual sync/backup buttons

## Pitfalls

1. **Don't sync node_modules or large binaries** — add to `.gitignore`
2. **Don't forget to commit after sync** — Git tracks what was synced
3. **Don't use `aiep-wins` if NAS is primary** — user's local changes get overwritten
4. **Don't skip backup cleanup** — old backups accumulate disk usage
5. **Don't expose backup endpoint publicly** — contains config data
6. **Don't forget `GIT_TERMINAL_PROMPT=0`** — prevents git from hanging on credentials
