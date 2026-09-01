# Auto-Sync Architecture — Platform Repo as Global Brain

## Session Date
2026-08-18

## Problem
The original auto-sync design synced `~/.ai/global/` within each project's git repo. But the user wants the **AIEP platform repo** (where install.sh is run from) to be the global brain, syncing context from ALL projects.

## Solution

### Architecture

```
~/.config/aiep/config.yaml          ← stores platform_repo_root
/home/jonathanh/Projects/AI-Engineering-Platform/   ← AIEP repo (the global brain)
├── projects/
│   └── Finanzeasy/                 ← context from Finanzeasy project
│       ├── rules/                  ← coding-standards.md, git-workflow.md
│       ├── patterns/              ← clean-architecture.yaml, tdd.yaml
│       ├── skills/                ← (vacío por ahora)
│       ├── projects/              ← Finanzeasy.yaml
│       ├── vault.yaml
│       └── index.yaml
└── src/                           ← AIEP platform code
```

### Sync Flow

1. **Before each `ai` command**: `_sync_project_vault_pull()` — pulls `projects/<name>/` from AIEP repo → `.ai/global/` local
2. **After each `ai` command**: `_sync_project_vault_push()` — pushes `.ai/global/` local → `projects/<name>/` in AIEP repo + auto-commit + push
3. **Config**: `platform_repo_root` in `config.yaml` tells the sync where the AIEP repo is

### Key Files

| File | Purpose |
|---|---|
| `src/aiep/platform_sync.py` | PlatformSyncService — push/pull/sync_bidirectional |
| `src/aiep/sync/middleware.py` | Hooks into Typer's `call_on_close()` for auto-sync |
| `src/aiep/sync/trigger.py` | GlobalSyncTrigger — reads `platform_repo_root` from config |
| `install.sh` | Saves `platform_repo_root` to config during install |

### install.sh Changes

During install, save the repo root:
```bash
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# ... save to config.yaml via python
```

### Idempotent Update (not reinstall)

When install.sh is run and AIEP is already installed:
1. Pull latest AIEP code (`git pull --rebase`)
2. Rebuild venv (`rm -rf` + `uv venv --clear`)
3. Reinstall (`pip install -e .`)
4. Update shell integration
5. Ensure `platform_repo_root` is set
6. Skip bundle extraction (config already exists)
7. Exit — don't ask for credentials again

## Pitfalls Discovered

### 1. uv venv "already exists" error
```bash
uv venv --python 3.12 --clear 2>/dev/null || uv venv --python 3.12
```

### 2. install.sh asks for passphrase when already configured
Fix: if `config.yaml` exists, skip bundle extraction entirely.

### 3. Large model timeout
qwen3.6 36B causes connection resets. Prefer:
1. `qwen2.5-coder:1.5b` (fastest)
2. `llama3.2:latest`
3. `gemma4:12b`
Avoid: `qwen3.6:latest` (too large for some setups)

### 4. Thread-based background AI fails
Daemon threads die when main process exits. Use `subprocess.Popen(start_new_session=True)` for true background.

### 5. Git HTTPS vs SSH
Global config `url.git@github.com:.insteadof=https://github.com/` forces SSH even on HTTPS remotes. Unset it for HTTPS pushes.

## User Workflow

```bash
# Install AIEP (first time)
cd ~/Projects/AI-Engineering-Platform
bash install.sh

# Update AIEP (subsequent runs)
bash install.sh  # automatically detects and updates

# Work on a project
cd ~/proyectos/Finanzeasy
ai project init --force    # generates docs with Ollama
ai status                  # auto-sync triggers: pull from AIEP, execute, push to AIEP

# Context is now in AIEP repo under projects/Finanzeasy/
# Other machines pull AIEP repo → get all project contexts
```
