---
name: aiep-docs
description: "Write platform docs for SDD features."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [documentation, spec, security, aiep, sdd]
---

# AIEP Platform Documentation

Write documentation for AI Engineering Platform following established patterns.

## When to use

- User asks to write/update SPEC, SECURITY, GETTING_STARTED, COMMAND_REFERENCE, USER_GUIDE
- User asks "where is the documentation" or "document this feature"
- A new feature has been implemented and needs formal documentation
- Credentials bundle workflow needs to be documented
- Installer auto-configuration flow is being designed

## Documentation structure

### SPEC-XXX (Technical specification)
Located at: `docs/specs/SPEC-<number>-<name>.md`

Contains:
- **Objetivo** — one sentence
- **Scope** — In scope / Out of scope (checkboxes)
- **Arquitectura** — ASCII diagram showing flow
- **ADR-XXX-NNN** — Architecture Decision Records with rationale
- **Componentes** — numbered list of modules with file paths
- **Mejores Prácticas** — bullet list

### SECURITY.md
Located at: `docs/SECURITY.md`

Contains:
- Tabla de Contenidos
- Introducción (what's protected)
- Each security feature with code examples
- Best practices for individuals/teams/production
- Troubleshooting section with | Problema | Solución | format

### GETTING_STARTED.md
Located at: `docs/GETTING_STARTED.md`

Contains:
- Vista General (what platform does)
- Configuración Inicial del Equipo (4-5 steps)
- Flujo de Trabajo Diario
- Sincronización entre Máquinas (ASCII diagram)
- Seguridad y Credenciales
- Mejores Prácticas (individual/team/production)
- Referencia Rápida (common commands)
- Solución de Problemas table

### COMMAND_REFERENCE.md
Located at: `docs/COMMAND_REFERENCE.md`

Contains sections:
- Comandos de Ejecución
- Comandos de Estado y Diagnóstico
- Comandos de Proyecto
- Comandos de Integraciones (Aider, Codex, OpenHands, OpenRouter, MCP, Obsidian, GraphRAG)
- Comandos de Seguridad (security status/setup-2fa/verify-2fa/disable-2fa)
- Comandos de Sincronización (sync/sync-status/sync-global)
- Comandos de Memoria
- Comandos de Setup
- Variables de Entorno
- Archivos de Configuración

### USER_GUIDE.md
Located at: `docs/USER_GUIDE.md`

Contains:
- Tabla de Contenidos
- Primeros Pasos (Instalación, Configuración, Primera Tarea)
- Comandos Esenciales
- Gestión de Proyectos
- Configuración Global
- Seguridad (new section — encriptación, 2FA, archivos protegidos)
- Próximos Pasos (links to all docs)

## Credentials Bundle Workflow

The AIEP installer supports an encrypted credentials bundle (`bundle.aiep`) that auto-configures API keys, git credentials, and Hermes auth during installation. This is documented in `references/credentials-bundle-workflow.md`.

### Key principles
- Credentials travel encrypted (Fernet + PBKDF2 600k iterations)
- Generation via `scripts/generate_credentials_bundle.py` (interactive or CLI)
- Extraction in `install.sh` via `copy_hermes_config()`
- Git credential helper configured to prevent interactive prompts
- Non-fatal sync: local operations succeed even when remote is unreachable

### Files
| File | Purpose |
|------|---------|
| `scripts/generate_credentials_bundle.py` | Generate encrypted bundle with credentials + config |
| `install.sh` → `copy_hermes_config()` | Extract bundle and configure providers, git, auth |
| `src/aiep/global_sync.py` | Git sync with `GIT_TERMINAL_PROMPT=0` fail-fast |
| `src/aiep/commands/init.py` | Non-fatal sync wrapper pattern |

## Style rules

- All documentation in Spanish (user's language)
- Use ASCII diagrams for architecture (not mermaid)
- Use `code blocks` for all commands
- Tables for troubleshooting and comparisons
- Checkbox format (`- [x]` / `- [ ]`) for scope items
- File paths use `full/path/format`
- **NO `Co-authored-by:` tags in commit messages** — user wants clean attribution

## Documentation quality levels

Generated documentation must pass the "first review for any AI" test. When an external AI (Claude, Trae, etc.) reads MASTERPROMPT.md or ARCHITECTURE.md, it should know:

1. **What the project does** — not just "generic web app" but the actual purpose
2. **Where things are** — key files, entry points, important directories
3. **How to work with it** — build commands, test commands, conventions
4. **What's done vs pending** — real roadmap status, not template checkboxes

### Quality levels

| Level | Description | Example |
|-------|-------------|---------|
| L0 — Template | Empty placeholders, no project data | "Tipo: generic", "Framework: unknown" |
| L1 — Vault-injected | Vault rules/patterns included but still generic | Rules listed but no project-specific context |
| L2 — Project-aware | Reads actual project files (package.json, source code) | Framework detected, dependencies listed, entry points found |
| L3 — Contextualized | Combines vault knowledge + project analysis + LLM-generated descriptions | "Finanzeasy is an Ionic Angular app for personal finance. Entry: src/app/app.component.ts. Uses Firebase for backend." |

**Target: L3.** If generated docs are L0-L2, they fail the user's first review.

### How to reach L3

1. **Read actual project files** — package.json, pyproject.toml, main source files, README
2. **Detect framework accurately** — Angular/Ionic, React/Next, etc. (not "unknown")
3. **Extract purpose** — from README, package.json description, or main source file headers
4. **Generate descriptions** — use LLM to write 2-3 sentences about what the project does
5. **Map structure** — list actual directories and their purposes
6. **Identify entry points** — main.ts, app.component.ts, etc.
7. **Cross-reference with vault** — apply relevant rules/patterns to THIS project

## Command output quality

Commands must produce useful output, not just "run successfully". If a command returns 0, empty, or template output, it's broken from the user's perspective. The user explicitly rejected documentation that looks like templates — if an AI reads the output and thinks "this is generic", it failed.

| Command | Common failure | Fix |
|---------|---------------|-----|
| `ai memory` | "No project memory found" | Loader must read `.ai/memory.yaml` (not just `.md`) |
| `ai skills` | "No skills installed" or crash | Registry must read flat `.yaml` files; default path must exist |
| `ai index` | "Indexed: 0" | Skills must be discoverable; check registry_path |
| `ai context` | Just file counts | Should summarize project purpose, stack, key files |
| `ai graph` | Nodes but 0 edges | Graph builder must create relationships between nodes |
| `ai global memory` | Only bootstrap note | Sync must actually transfer project insights to vault |
| `ai project init` | L0-L2 template docs | Must invoke AI (Ollama) to generate L3 contextualized docs |
| `ai setup` | Skills=0, Providers=0 | Installer must write to registry_path; providers need defaults |
| `ai project init` | L0-L2 template docs | Must invoke AI (Ollama) to generate L3 contextualized docs |
| `ai sync` | Syncs wrong repo | Must read `platform_repo_root` from config, not `Path.cwd()` |
| `ai sync` | Doesn't sync project vault | Must also push `.ai/global/` to `projects/<name>/` in AIEP repo |
| `ai status` | No sync indication | Should show if auto-sync triggered and vault sync status |

### Verifying output quality

After running any `ai` command, inspect the actual output — not just the exit code. Ask: "If an AI read this, would it understand the project?" If the answer is no, the command needs fixing.

**Red flags that output is broken:**
- "unknown" for framework/language when package.json exists
- "generic" for project type when framework is detectable  
- File counts without names (e.g., "Files: 4" without listing them)
- Template text like "Implementación de features core" without specifics
- Exit code 0 but empty stdout

## AI-Powered Documentation Generation

The user expects `ai project init` to produce L3 documentation — real descriptions based on actual project analysis, not templates. This requires invoking AI (via Ollama/Anthropic/OpenAPI) during init.

### Architecture

```
ai project init
  → ProjectAnalyzer (detects framework, language, dependencies)
  → ProjectReader (reads README, package.json, entry points, source samples)
  → AI Generator (Ollama/Anthropic/OpenAPI) generates contextual docs
  → Fallback to templates if AI unavailable
```

### Key implementation

- `src/aiep/context/reader.py` — reads real project files (README, package.json, source samples)
- `src/aiep/context/ai_generator.py` — generates content via Ollama/Anthropic/OpenAPI
- `src/aiep/commands/init.py` — orchestrates: analyze → read → generate → write
- `src/aiep/analyzer.py` — framework detection (Angular/Ionic/Capacitor, React/Next, etc.)

### Single-call pattern

Generate all 5 documents (MASTERPROMPT, ARCHITECTURE, ROADMAP, SPEC-001, ADR-001) in ONE LLM call separated by `---`. Multiple sequential calls are too slow (>180s timeout).

### Fallback chain

1. Try Ollama (check `/api/tags` for available models)
2. Fall back to template generation if AI unavailable
3. Templates must still reach L2 (vault-injected) minimum

### Reference

See `references/init-ai-generation.md` for implementation details.

## Vault Architecture (Two-Layer)

The vault has TWO layers that merge at read time:

1. **Shared Global** (`.ai/global/shared/`) — from AIEP repo, applies to ALL projects
   - `shared/rules/` — team-wide coding standards, git workflow
   - `shared/skills/` — tools discovered across projects
   - `shared/patterns/` — architecture patterns (clean-architecture, tdd)

2. **Project-Specific** (`.ai/global/{rules,skills,patterns}/`) — per-project overrides
   - Same structure but specific to one project
   - Can override shared rules with same name

**Merge semantics**: `get_rules()` returns shared rules first, then project rules override. Same for skills/patterns. Prefix `shared/` distinguishes shared entries.

## MASTERPROMPT for External AIs

The MASTERPROMPT.md is the **primary context document** for external AIs (Claude Code, Trae, Copilot). It must include:

1. Project identity (name, type, language, framework)
2. Dependencies with purposes (not just list)
3. Available commands (scripts from package.json)
4. Entry points and their roles
5. **Global team rules** (from vault shared layer)
6. **Global skills and patterns** (from vault shared layer)
7. Security requirements
8. **Protocol for external AI** — what to do before/during/after work
9. **Next steps** (roadmap with pending/in-progress/done)
10. **Persistent memory** (history of decisions)

**Key instruction for external AIs**: "After each significant change, run `ai sync` to synchronize with the global repo."

## Platform Sync (Project Vault → AIEP Repo)

Auto-sync now syncs TWO things:

1. **AIEP repo itself** (code, docs, config) — via `GlobalSyncTrigger`
2. **Project vault** (rules, skills, patterns) — via `_sync_project_vault_push/pull()`

Vault sync flow:
- Before command: pull `projects/<name>/` from AIEP repo → `.ai/global/` local
- After command: push `.ai/global/` local → `projects/<name>/` in AIEP repo + commit + push

Structure in AIEP repo:
```
projects/<project_name>/
    shared/          ← Global shared rules/skills/patterns
    rules/           ← Project-specific rules
    skills/          ← Project-specific skills
    patterns/        ← Project-specific patterns
    projects/        ← Project metadata
    vault.yaml
    index.yaml
```

## Install.sh Update Mode

When AIEP is already installed, `install.sh` should **update** not reinstall:

```bash
if is_aiep_installed && [ -f "${CONFIG_DIR}/providers.yaml" ]; then
    # Pull latest code
    git pull --rebase
    # Rebuild venv (not delete config)
    rm -rf "${VENV_DIR}"
    uv venv "${VENV_DIR}" --python 3.12 --clear
    pip install -e "${repo_root}"
    # Ensure platform_repo_root is set
    # Exit successfully
fi
```

**Critical**: Don't ask for bundle passphrase if config already exists. Don't overwrite existing credentials.

## Crontab Edge Case

When scheduling cron jobs, handle empty crontab:
```bash
existing=$(crontab -l 2>/dev/null) || existing=""
echo "${existing}" | grep -v "ai project sync" | sort -u | { cat; echo "${cron_entry}"; } | crontab -
```

Direct `crontab -l | grep ... | crontab -` fails with "bad minute" when crontab is empty.

## Git Remote URL Debugging

If push fails with "Permission denied (publickey)" on HTTPS URL:
1. Check global config: `git config --global --list | grep url`
2. Look for: `url.git@github.com:.insteadof=https://github.com/`
3. This forces SSH even on HTTPS remotes
4. Fix: `git config --global --unset url.git@github.com:.insteadOf`

## Pitfalls

### Language & Format
- Writing docs in English when user communicates in Spanish
- Using mermaid diagrams when ASCII is the established pattern
- Creating new doc formats instead of established patterns
- **Don't add `Co-authored-by:` to commit messages** — user wants clean attribution, no AI co-author tags

### Documentation Quality
- Forgetting to update the USER_GUIDE.md "Próximos Pasos" section when adding new docs
- Missing troubleshooting section in SECURITY.md
- Generated docs that are L0-L2 templates instead of L3 contextualized content
- **Don't report "working" when output is empty/template** — verify the output is actually useful (L3 standard)

### Sync & Git
- Don't write skills to `.ai/global/skills/` — use `registry_path` from config
- Don't let git hang on credential prompts — set `GIT_TERMINAL_PROMPT=0` in sync operations
- **Don't assume HTTPS remote means HTTPS auth** — check `url.git@github.com:.insteadOf` in global git config (forces SSH even on HTTPS remotes)
- **Don't sync `~/.ai/global/`** — auto-sync must target the AIEP repo where install.sh was executed (stored as `platform_repo_root` in config.yaml)
- **Don't let `ai sync` use `Path.cwd()`** — it must read `platform_repo_root` from config via `GlobalSyncTrigger.get_platform_repo_root()`
- **Don't forget to save `platform_repo_root` during install** — `install.sh` must write the repo root to config.yaml so auto-sync knows what to sync
- **Don't forget project vault sync** — `ai sync` must also sync `.ai/global/` content to `projects/<name>/` in AIEP repo (rules, skills, patterns, projects)
- **Don't let vault sync be silent** — `_sync_project_vault_push()` must auto-commit and push to AIEP repo after each command
- **Don't use `Path.cwd()` for vault sync** — middleware must read `platform_repo_root` from config, not assume current directory

### AI Generation
- **Don't use qwen3.6 36B for doc generation** — too large, causes connection closure; prefer qwen2.5-coder:1.5b > llama3.2 > gemma4
- **Don't make 5 sequential LLM calls** — too slow (>180s timeout); use single-call pattern with `---` separator
- **Don't wrap AI output in ```markdown** — instruct the model to output raw markdown, and strip wrappers in code
- **Don't use daemon threads for background AI** — they die when parent exits; use subprocess.Popen with start_new_session=True or just wait with timeout
- **Don't send full source code to LLM** — context must be compact (README: 1000 chars, 2 entry points x 500 chars, 2 samples x 300 chars) to avoid timeouts

### Memory & Config
- Don't assume memory is only in `.md` — `ai project init` writes `.yaml`, loader must handle both
- **Don't let `ai skills` crash on missing directory** — `registry_path` may not exist yet; create it
- **Don't assume framework detection is accurate** — verify against package.json dependencies (Angular/Ionic/Capacitor need explicit detection)
- **Don't pipe input to `getpass`-based scripts** — use CLI flags instead (EOFError trap when stdin is redirected)
- **Don't let tests fail due to missing `platform_repo_root`** — tests for GlobalSyncTrigger must call `set_platform_repo_root()` before testing pull/push
- **Don't let vault sync fail silently** — wrap in try/except but log warnings for debugging

### Install.sh
- **Don't ask for bundle passphrase if config exists** — skip `copy_hermes_config()` entirely if `config.yaml` exists
- **Don't use `uv venv` without `--clear`** — fails if venv already exists; use `uv venv ... --clear 2>/dev/null || uv venv ...`
- **Don't use bare `crontab -l | ...`** — fails with "bad minute" on empty crontab; capture with `|| existing=""` first

## References

- `references/documentation-patterns.md` — SPEC-053 session reference (architecture decisions, auto-sync flow, security features)
- `references/credentials-bundle-workflow.md` — Credentials bundle generation & extraction patterns
- `references/init-ai-generation.md` — AI-powered project initialization (single-call pattern, fallback chain, L3 quality target)
- `references/command-output-quality-framework.md` — Command output quality standards
- `references/auto-sync-architecture.md` — Auto-sync design (repo-based global store, platform_repo_root, cross-machine continuity)