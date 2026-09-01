---
name: test-drift-resolution
description: "Resolve test failures from test-implementation mismatch."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [testing, debugging, test-failures, pytest, refactoring]
    related_skills: [systematic-debugging, test-driven-development]
---

# Test Drift Resolution

## Overview

**Test drift** happens when implementation changes outpace test updates: tests fail because they assume an API, behavior, or file layout the implementation no longer provides.

**Core principle:** Read the implementation first to learn the real contract, then align tests — not the reverse.

## When to Use

- Tests fail with mismatch errors (wrong args, wrong paths, wrong assertions), not genuine bugs
- Function signatures, file layouts, or helper names changed and tests reference the old shape
- Tests pass/fail inconsistently and the common factor is test assumptions vs implementation reality

## Phase 1: Map the Real Contract

Before changing any test, read the implementation to answer:

1. **Function signatures** — what arguments do they accept?
2. **Return types** — what do they return?
3. **File layout** — where does the implementation write files?
4. **Helper names** — what are the actual exported helper names?
5. **Side effects** — does implementation require config, monkeypatching, or env setup?

Read implementation end-to-end. Don't skim — drift is usually in details.

## Phase 2: Categorize Each Failure

| Category | Meaning | Fix location |
|----------|---------|--------------|
| Signature mismatch | Wrong args/kwargs | Fix test call site |
| Path/location mismatch | Test expects path A, impl writes to path B | Fix test path |
| Helper name mismatch | Test imports `_old`, impl has `_new` | Fix test import |
| Setup mismatch | Test monkeypatch/env doesn't work | Fix test setup |
| Assertion mismatch | Test asserts X, impl produces Y (both valid) | Fix test assertion |
| Real bug | Impl doesn't do what spec says | Fix implementation |

## Phase 3: Fix in Dependency Order

1. Fix implementation bugs first (real bugs)
2. Fix helper renames/imports
3. Fix signature mismatches
4. Fix path/location assertions
5. Fix setup/monkeypatch
6. Fix assertion mismatches (last)

Fixing helpers/signature first makes other failures visible with correct context.

## Phase 4: Verify Isolated

After each category: run only affected test class, then full suite. Do NOT batch all fixes and run once.

## Phase 5: Confirm Alignment

Re-read implementation after fixes to confirm tests now match the real contract.

## Common Pitfalls

- Patching tests to match wrong assumptions → passing tests that don't test reality
- Monkeypatching the wrong module (patching commands when helper lives in sync module)
- Using old API in test setup (calling `service.sync(project, dry_run=True)` after signature change)
- Assuming slug/format behavior — verify with a quick script before patching tests
- Patching a function imported **inside a function body** — `patch("module.func")` fails with `AttributeError: module has no attribute 'func'` because the import happens at call-time, not module-load. **Fix**: move the import to module level so patching can intercept the attribute, then test.
- Patching the **wrong module after a command redesign** — when a CLI command file (`commands/foo.py`) is refactored to swap its internal imports (e.g. `GlobalProjectSyncService` → `ContextProvider` + `GlobalVault` + `GlobalSyncService`), tests that monkeypatch the *service's* module (`project.sync_global.GlobalMemoryStore`) are silently dead: the command no longer references those symbols. **Fix**: patch every symbol the command imports **in the command's own namespace** (`commands/foo.py.ContextProvider`, etc.), and verify the command's `run()` body references the same names; a quick `grep -n "monkeypatch.setattr"` audit vs the real imports catches this. See `references/command-redesign-test-drift.md`.
- **Git credential prompt blocking** — a CLI command that calls `sync.sync()` (which does `git push`/`pull`) can hang indefinitely if git falls back to interactive username/password prompting. GitHub no longer accepts passwords, so even entering credentials fails. See `references/git-credential-prompt-blocking.md`.
- **Promise vs Observable mismatch in Angular tests** — Angular services returning `Observable` use `of()` in mocks; services returning `Promise` use `Promise.resolve()`. Mixing them causes type errors. Check the service's return type before writing mocks.
- **jest@30 + jest-expo@57 incompatibility** — In React Native projects using jest-expo, jest@30 removed `_moduleMocker.clearMocksOnScope` causing `TypeError: this._moduleMocker.clearMocksOnScope is not a function`. Pin jest@29 + jest-expo@54. See `references/react-native-jest-supabase-testing.md`.
