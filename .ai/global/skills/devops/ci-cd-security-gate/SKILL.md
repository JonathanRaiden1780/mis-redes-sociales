---
name: ci-cd-security-gate
description: "Set up CI/CD security scanning and quality gates for repos."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [ci-cd, github-actions, security, quality-gate, secrets, docker]
    related_skills: [security-audit, requesting-code-review]
---

# CI/CD Security Gate

GitHub Actions workflow for secret detection, dependency audit, lint/typecheck/test gating, Docker scanning, and PR auto-review across multi-language repos.

## When Use

- User asks for "security scan in CI", "GitHub Actions workflow", "CD/CI", "quality gate"
- Setting up branch protection with required status checks
- Automated PR review with security checklist

## Pitfalls

### `hashFiles` NOT valid in job-level `if:`

`hashFiles()` only works in **step-level** `if:` conditions, NOT job-level. This throws:
```
Unrecognized function: 'hashFiles'. Located at position 1 within expression: hashFiles('package.json') != ''
```

**Wrong:**
```yaml
jobs:
  quality-node:
    if: hashFiles('package.json') != ''  # FAILS
```

**Right:** Remove job-level `if:` and guard individual steps instead, or let the job run and use `continue-on-error: true` on steps.

### Workflow must exist on base branch

GitHub Actions reads the workflow file from the **base branch** (e.g., `develop`), NOT the feature branch. If you add a workflow on a feature branch and open a PR to `develop`, it won't trigger until merged. Push workflow changes to the base branch first.

### `continue-on-error: true` on audit steps

Dependency audit (`npm audit`, `yarn audit`, `pnpm audit`) and security scanners (Trivy, Bandit) may fail on findings. Use `continue-on-error: true` on these steps so the workflow completes and reports results without hard-failing the entire job.

## Workflow Structure

See `templates/security-quality-gate.yml` for a reusable workflow that includes:

1. **Security Scan** — Secret detection (grep-based), dependency audit, Python safety/bandit
2. **Quality Gate (Node.js)** — Install, lint, type check, test, build
3. **Quality Gate (Python)** — Ruff, mypy, pytest
4. **Docker Scan** — Trivy filesystem scan
5. **PR Auto Review** — Size check, secret scan in diff, debug statement detection, summary comment

## Usage

1. Copy the template to `.github/workflows/security-quality-gate.yml`
2. Customize for the repo's package manager (pnpm/yarn/npm) and language
3. Push to the default branch first
4. Configure branch protection rules to require the status checks

## Branch Protection Setup

For each repo, go to **Settings → Branches → Add rule**:

- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging
  - `Security Scan / security-scan`
  - `Quality Gate (Node.js) / quality-node` (if applicable)
- ✅ Require branches to be up to date before merging
- ✅ Require conversation resolution before merging

## Multi-language Detection

The workflow auto-detects languages via lockfiles:

| File | Language/Tool |
|------|---------------|
| `pnpm-lock.yaml` | Node.js + pnpm |
| `yarn.lock` | Node.js + yarn |
| `package-lock.json` | Node.js + npm |
| `bun.lockb` | Node.js + bun |
| `requirements.txt` / `pyproject.toml` | Python |
| `Dockerfile` / `docker-compose.yml` | Docker |

## PR Template

See `templates/pull_request_template.md` for a security checklist template.

## Verification

After pushing to a branch:

```bash
# Check workflow syntax
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/security-quality-gate.yml'))"

# Verify no hashFiles at job level
grep -n "if:" .github/workflows/security-quality-gate.yml | head -20
# Job-level if should only use: github.event_name, always(), etc.
# Step-level if can use hashFiles()
```

## References

- `references/github-actions-functions.md` — Allowed functions in `if:` conditions per scope
- `references/multi-repo-ci-pattern.md` — Pattern for applying the same workflow across many repos
- `references/arm64-synology-nas-docker.md` — ARM64 Docker compatibility on Synology NAS (image selection, pitfalls, git history rewriting, Portainer stack centralization, standalone containers)
