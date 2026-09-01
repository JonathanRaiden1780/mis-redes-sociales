# Command Output Quality Framework

## Philosophy

A command that exits 0 but produces empty or template output is BROKEN from the user's perspective. The user doesn't care about exit codes — they care about usefulness.

## The "First Review" Test

When a user runs a command, imagine an external AI (Claude, Trae) reading the output. Would it understand the project? Can it act on the information? If not, the command failed.

## Quality Levels

| Level | Description | User Reaction |
|-------|-------------|---------------|
| Q0 — Crash | Exception, traceback | "It's broken" |
| Q1 — Empty | 0 output, just exit code | "Nothing happened" |
| Q2 — Template | Generic placeholders, no project data | "This is useless" |
| Q3 — Project-aware | Reads actual project files, shows real data | "OK, now I know the project" |
| Q4 — Actionable | Q3 + next steps, recommendations, cross-references | "This is really useful" |

**Target: Q4.** Anything below Q3 should be considered a bug.

## Command-by-Command Quality Checklist

### `ai memory`
- [ ] Shows project purpose/type/language/framework
- [ ] Lists key dependencies
- [ ] Shows entry points
- [ ] Cross-references with vault rules/patterns
- [ ] Not just raw YAML dump

### `ai skills`
- [ ] Lists installed skills with titles and descriptions
- [ ] Shows which are in default set
- [ ] Handles missing registry gracefully (creates default)
- [ ] Never crashes with NotADirectoryError

### `ai index`
- [ ] Actually indexes something (skills, tools, imports)
- [ ] Reports meaningful counts (not "0, 0, 0")
- [ ] Persists to global index

### `ai context`
- [ ] Summarizes project purpose (not just file counts)
- [ ] Lists stack, dependencies, entry points
- [ ] Generates actionable context for external AIs

### `ai graph`
- [ ] Creates nodes AND edges (relationships)
- [ ] Embedding coverage > 0%
- [ ] Queryable

### `ai global memory`
- [ ] Shows actual project insights (not just bootstrap note)
- [ ] Includes rules, patterns, skills from vault
- [ ] Reflects current state of project

### `ai setup`
- [ ] Skills installed > 0
- [ ] Providers configured (at least defaults)
- [ ] Security policies loaded > 0
- [ ] Idempotent (re-run doesn't duplicate)

## Common Root Causes

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| "No project memory found" | Loader only reads `.md`, but init writes `.yaml` | Read both formats |
| "Skills installed: 0" | Installer writes to wrong dir; registry can't find them | Use `registry_path` from config |
| Registry crashes | Path doesn't exist, returns `/dev/null` | Create default path, handle gracefully |
| "Indexed: 0" | Skills/tools not discoverable | Check scan paths, file patterns |
| Graph nodes but 0 edges | Builder only creates nodes, no relationships | Implement edge detection |
| "No global memory" | Sync never runs or never captures | Trigger sync on init, capture real data |

## Testing Commands (not just functions)

When implementing a command, test the ACTUAL command output, not just the function:

```bash
# Test the command end-to-end
cd /tmp/test-project
ai setup
ai skills
ai memory
ai context
ai global memory
```

Verify the output is Q3-Q4, not Q0-Q2.
