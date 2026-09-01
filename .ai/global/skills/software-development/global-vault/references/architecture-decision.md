# Architecture Decision — AIEP Repo as Sync Target

## Problem
How to share AI context (rules, skills, patterns) across multiple machines and AI agents (Claude, Trae) without requiring external configuration or services?

## The AIEP Repo IS the Global Sync Target

**Critical insight**: The AIEP repository itself is the "global brain". When `install.sh` is executed from `/home/jonathanh/Projects/AI-Engineering-Platform`, that path is stored in `~/.config/aiep/config.yaml` as `platform_repo_root`. All sync operations target this repo.

## Sync Architecture

```
AIEP Repo (platform_repo_root = /home/jonathanh/Projects/AI-Engineering-Platform)
├── projects/
│   ├── Finanzeasy/
│   │   ├── rules/           ← Synced from Finanzeasy/.ai/global/rules/
│   │   ├── patterns/        ← Synced from Finanzeasy/.ai/global/patterns/
│   │   ├── skills/          ← Synced from Finanzeasy/.ai/global/skills/
│   │   ├── projects/        ← Project metadata
│   │   ├── vault.yaml       ← Vault state
│   │   └── index.yaml       ← Search index
│   └── OtherProject/
│       └── ...
├── src/                     ← AIEP platform code
└── install.sh
```

## Sync Flow per `ai` Command

1. **Before command** (`_sync_project_vault_pull`): Copies `projects/<name>/` from AIEP repo → local `.ai/global/`
2. **Command executes**: Normal operation (reads local `.ai/global/` for context)
3. **After command** (`_sync_project_vault_push`): Copies local `.ai/global/` → `projects/<name>/` in AIEP repo + auto-commit + push

## Cross-Machine Continuity

1. Machine A: User works on Finanzeasy → rules/patterns discovered → synced to AIEP repo
2. Machine B: User runs any `ai` command → `_sync_project_vault_pull()` → Finanzeasy context is now available locally
3. Machine B can now use Finanzeasy rules/patterns even if it never worked on Finanzeasy before

## Platform Role

> "Las IA externas ocuparán la base que se genero como plantilla en el repo... esta ia adopta global, rellena plantillas... realiza las actividades"

- **Platform (Hermes)**: Prepares context (generates MASTERPROMPT.md, updates vault, syncs to AIEP repo)
- **External AIs (Claude Code, Trae)**: Execute actual tasks using MASTERPROMPT as guide
- **`ai` commands**: Secondary orchestration, not the primary workflow

## Key Decisions

1. **Vault lives in AIEP repo**, not as external service — push/pull propagates it
2. **Per-project isolation** — each project gets its own `projects/<name>/` directory
3. **Bidirectional sync** — before command pulls, after command pushes
4. **Auto-commit + push** — no manual git commands needed
5. **`GIT_TERMINAL_PROMPT=0`** — fail fast instead of hanging on credential prompts

## Security Decisions
- Fernet + PBKDF2 (600k iterations) for credentials
- TOTP 2FA with ±30s clock skew
- `fcntl.flock(LOCK_EX)` for read-modify-write
- `chmod 0o600` on all state writes
- `yaml.safe_load()` only
- URLs validated against git remote helper injection
- `curl | bash` replaced with checksum verification