# Multi-Repo CI/CD Pattern

## Context

When setting up security scanning + PR review as GitHub Actions across multiple repos (MiNegocio, nas-gateway, nas-services, nas-infrastructure, AIEP), use a single reusable workflow file copied to every repo.

## The Workflow

One file: `.github/workflows/security-quality-gate.yml`

### Jobs (each runs in parallel):

1. **security-scan** — Secret detection (grep-based), dependency audit (npm/pip)
2. **quality-node** — lint, type check, test, build (for TS/JS projects)
3. **quality-python** — ruff, mypy, pytest (for Python projects)
4. **docker-scan** — Trivy FS scan (for Docker projects)
5. **pr-review** — PR size check, secret-in-diff, debug-statement detection, auto-comment summary

### Key features:

- **Conditional execution** — jobs detect relevant files via `if:` conditions
- **`continue-on-error: true`** — tools that aren't installed don't fail the workflow, just report
- **Auto PR comment** — GitHub Script posts a summary table on every PR
- **Zero secrets needed** — uses built-in `GITHUB_TOKEN`

### Copy pattern:

```bash
for repo in MiNegocio nas-gateway nas-services nas-infrastructure; do
  mkdir -p "$repo/.github/workflows"
  cp workflow.yml "$repo/.github/workflows/"
  cp pr-template.md "$repo/.github/"
done
```

## Branch Protection Setup

Guide in `.github/BRANCH_PROTECTION_GUIDE.md`:

| Branch | Require PR | Require Status Checks | Required Reviews |
|--------|------------|----------------------|------------------|
| main/master | ✅ | ✅ (all CI jobs) | 1 |
| develop | ✅ | ✅ | 0-1 |

## PR Template

`.github/pull_request_template.md` — security checklist + description sections.

## Verification

```bash
# YAML syntax
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/security-quality-gate.yml'))"

# Check all repos
for repo in */; do
  [ -f "$repo/.github/workflows/security-quality-gate.yml" ] && echo "✓ $repo"
done
```

## Lessons Learned

### `hashFiles()` Cannot Be Used in Job-Level `if:` Conditions
- **Problem:** GitHub Actions throws "Unrecognized function: hashFiles" when used in `jobs.<id>.if` — `hashFiles()` is only valid in `jobs.<id>.steps[*].if`.
- **Fix:** Remove `hashFiles()` from job-level conditions entirely. Run all jobs unconditionally and use `continue-on-error: true` for steps that may not apply.
- **Rule:** Job-level `if:` only supports: `success()`, `failure()`, `cancelled()`, `always()`, `github.*` context, and simple boolean expressions — NOT `hashFiles()`, `format()`, `startsWith()`, etc.

### CodeQL + Gitleaks Fail in Private Repos
- **Problem:** `github/codeql-action/init@v3` and `gitleaks/gitleaks-action@v2` require GitHub Advanced Security for private repos
- **Fix:** Use basic grep-based secret detection + Trivy (free) instead of CodeQL/gitleaks
- **User impact:** Private repos get scanning without additional cost

### Workflow Must Exist on Base Branch
- **Problem:** Workflow only on feature branch → GitHub won't run it for PRs targeting `develop`/`main`
- **Fix:** Push workflow to default branch first, OR merge workflow commit before creating feature PRs
- **Rule:** CI/CD infrastructure goes directly to `develop`/`main`, not through feature branches

### npm vs pnpm Detection
- User explicitly banned `npm` from all projects
- Workflow auto-detects: `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `package-lock.json` → npm (legacy fallback only)
- Android publish script (`scripts/publish_android_zip.py`) also excludes `npm` from `--package-manager` choices

### Environment-dependent failures
- `gh` CLI not installed → use API tokens or manual setup
- `pnpm run lint` times out at 60s → environment issue, not code; workaround: `npx tsc --noEmit --pretty`
- `sudo` requires password → install packages without sudo or use pre-installed tools
