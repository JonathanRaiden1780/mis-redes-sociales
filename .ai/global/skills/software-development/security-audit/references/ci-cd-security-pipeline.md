# CI/CD Security Pipeline Reference

## Workflow Template

A simplified, portable GitHub Actions workflow for security scanning that works on **both public and private repos** without GitHub Advanced Security.

### Key Principles

1. **Use `grep` for secret detection** — Works everywhere, no special permissions
2. **Use native package manager audit** — `npm audit`, `pnpm audit`, `yarn audit`
3. **Use `safety` + `bandit` for Python** — `pip install` friendly
4. **Use `trivy fs` for filesystem/Docker scan** — No daemon required
5. **Avoid CodeQL in private repos** — Requires GitHub Advanced Security
6. **Use `continue-on-error: true`** — Reports without blocking on pre-existing issues
7. **Use `if: hashFiles()`** — Skip jobs when relevant files don't exist

### Example Step: Secret Detection

```yaml
- name: Secret Detection
  run: |
    SECRETS=$(git diff ${{ github.event.before }}..${{ github.sha }} 2>/dev/null | grep -iE "(api_key|secret|password|token|passwd)\s*=\s*['\"][^'\"]{6,}['\"]" || true)
    if [ -n "$SECRETS" ]; then
      echo "::error::Potential secrets detected!"
      echo "$SECRETS"
      exit 1
    fi
```

### Example Step: Dependency Audit

```yaml
- name: Dependency Audit
  run: |
    if [ -f "pnpm-lock.yaml" ]; then
      npm install -g pnpm && pnpm audit --audit-level=high 2>&1 || echo "Audit completed with warnings"
    elif [ -f "yarn.lock" ]; then
      yarn audit --level high 2>&1 || echo "Audit completed with warnings"
    elif [ -f "package-lock.json" ]; then
      npm audit --audit-level=high 2>&1 || echo "Audit completed with warnings"
    fi
  continue-on-error: true
```

### Common Pitfall: Workflow file location

GitHub Actions only finds workflows in the **base branch** of a PR. If you add `.github/workflows/security.yml` in a feature branch, it won't run on the PR until merged to the base branch.

**Solution**: Push the workflow to the base branch (e.g., `develop`) first, before creating PRs that rely on it.

### PR Auto-Review Bot

Automatically comments on PRs with:
- Secret detection results
- PR size warning (>20 files)
- Debug statement detection (console.log, debugger, print())

Uses `actions/github-script@v7` to create comments.

## Branch Protection Setup

To enforce the workflow, go to **Settings → Branches → Add rule**:

- Require status checks to pass before merging
- Select jobs from the workflow as required checks
- Require branches to be up to date before merging
