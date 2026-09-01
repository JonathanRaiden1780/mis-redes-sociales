# Command Redesign Test Drift — Case Study

## Symptom
A CLI integration test hangs or silently passes nothing after a command file was refactored.

In this repo, `src/aiep/commands/sync_global.py` was rewritten in commit
`7076e97` (SPEC-053 "cerebro global para IAs externas"):
- **Before**: `run()` used `GlobalProjectSyncService` (writes `NoteRecord`s to
  `GlobalMemoryStore`).
- **After**: `run()` uses `ContextProvider` + `GlobalVault` +
  `GlobalSyncService` (writes skills to `.ai/global/skills/`, commits via git).

## Root Cause
The test `test_cli_sync_global_runs_on_project_with_memory` (in
`tests/unit/test_sync_global.py`) was never updated. It did:
```python
monkeypatch.setattr("aiep.project.sync_global.GlobalMemoryStore", fake_store)
```
but the redesigned command **no longer imports or references
`aiep.project.sync_global` at all** — it imports from
`aiep.context.provider`, `aiep.vault`, and `aiep.global_sync`. The monkeypatch
was a no-op. Additionally:
1. The command guards on `MASTERPROMPT.md` existence — the test never created one.
2. `load_global_context()` returns `{"exists": False}` when `.ai/global/` is missing — the test never created it.
3. The command writes skills to the vault, not notes to `GlobalMemoryStore` — the test asserted the wrong thing.

## Fix
Rewrite the test to:
1. Patch symbols in the **command's namespace** (`aiep.commands.sync_global.*`),
   not the helper module's namespace.
2. Create all guard preconditions (`MASTERPROMPT.md`, `.ai/global/`, `.ai/memory.yaml`
   with `entries`).
3. Assert the redesigned behavior (skills added to `GlobalVault`, not notes in
   `GlobalMemoryStore`).

## How to Audit for This
After any command-file redesign, run:
```bash
grep -n "monkeypatch.setattr" tests/unit/test_*.py
```
and confirm every patched symbol is actually imported **and used** in the
command file the test invokes. A patch that touches a symbol the command no
longer references is dead weight — the test will pass for the wrong reason.

## Quick Checklist
- [ ] Identify every import the command file uses (`grep -n "^from\|^import"`
      `src/aiep/commands/<cmd>.py`).
- [ ] For each test monkeypatch, confirm the target string matches an import
      in the **command's** namespace, not a helper module's.
- [ ] Ensure guard clauses in the command have their preconditions set up
      (files, env vars, cwd).
- [ ] Assert the post-refactor behavior, not the pre-refactor contract.