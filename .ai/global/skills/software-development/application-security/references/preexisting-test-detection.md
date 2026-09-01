# Pre-existing Test Failure Detection

## Technique: git stash verification

When a test fails after your changes, determine whether YOUR changes caused it or whether it was already broken. This prevents chasing phantom regressions and is critical before declaring "tests pass" as the QA gate.

## Recipe

```bash
# 1. Stash your uncommitted changes
git stash

# 2. Run the specific failing test on the clean tree
python -m pytest tests/unit/test_module.py::TestClass::test_method -x -q

# 3. If it STILL fails → pre-existing (not your fault)
# 4. If it PASSES → your changes caused the regression

# 5. Restore your changes
git stash pop
```

## Common Pitfalls

- `git stash` does not stash untracked files by default. If your test depends on untracked files (e.g., a new fixture or config), use `git stash -u` to include untracked files — but be aware this also stashes editor temp files and `.pyc` files.
- If `git stash pop` fails to cleanly restore (merge conflicts in your work files), resolve them manually. The stash is your only backup of uncommitted work — never `git stash drop` until your work is safely back in the tree.
- When running tests on the clean tree, ensure the virtualenv and dependencies are still activated — `git stash` does not affect environment state.

## Security relevance

When running security scans or security tests, use this technique to confirm a new finding is caused by your change, not pre-existing. This avoids both false alarms (chasing ghosts) and false confidence (ignoring real regressions you introduced).
