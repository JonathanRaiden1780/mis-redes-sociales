# Detecting Pre-Existing Test Failures

When modifying a codebase, a test may fail that *looks* unrelated
to your change. Before assuming it is pre-existing (and leaving it
alone), **prove** it with git stash. This is a fast, deterministic
preflight that prevents you from mis-classifying a regression as
noise.

## Workflow

```bash
# 1. Stash only the files you changed (keep untracked files if needed)
git stash push -- <file1> <file2>

# 2. Run the failing test on the clean tree
pytest tests/path/test_name.py -x -q

# 3. Restore your changes
git stash pop
```

## Interpretation

| Clean tree result | With your changes | Diagnosis |
|---|---|---|
| PASS | FAIL | Your change broke it — investigate |
| FAIL (same assertion) | FAIL (same assertion) | Pre-existing — leave alone, file a separate ticket |
| FAIL (different error) | FAIL | Pre-existing root cause, different symptom — still pre-existing but investigate interaction |
| PASS | PASS | Not actually related — was a flaky or env issue |

## Why not trust `--tb=short`?

A test that uses shared fixtures, global env vars, or import-time side
effects can fail because of state your change leaked, even if the
assertion text looks identical. Stashing isolates your diff entirely.

## Related pitfall

See `test-drift-resolution/SKILL.md` → Common Pitfalls →
"Declaring a test pre-existing failure without proof".
