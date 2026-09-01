# Auto-Sync Architecture

## Overview

AIEP auto-sync keeps the platform repository (where install.sh was executed) synchronized with its remote. This enables cross-machine continuity: install on machine A, make changes, push — then on machine B, pull gets those changes.

## Key Insight

**The AIEP repo itself is the "global" store** — not `~/.ai/global/`. The `.ai/global/` directory lives INSIDE the repo and travels with it. When you push/pull the repo, you sync skills, rules, patterns, ADRs, etc.

## How It Works

```
install.sh
  → Saves repo root to config.yaml as `platform_repo_root`
  → Example: /home/jonathanh/Projects/AI-Engineering-Platform

Every ai command (via main_callback):
  → _auto_sync_before_command(): pull_updates()
  → Execute command
  → _auto_sync_after_command(): push_updates()

ai sync (manual):
  → Reads platform_repo_root from config
  → GlobalSyncService(repo_root).sync()
  → Pull + commit + push
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Machine A                                              │
│  ~/Projects/AI-Engineering-Platform/                    │
│    ├── .ai/global/          ← skills, rules, patterns   │
│    ├── install.sh                                       │
│    ├── src/aiep/                                        │
│    └── config.yaml          ← platform_repo_root = HERE │
│                                                         │
│  ai project init → writes to .ai/global/                │
│  ai sync → reads platform_repo_root → git push          │
└─────────────────────────────────────────────────────────┘
                           │
                           │ git push / pull
                           ▼
┌─────────────────────────────────────────────────────────┐
│  GitHub Remote                                          │
│  origin/master                                          │
└─────────────────────────────────────────────────────────┘
                           │
                           │ git clone / pull
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Machine B                                              │
│  ~/Projects/AI-Engineering-Platform/                    │
│    ├── .ai/global/          ← synced from Machine A     │
│    └── config.yaml          ← platform_repo_root = HERE │
│                                                         │
│  ai setup → reads skills from .ai/global/               │
│  ai sync → reads platform_repo_root → git pull          │
└─────────────────────────────────────────────────────────┘
```

## Implementation Files

| File | Role |
|------|------|
| `install.sh` | Saves `platform_repo_root` to config during install |
| `src/aiep/sync/trigger.py` | Reads config, calls GlobalSyncService |
| `src/aiep/sync/middleware.py` | Hooks into CLI before/after every command |
| `src/aiep/sync/tracker.py` | Persists sync state (last pull/push) |
| `src/aiep/global_sync.py` | Git operations (pull, push, sync) |
| `src/aiep/cli.py` | `main_callback` triggers auto-sync |

## Config Schema

```yaml
# ~/.config/aiep/config.yaml
auto_sync:
  enabled: true
  silent: true
platform_repo_root: /home/jonathanh/Projects/AI-Engineering-Platform
skills:
  registry_path: /home/jonathanh/.local/share/aiep/skills
```

## Git Credential Handling

- `GIT_TERMINAL_PROMPT=0` — prevents interactive credential prompts
- Git credential helper must be configured (store/cache)
- SSH keys or PAT (Personal Access Token) required
- Check `url.git@github.com:.insteadOf` in global git config — forces SSH even on HTTPS remotes

## Common Pitfalls

1. **Forgetting to save `platform_repo_root`** — without this, auto-sync can't find the repo. `install.sh` MUST save it.

2. **Using `Path.cwd()` in `ai sync`** — user may run `ai` from any directory. Always read `platform_repo_root` from config.

3. **Syncing `~/.ai/global/` instead of the repo** — the global dir lives inside the repo. Sync the repo, not the directory.

4. **Tests failing without `platform_repo_root`** — `GlobalSyncTrigger` tests MUST call `set_platform_repo_root()` before testing pull/push operations.

5. **HTTPS remote + SSH insteadOf** — git may have `url.git@github.com:.insteadOf=https://github.com/` forcing SSH. Check and remove if HTTPS auth is needed.

## Project Vault Sync (NEW)

**Beyond syncing the AIEP repo itself, project vaults (`.ai/global/`) are synced to `projects/<name>/` in the AIEP repo.**

```python
# src/aiep/platform_sync.py
class PlatformSyncService:
    VAULT_DIRS = ["rules", "skills", "patterns", "projects"]
    
    def push_local_to_platform(local_global_dir):
        # Copies .ai/global/{rules,skills,patterns,projects}
        # to AIEP_REPO/projects/<name>/
    
    def pull_platform_to_local(local_global_dir):
        # Copies AIEP_REPO/projects/<name>/
        # to .ai/global/{rules,skills,patterns,projects}
    
    def sync_bidirectional(local_global_dir):
        # Compares mtime of each file, syncs both directions
```

### Middleware Hooks

```python
# src/aiep/sync/middleware.py

def _auto_sync_before_command():
    # 1. Pull AIEP repo updates (existing)
    # 2. Pull project vault from AIEP repo (NEW)
    _sync_project_vault_pull()

def _auto_sync_after_command():
    # 1. Push AIEP repo updates (existing)
    # 2. Push project vault to AIEP repo + auto-commit + push (NEW)
    _sync_project_vault_push()
    # Auto-commit: repo.git.add("projects/") → commit → push
```

### AIEP Repo Structure After Sync

```
AI-Engineering-Platform/
├── projects/
│   └── Finanzeasy/
│       ├── shared/          ← GLOBAL shared rules/skills/patterns (from AIEP)
│       │   ├── rules/       ← Team-wide coding standards, git workflow
│       │   ├── skills/      ← Tools discovered across all projects
│       │   └── patterns/    ← Architecture patterns (clean-architecture, tdd)
│       ├── rules/           ← Project-specific rules (override shared)
│       ├── patterns/        ← Project-specific patterns
│       ├── skills/          ← Project-specific skills
│       ├── projects/        ← Project metadata
│       ├── vault.yaml
│       └── index.yaml
├── src/aiep/
└── install.sh
```

### Two-Layer Vault Merge

The vault has TWO layers that merge at read time:

1. **Shared Global** (`.ai/global/shared/`) — from AIEP repo, applies to ALL projects
2. **Project-Specific** (`.ai/global/{rules,skills,patterns}/`) — per-project overrides

**Merge semantics**: `get_rules()` returns shared rules first, then project rules override. Same for skills/patterns. Prefix `shared/` distinguishes shared entries in the merged dict.

### Key Rules

1. **`install.sh` saves `platform_repo_root`** to config.yaml — without this, sync can't find the repo
2. **`ai sync` reads from config** — uses `GlobalSyncTrigger.get_platform_repo_root()`, NOT `Path.cwd()`
3. **Tests must set `platform_repo_root`** — `GlobalSyncTrigger` tests fail without `set_platform_repo_root()`
4. **Auto-commit after push** — `_sync_project_vault_push()` auto-commits and pushes to AIEP repo after each command
5. **Compact context** — when syncing vault files, keep them small (rules: 300 chars max, patterns: 200 chars) to avoid bloating the repo

### User's Mental Model

> "Cuando se instale AIEP global en la máquina, vea desde dónde se está ejecutando el instalador, esa sería la base del repositorio a actualizar. El vault de cada proyecto debe copiarse al repo AIEP, no solo el código de la plataforma."

Translation: The installer remembers WHERE it was run from. That location IS the global repo. Each project's vault (rules, skills, patterns) gets copied to `projects/<name>/` in that repo, so all machines share the same context.
