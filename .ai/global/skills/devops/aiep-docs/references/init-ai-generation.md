# AI-Powered Project Initialization

## Overview

`ai project init` uses AI (Ollama/Anthropic/OpenAPI) to generate L3 contextualized documentation based on real project analysis.

## Architecture

```
ai project init
  → ProjectAnalyzer.analyze()  → framework, language, deps, entry points
  → ProjectReader.get_context_summary()  → README, package.json, source samples
  → _try_ai_generation()  → single LLM call generates masterprompt + docs
  → Fallback to templates if AI unavailable
```

## Single-Call Pattern (CRITICAL)

Generate all 5 documents in ONE LLM call separated by `---`:

```
Generate all 5 documents below, separated by --- on its own line:

# 1. MASTERPROMPT.md
...

---

# 2. ARCHITECTURE.md
...

---

# 3. ROADMAP.md
...

---

# 4. SPEC-001-initial-setup.md
...

---

# 5. ADR-001-tech-stack.md
...
```

**Multiple sequential calls cause >180s timeout.** Avoid.

## Model Selection

**Prefer smaller, faster models** for documentation generation:

```python
preferred_models = [
    "qwen2.5-coder:1.5b",   # Best balance of speed + quality
    "llama3.2:latest",       # Good alternative
    "gemma4:12b",            # Capable but slower
]
# AVOID: qwen3.6:latest (36B params — causes connection closure)
```

Check available models via `http://localhost:11537/api/tags` and pick the first match from the preference list.

**Why not qwen3.6?** 36B parameters causes "Remote end closed connection without response" on many setups. Stick to <13B models.

## AI Output Cleaning

LLM output is often wrapped in code blocks. Always clean:

```python
content = content.strip()
if content.startswith("```markdown"):
    content = content[len("```markdown"):].strip()
elif content.startswith("```"):
    content = content[3:].strip()
if content.endswith("```"):
    content = content[:-3].strip()
```

Also instruct the model explicitly: *"Output ONLY raw markdown. Do NOT wrap in ```markdown ... ``` code blocks. Start directly with # heading."*

## Fallback Chain

1. **Ollama** — check `http://localhost:11537/api/tags` for available models
2. **Template fallback** — if AI unavailable, use DocumentationGenerator (L2 minimum)
3. **Vault injection** — even templates include rules/patterns from global vault

## Implementation Files

| File | Purpose |
|------|---------|
| `src/aiep/context/reader.py` | Reads real project files (README, package.json, source samples) |
| `src/aiep/context/ai_generator.py` | Generates content via Ollama/Anthropic/OpenAPI |
| `src/aiep/commands/init.py` | Orchestrates: analyze → read → generate → write |
| `src/aiep/analyzer.py` | Framework detection (Angular/Ionic/Capacitor, React/Next, etc.) |

## Output Quality Target: L3

Documentation must pass the "first review for any AI" test. An external AI reading MASTERPROMPT.md should know:

1. **What the project does** — actual purpose, not "generic web app"
2. **Where things are** — key files, entry points, important directories
3. **How to work with it** — build commands, test commands, conventions
4. **What's done vs pending** — real roadmap status, not template checkboxes

## Red Flags (output is broken)

- "unknown" for framework/language when package.json exists
- "generic" for project type when framework is detectable
- File counts without names (e.g., "Files: 4" without listing them)
- Template text like "Implementación de features core" without specifics
- Exit code 0 but empty stdout

## Lessons Learned

1. **Don't use daemon threads for background AI** — `threading.Thread(daemon=True)` dies when parent process exits. Use `subprocess.Popen(start_new_session=True)` instead, or just wait with a timeout.

2. **Don't pipe stdin to scripts that use getpass** — `getpass.getpass()` raises EOFError when stdin is redirected. Use CLI flags (`--passphrase`, `--openai-key`, etc.) for automation.

3. **HTTPS remote URL ≠ HTTPS auth** — git config may have `url.git@github.com:.insteadOf=https://github.com/` which forces SSH even on HTTPS remotes. Check and unset if needed.

4. **Model size matters for stability** — qwen3.6 36B causes "Remote end closed connection without response". Stick to <13B models for doc generation.

5. **Skills must be written to `registry_path`** — not `.ai/global/skills/`. The `SkillInstaller` must read `config.yaml → skills → registry_path` and write there.

6. **Memory loader must handle both `.md` and `.yaml`** — `ai project init` writes `.ai/memory.yaml`, but the old loader only checked `.ai/memory.md`.

7. **Don't use qwen3.6 for doc generation** — too large (36B), causes connection closure. Prefer qwen2.5-coder:1.5b > llama3.2 > gemma4.

8. **Single-call pattern is essential** — 5 sequential LLM calls exceed 180s timeout. Use `---` separator in one prompt.

9. **Clean AI output of markdown wrappers** — LLMs love wrapping in ```markdown. Strip in code AND instruct model to avoid.

10. **Analyzer must detect Angular/Ionic explicitly** — checking only for `@angular/core` isn't enough; need to check for `@ionic/angular` and `@capacitor/core` too.

11. **Context must be compact** — sending full source code to LLM causes timeouts. Limit context: README (1000 chars), 2 entry points (500 chars each), 2 source samples (300 chars each), 20 deps max.

12. **Auto-sync targets the AIEP repo, not ~/.ai/global/** — `GlobalSyncTrigger` reads `platform_repo_root` from config.yaml (saved by install.sh). `ai sync` must NOT use `Path.cwd()`.

13. **Tests must set platform_repo_root** — `GlobalSyncTrigger` tests fail without `set_platform_repo_root()` because pull/push return False when no repo is configured.

14. **Project vault sync is separate from repo sync** — `PlatformSyncService` syncs `.ai/global/` to `projects/<name>/` in AIEP repo. This is triggered by `_sync_project_vault_push/pull()` in middleware.

15. **Auto-commit after vault push** — `_sync_project_vault_push()` must auto-commit and push to AIEP repo: `repo.git.add("projects/") → commit → push`. This ensures vault changes are persisted.

16. **Bidirectional sync compares mtimes** — `sync_bidirectional()` compares `stat().st_mtime` of each file to determine which version is newer, then syncs accordingly.
