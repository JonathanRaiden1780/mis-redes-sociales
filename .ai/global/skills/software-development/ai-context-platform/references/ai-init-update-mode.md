# `ai init` Update Mode

When `ai init` is run on an **already-initialized** project (MASTERPROMPT.md exists):

| Flag | Behavior |
|------|----------|
| No `--force` | **Updates** MASTERPROMPT with latest vault context (regenerates with shared rules/skills/patterns from AIEP repo) |
| `--force` | **Regenerates** all documents from scratch |

## When to Use Update Mode

- New global rules/skills/patterns were added to the AIEP repo vault
- You want to refresh MASTERPROMPT with the latest shared context
- AI-generated content needs refresh (tries Ollama enhancement again)
- After `ai sync` brings new global context from other projects/machines

## Implementation Details

The update flow:
1. Detects MASTERPROMPT.md exists and `--force` is not set
2. Re-analyzes the project (language, framework, dependencies, structure)
3. Regenerates MASTERPROMPT.md using `ContextProvider.generate_masterprompt()` with full vault context
4. Attempts AI enhancement via Ollama (qwen2.5-coder:1.5b preferred)
5. Ensures vault has latest shared content from AIEP repo
6. Returns status "updated" with ai_enhanced flag

## Key Difference from Full Init

- Does NOT regenerate ARCHITECTURE.md, ROADMAP.md, SPEC-001, ADR-001
- Does NOT recreate .ai/ directory structure (preserves existing memory/state)
- Does NOT re-register project in vault (already registered)
- Only updates MASTERPROMPT.md with latest context

## User Experience

```
$ ai init
✔ Finanzeasy MASTERPROMPT updated with latest vault context.
  (MASTERPROMPT enhanced with AI)

Next steps:
  - Read MASTERPROMPT.md
  - Ask Claude/Trae to read MASTERPROMPT.md
  - Run 'ai sync' when you discover new skills/tools
```
