# AIEP Vision Gap Analysis — August 2026

**Source:** Session where user clarified the true vision for AI Engineering Platform.

## User's Vision (in own words)

> *"el objetivo de la plataforma es que se instale en cualquier SISTEMA operativo, instale las dependencias que necesita, directorios, skills, mcps, herramientas, etc, se autosincroniza cada que obtiene memoria global cuando es activada con los comandos 'ai', por lo que requiere instalarse memoria, compresión, flujo de git, en proyectos nuevos y viejos ayuda a generar el masterprompt, documentación, memoria, etc que ayuda a gestionar a cualquier IA entender el contexto, que es el proyecto, que tareas haver al inicio, las reglas, el como debe comportarse, skills, mcp, herramientas disponibles, si existen nuevas se avisaría a global para que las registre con los comandos y esta se auto sincronice en cada equipo de esta manera en cualquier computadora o sistema que instale estaria con lo ultimo actualizado de base de memoria, patrones, aprendizaje etc"*

## Three-Layer Reality Check

### ✅ Implemented (verified in code)
- Cross-platform install.sh with detect_platform()
- GlobalBootstrap: skills, MCP, security, providers
- ai enter: detects greenfield/legacy, creates .ai/
- ai bootstrap-project: generates MASTERPROMPT.md + ROADMAP.md + SDD scaffold
- ai sync-global: captures project insights → global memory
- ai global export/import: portable .aibundle with SHA256 integrity
- ai compress: LRU + dedup memory compression
- ai sync: GitSyncService for platform repo itself
- ai index: registers tools/skills in global-index.yaml

### ⚠️ Roadmap claims vs reality
- install.sh `prompt_credentials()` prints "✓ configured" but never writes API keys to providers.yaml
- ai sync only works for the platform repo itself (validates pyproject.toml + src/aiep), not arbitrary repos

### ❌ Vision gaps (NOT implemented anywhere)
1. **Auto-sync on `ai` activation** — no trigger syncs global memory when any `ai` command runs
2. **Auto-pull global updates** — no mechanism pulls new memory/skills/MCPs from central registry
3. **Central notification for new tools** — ai index only writes locally; no broadcast to other machines
4. **Real distribution layer** — no central server, webhook, pull-cron, or broadcast mechanism
5. **Actual credential persistence** — install.sh prompts but discards keys

## Key Insight

The platform is **locally complete** but **globally disconnected**. Every machine has its own silo. The vision requires a distribution layer that does not exist yet.

## Recommended Next Step

Design and specify the auto-sync/distribution layer (SPEC-053 or similar). Key requirements:
- Trigger on any `ai` command activation
- Pull latest global memory before local execution
- Push local insights after execution
- Register new tools centrally with notification to other machines
- Handle credentials properly in installer
