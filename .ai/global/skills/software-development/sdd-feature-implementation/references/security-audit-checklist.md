# Security Audit Checklist for SDD Features

Security audit pattern validated in SPEC-053 (Global Auto-Distribution). Use this checklist after implementing any feature that handles credentials, sync, or external communication.

## When to use

- After implementing any feature that touches credentials, API keys, tokens
- After implementing sync/distribution features
- After implementing installer scripts (install.sh)
- Before declaring any feature "complete"

## Checklist

### 1. Hardcoded Secrets

```bash
grep -rn --include='*.py' -E "(api_key|secret|password|token|passwd|apikey)\s*=\s*['\"][^'\"]{6,}['\"]" src/
grep -rn --include='*.py' -E "['\"](sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36,}|AKIA[0-9A-Z]{16})['\"]" src/
```

**FAIL if:** Any match that's not a test fixture or `# noqa` with justification.

### 2. Shell Injection

```bash
grep -rn --include='*.py' -E "subprocess.*shell=True|os\.system\(" src/
grep -rn --include='*.sh' -E "eval\s*\$" install.sh
```

**FAIL if:** Any match without explicit justification comment.

### 3. Dangerous Eval/Exec

```bash
grep -rn --include='*.py' -E "\beval\s*\(|\bexec\s*\(" src/
```

**FAIL if:** Any match with user-controlled input.

### 4. Unsafe Deserialization

```bash
grep -rn --include='*.py' -E "pickle\.loads?\(" src/
grep -rn --include='*.py' -E "yaml\.load\s*\(" src/
```

**FAIL if:** `yaml.load()` without `Loader=yaml.SafeLoader`. `pickle.loads()` is always FAIL.

### 5. Path Traversal

```bash
grep -rn --include='*.py' -E "open\(.*\+|Path\(.*\+" src/
```

**FAIL if:** User input concatenated into paths without `resolve()` + containment check.

### 6. Silent Error Swallowing

```bash
grep -rn --include='*.py' -E "except.*:\s*$" src/ | grep -A1 "pass$"
```

**WARN if:** More than 1 occurrence. Each needs justification comment.

### 7. Secrets in Memory

Check that sensitive values (API keys, tokens) are cleared after use:
```python
# BAD
providers[name]["api_key"] = key
# key remains in memory

# GOOD
providers[name]["api_key"] = key
del key  # or key = None
```

### 8. File Permissions on Sensitive Files

```bash
# providers.yaml should be 0600
grep -rn --include='*.py' -E "chmod\s+0?600" src/
```

**FAIL if:** Credential files written without restrictive permissions.

### 9. URL Validation (for remote repos/APIs)

```bash
grep -rn --include='*.sh' -E "git\s+remote\s+add" install.sh
```

**FAIL if:** User-provided URL used without validation against whitelist.

### 10. Logging of Sensitive Data

```bash
grep -rn --include='*.py' -E "print\(.*key|print\(.*token|print\(.*secret" src/
grep -rn --include='*.py' -E "logger\..*key|logger\..*token" src/
```

**FAIL if:** Any match.

## Severity Classification

| Severity | Examples | Action |
|----------|----------|--------|
| **Critical** | Hardcoded secrets, backdoors, data exfiltration | Immediate fix, feature blocked |
| **High** | Shell injection, eval/exec with user input, path traversal, secrets in memory | Fix before completion |
| **Medium** | curl\|bash, sudo without confirmation, unvalidated URLs, silent errors | Fix before completion |
| **Low** | No file locking, no rate limiting, missing observability | Fix if time permits |

## Output Format

After audit, produce a table:

| # | Finding | Severity | File | Fix |
|---|---------|----------|------|-----|
| 1 | try/except pass silencioso | HIGH | git_sync.py:126 | Add logger.debug |
| 2 | API key en memoria | HIGH | cli.py:_set_provider_key | Add del key |
| 3 | URL sin validar | HIGH | install.sh:161 | Whitelist dominios |

## Integration with SDD Flow

This checklist is **Step 8.5** in the SDD flow — after QA gate (Step 8) and before commit (Step 9). If any HIGH or CRITICAL findings exist, the feature is NOT complete.
