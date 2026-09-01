# Git Credential Prompt Blocking — Case Study

## Symptom
A CLI command (`ai init`, `ai project init`, `ai sync`) hangs or fails interactively with:
```
Username for 'https://github.com':
Password for 'https://...@github.com':
```
even though the user has git configured. The command never completes — it loops
on credential prompts.

## Root Cause
The command calls `GlobalSyncService.sync()` which does `git push`/`pull`. Git
tries to authenticate against the remote, finds no credential helper and no SSH
key, and falls back to interactive username/password prompting. Since the call
is non-interactive (test environment, background execution), the process hangs
indefinitely.

GitHub **does not accept passwords** anymore — only Personal Access Tokens or
SSH keys — so even entering credentials fails.

## Where It Manifested
`src/aiep/commands/init.py` line ~128:
```python
sync.sync(message=f"Initialize project: {name}")
```
This ran at the end of every `ai init`, so **no project could be initialized**
without a working git credential setup.

## Fix (two layers)

### Layer 1: Fail fast in the sync service
In `src/aiep/global_sync.py`, `_get_repo()` now sets `GIT_TERMINAL_PROMPT=0`
on the repo's git environment:
```python
def _get_repo(self) -> Repo:
    try:
        repo = Repo(self.root)
        repo.git.update_environment(GIT_TERMINAL_PROMPT="0")
        return repo
    except InvalidGitRepositoryError as exc:
        raise ValueError(f"Not a git repository: {self.root}") from exc
```
This makes git raise `GitCommandError` immediately instead of prompting.

### Layer 2: Make sync non-fatal in commands
In `src/aiep/commands/init.py`, the sync call is wrapped in try/except:
```python
sync_warning = None
try:
    sync.sync(message=f"Initialize project: {name}")
except Exception as e:
    sync_warning = (
        f"Local init complete, but sync to remote failed: {e}. "
        f"Run 'ai sync' later to push."
    )
```
The command completes locally, stores a warning in the result dict, and the
CLI layer displays it. The user can configure credentials and re-run `ai sync`
later.

The CLI command (`commands/init_cmd.py`) checks for `result.get("sync_warning")`
and prints it in yellow.

## How to Audit for This
Any CLI command that calls `sync.sync()` or `git push`/`pull` directly should:

1. **Set `GIT_TERMINAL_PROMPT=0`** in the git environment before any push/pull.
2. **Wrap git operations in try/except** — git failures should be warnings,
   not crashes, for commands that also do local work (init, project setup).
3. **Never block on credentials** — the command should complete locally and let
   the user configure auth separately.

Run this audit:
```bash
grep -rn "sync.sync\|git.push\|git.pull" src/aiep/commands/
```
For each hit, verify it's wrapped in try/except and that `_get_repo()` sets
`GIT_TERMINAL_PROMPT=0`.

## Quick Checklist for Git-Using Commands
- [ ] `_get_repo()` sets `GIT_TERMINAL_PROMPT=0` on the git environment.
- [ ] Every call to `sync.sync()` is wrapped in try/except (non-fatal).
- [ ] The result dict carries a `sync_warning` string when sync fails.
- [ ] The CLI layer prints the warning and continues.
- [ ] Local work (file creation, config writes) completes before sync is
      attempted.
