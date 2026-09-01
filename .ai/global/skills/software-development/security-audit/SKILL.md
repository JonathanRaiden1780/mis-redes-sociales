---
name: security-audit
description: "Security audit: injection, leaks, race conditions."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [security, audit, vulnerability, static-analysis, code-review, hardening]
    related_skills: [requesting-code-review, systematic-debugging]
---

# Security Audit

Comprehensive security vulnerability assessment for codebases. Goes beyond the
grep-based scan of `requesting-code-review` to cover deep concerns: race conditions,
file permission leaks, secrets in memory, injection vectors, and supply-chain risks.

## When to Use

- User asks for security review, vulnerability analysis, or hardening
- Before shipping a feature that handles credentials, network, or file I/O
- After implementing auth, sync, config-writer, or CLI-input flows
- When `requesting-code-review`'s static scan passes but you want deeper assurance

**NOT for:** pre-commit gating (use `requesting-code-review` for that), pentesting,
or compliance audits requiring formal methodology.

## Workflow

### Phase 1 — Static Scan

Run the same grep-based patterns from `requesting-code-review` Step 2, plus:

```bash
# Race conditions (read-modify-write without lock)
grep -rn "read_text()\|read()" src/ --include="*.py" -l | xargs grep -l "write_text()\|write()"
grep -rn "fcntl\|flock\|LOCK_EX" src/ --include="*.py"  # check locks exist

# File permission issues
grep -rn "write_text(\|open(\|Path(" src/ --include="*.py" | grep -v "chmod\|0o600"

# Credentials in memory (no cleanup)
grep -rn "api_key\|token\|password\|secret" src/ --include="*.py" -l | xargs grep -L "del \|= None"

# Git remote helper injection (install scripts)
grep -rn "git remote add\|git clone" . --include="*.sh" | grep -v "https://\|git@"

# YAML safety
grep -rn "yaml\.load(" src/ --include="*.py"

# Subprocess shell=True
grep -rn "subprocess.*shell=True\|os\.system(" src/ --include="*.py"

# Install.sh preflight checks
grep -rn "command -v\|install_" . --include="*.sh" | head -20

# curl | bash without checksum
grep -rn "curl.*|.*bash\|curl.*sh" . --include="*.sh"

# Hardcoded counters
grep -rn "changes=0\|pending=0" src/ --include="*.py"
```

### Phase 2 — Deep Analysis

For each file flagged in Phase 1, reason about:

1. **Race conditions** — Does the file do read-modify-write on a shared path? Is there `fcntl.flock`?
2. **File permissions** — Are config/credential files created with restrictive chmod (0o600)?
3. **Secrets lifetime** — Do API keys/tokens get cleared from memory after use?
4. **Input validation** — Are user-provided URLs/paths validated before use (git remote, file open)?
5. **Supply chain** — Does the install use `curl | bash`? Without checksum verification?
6. **Error handling** — Are `except` blocks silent (pass) or do they log?
7. **Deduplication correctness** — If dedup exists, does it use the right composite key?
8. **Concurrent access** — Can two processes corrupt state? Is locking per-process or per-file?
9. **Install robustness** — Does the installer verify prerequisites and auto-install missing tools?
10. **Configuration encryption** — Are credentials stored encrypted (not plaintext)?

### Phase 3 — Independent Review

Dispatch the reviewer with the findings from Phases 1-2. The reviewer MUST be
given the static scan results AND the deep-analysis findings — it is not just
a diff review but a security-context review.

```python
delegate_task(
    goal="""You are an independent SECURITY reviewer. Review the code and findings.

FAIL-CLOSED: security_concerns non-empty -> passed=false.
Deep concerns to check (beyond grep):
- Race conditions in shared file access
- File permission leaks (missing chmod on secrets)
- Secrets not cleared from memory
- Git remote helper injection (ext::, --upload-pack in URLs)
- Supply-chain risk (curl | bash without checksum)
- Silent exception handlers hiding auth/network failures
- Incorrect dedup logic causing data loss

Static scan results: [INSERT PHASE 1 FINDINGS]
Deep analysis findings: [INSERT PHASE 2 FINDINGS]

Return JSON: {"passed": bool, "security_concerns": [], "logic_errors": [], "suggestions": [], "summary": ""}""",
    toolsets=["file", "terminal"]
)
```

### Phase 4 — Auto-Fix Loop

For each finding, apply the targeted fix:

| Finding | Fix |
|---------|-----|
| Git remote helper injection | Validate URL against whitelist (`https://`, `git@`, `git://`); reject `ext::`, `--upload-pack=` |
| Missing chmod on secrets | Add `path.chmod(0o600)` after every `_save()` that writes credentials/config |
| Race condition (read-modify-write) | Use `fcntl.flock(f, fcntl.LOCK_EX)` around YAML writes |
| Silent except pass | Replace with `except Exception as exc: logger.debug("...", exc)` |
| Secrets in memory | Add `del key` or `key = None` after writing to disk |
| Incorrect dedup key | Use composite key (`f"{name}:{type}"`) not just `name` |
| `changes=0` hardcoded | Read actual state after operation instead of hardcoding |

### Phase 5 — Verify

Re-run Phase 1 static scan. Re-run targeted tests. Confirm no regressions.

## Severity Classification

| Severity | Examples |
|----------|----------|
| 🔴 HIGH | Git injection, missing chmod on secrets, silent except pass |
| 🟡 MEDIA | No file locking, incorrect dedup, hardcoded counters |
| 🟢 LOW | curl\|bash, unsanitized read -rp, sudo without prompt |

## Common Patterns

### Credential File Writing (Python)
```python
# Bad: no chmod
path.write_text(yaml.safe_dump(data))

# Good: chmod 0o600
path.write_text(yaml.safe_dump(data))
path.chmod(0o600)
```

### Credential File Writing (Bash)
```bash
# Bad: default umask
echo "$key" > "$CONFIG_DIR/token"

# Good: explicit permissions
echo "$key" > "$CONFIG_DIR/token"
chmod 600 "$CONFIG_DIR/token"
```

### File Locking for Shared State
```python
# Bad: read-modify-write without lock
data = yaml.safe_load(path.read_text())
data["key"] = value
path.write_text(yaml.safe_dump(data))

# Good: exclusive lock
with open(path, "w") as f:
    fcntl.flock(f, fcntl.LOCK_EX)
    yaml.safe_dump(data, f)
path.chmod(0o600)
```

### Git Remote URL Validation (Bash)
```bash
# Bad: user input directly to git
git remote add origin "${user_url}"

# Good: validate against injection vectors
if echo "${user_url}" | grep -qE '^(ext::|--upload-pack=)'; then
    echo "ERROR: git remote helpers not allowed" >&2; exit 1
fi
if ! echo "${user_url}" | grep -qE '^(https://|git@|git://)'; then
    echo "ERROR: invalid URL format" >&2; exit 1
fi
git remote add origin "${user_url}"
```

### Exception Logging (Python)
```python
# Bad: silent failure
except Exception:
    pass

# Good: logged for debugging
except Exception as exc:
    logger.debug("Operation failed: %s", exc)
```

## Pitfalls

- **False negatives from static scan:** Grep cannot catch race conditions or logic errors. Always do Phase 2 deep analysis.
- **Bundled skill overlap:** `requesting-code-review` handles pre-commit gating; this skill is for deeper auditing. Don't duplicate its workflow.
- **Not a compliance tool:** This is engineering-level security review, not SOC2/ISO27001 audit.
- **Installation security:** `curl | bash` without checksum, missing chmod on config, plaintext credentials, and missing preflight checks are HIGH severity in installers.
- **Hermes config exposure:** Copying `.env`/`auth.json` without encryption leaves credentials plaintext on disk.

## CI/CD Security Pipeline Integration

When implementing security scanning in GitHub Actions, prefer **portable, dependency-light approaches** that work across public and private repos without additional GitHub plan requirements.

### Recommended CI/CD security stack (universal compatibility)

| Tool | Purpose | Private Repo Compatible |
|------|---------|------------------------|
| `grep` patterns | Secret detection in diffs | ✅ |
| `npm audit` / `pnpm audit` / `yarn audit` | Dependency vulnerabilities | ✅ |
| `safety` + `bandit` (Python) | Python-specific vulnerabilities | ✅ |
| `ruff` / `mypy` | Python lint + type safety | ✅ |
| `trivy fs` | Docker/filesystem scan | ✅ |
| CodeQL | Deep static analysis | ❌ Requires GitHub Advanced Security |
| gitleaks GitHub Action | Secret detection | ⚠️ Needs token configuration |

### Pitfall: CodeQL in private repos

CodeQL requires **GitHub Advanced Security** enabled. In private repos without it, the `github/codeql-action/analyze` step fails silently or errors. Use `grep`-based secret detection as a fallback that works everywhere.

### Pitfall: gitleaks action in private repos

The `gitleaks/gitleaks-action@v2` requires `GITHUB_TOKEN` with proper permissions and may fail in repos without Advanced Security. A simple `git diff | grep -iE` pattern is more robust for basic secret detection.

### Workflow structure for multi-language repos

```yaml
jobs:
  security-scan:
    # Secret detection + dependency audit (universal)
  quality-node:
    if: hashFiles('package.json') != ''
    # Lint, type check, test, build
  quality-python:
    if: hashFiles('requirements.txt', 'pyproject.toml') != ''
    # Ruff, mypy, pytest
  docker-scan:
    if: hashFiles('Dockerfile') != ''
    # Trivy filesystem scan
  pr-review:
    if: github.event_name == 'pull_request'
    # PR size check, secret scan, auto-comment
```

Use `continue-on-error: true` on lint/test steps so the workflow reports results without blocking merges on pre-existing issues.

### Pitfall: Workflow must be on base branch to run on PR

GitHub Actions only finds workflows in the **base branch** of a PR. If you add `.github/workflows/security.yml` in a feature branch, it won't run on the PR until merged to the base branch.

**Solution**: Push the workflow to the base branch (e.g., `develop`) first, then create PRs. Alternatively, merge the workflow as a standalone PR before relying on it for subsequent PRs.

## References

- `references/spec053-security-patterns.md` — Real-world security patterns from SPEC-053 audit (git injection, chmod leaks, race conditions, silent handlers).
- `references/ci-cd-security-pipeline.md` — Simplified GitHub Actions security workflow template (universal compatibility).
- `references/encrypted-blob-2fa-impl.md` — Production-tested implementations: EncryptedBlob with JSON serialization, SecureStorage with legacy support, TOTP with clock skew tolerance, supply chain verification, memory cleanup (from `application-security` skill).
- `references/web-stack-security-checklist.md` — Web-stack checklist for Angular + Supabase + Docker + Nginx (static scan patterns, hardening checklist, Supabase-specific patterns).
- `references/angular-supabase-patterns.md` — Angular testing gotchas (standalone components, observable getters, router testing), Supabase JS response typing, nginx hardening, Docker multi-stage + non-root, Repository Pattern, ESLint security rules, pnpm migration notes, test password patterns, Supabase migration template.
