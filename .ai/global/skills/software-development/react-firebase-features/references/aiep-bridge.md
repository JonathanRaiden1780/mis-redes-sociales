# AIEP Bridge: Hermes ↔ AIEP Integration

**Date:** 2026-08-20
**Context:** We created the `HermesBridge` module in AIEP so that all AI agents share context, rules, and memory.

## Architecture

```
Hermes (89 skills) ──import──→ AIEP Vault (.ai/global/skills/)
                                      ↓
Hermes (memory) ──────sync────→ AIEP Vault (.ai/global/memory/)
                                      ↓
AIEP Rules ←────propagate────→ All IAs (Hermes, Claude, Aider, Codex)
                                      ↓
MASTERPROMPT.md ←──auto-update─── AIEP RuleSyncService
ROADMAP.md ←────────auto-update─── AIEP RuleSyncService
```

## HermesBridge Module (`src/aiep/hermes_bridge/`)

```python
from aiep.hermes_bridge.core import HermesBridge

bridge = HermesBridge(project_root="/path/to/project")

# Import Hermes skills to AIEP
result = bridge.import_skills()  # {"imported": 89, "total": 89}

# Sync Hermes memory to AIEP vault
result = bridge.sync_memory()    # {"synced": True, "entries": 42}

# Export AIEP context for Hermes to consume
result = bridge.export_context() # {"ok": True}
```

## IA Bridge (`src/aiep/ia_bridge.py`)

Detects installed IAs and propagates rules:

```python
from aiep.ia_bridge import IARegistry, RuleSyncService

# Detect installed IAs
registry = IARegistry.detect_installed()
# {"hermes": ..., "claude": ..., "aider": ...}

# Add a new rule and propagate to all IAs
service = RuleSyncService()
result = service.add_rule(
    {"text": "Always update documentation after changes"},
    source="user"
)
# {"rule_id": "...", "propagated_to": ["hermes", "claude", "aider"], "total_ias": 3}
```

## Sync Flow (Auto-sync after every `ai` command)

```python
# 1. Before command: pull updates + export context
_auto_sync_before_command()
  → _sync_vault_pull()
  → _export_context_to_hermes()

# 2. After command: push vault + sync skills + sync rules + update docs
_auto_sync_after_command()
  → _sync_vault_push()
  → _sync_hermes_skills()       # Import Hermes skills
  → _sync_hermes_memory()       # Sync Hermes memory
  → _sync_ia_rules()            # Propagate rules to all IAs
  → _update_documentation()     # Update MASTERPROMPT + ROADMAP
```

## Propagation Targets

| IA | Rule Format | Location |
|----|-------------|----------|
| Hermes | YAML file | `~/.hermes/global_rules.yaml` |
| Claude | Markdown comment | `CLAUDE.md` |
| Codex | Markdown comment | `.codex.md` |
| Aider | Markdown comment | `.aider.md` |
| OpenHands | Markdown comment | `.openhands.md` |

## Key Insight

When a user tells ANY IA: "always do X", that rule must propagate to ALL other IAs. AIEP is the central hub that stores and distributes rules. No IA is an island.

## Pitfall

Don't store secrets in rules. Rules are propagated to all agents and may be committed to git. Use AIEP vault secrets for credentials.
