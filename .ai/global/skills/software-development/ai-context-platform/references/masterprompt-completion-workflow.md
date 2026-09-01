# MASTERPROMPT Completion & Security Scan Workflow

When `ai init` generates an incomplete MASTERPROMPT.md (common with AIEP-generated stubs), use this workflow to complete it with real project data. Also covers initial security scanning for Firebase + Capacitor projects.

## When to Use

- MASTERPROMPT.md exists but has placeholder text (`_Descripción..._`, `_Sin memoria aún_`)
- Sections are incomplete (sections 1, 3, 6, 8, 9 are often empty or default)
- References point to files that don't exist (`docs/ARCHITECTURE.md`, `.ai/memory.yaml`)
- After project initialization, before handing off to external AIs

## Workflow

### 1. Inspect the Project

```bash
# Read existing docs and structure
cat MASTERPROMPT.md          # see what's there
cat docs/AI_CONTEXT.md       # product map (if exists)
cat CLAUDE.md                # agent rules (if exists)
cat package.json             # dependencies, scripts, engines
ls src/                      # source structure
ls functions/                # backend functions
ls scripts/                  # build/deploy scripts
ls nas-*-server/ edge services
```

Read key files:
- `src/main.tsx` — entry point
- `src/types/index.ts` — domain model
- `src/context/AuthContext.tsx` — auth flow
- `src/lib/firebase.ts` — Firebase config
- `src/lib/firestoreClient.ts` — data access patterns
- `firestore.rules` — authorization rules
- `capacitor.config.ts` — mobile config
- `nas-*/server.js` — NAS service security

### 2. Complete MASTERPROMPT Sections

Fill each section with real data:

| Section | Content | Source |
|---|---|---|
| 1. Description | What the project does, who it's for, stack | Package.json + codebase analysis |
| 2. Dependencies | Prod + dev deps, counts | `package.json` |
| 3. Team Rules | Coding standards, git workflow, security rules | `AGENTS.md`, `CLAUDE.md`, `firestore.rules` |
| 4. Critical Flows | Order of operations for key features | `docs/AI_CONTEXT.md`, codebase analysis |
| 5. Collections | Database schema, roles | `firestore.rules`, `src/types/index.ts` |
| 6. Security | Vulnerabilities, code patterns, secrets | Security scan (see below) |
| 7. AI Protocol | How external AIs should work | AIEP conventions |
| 8. Roadmap | Phases, progress, metrics | `git log`, test coverage, CI status |
| 9. Memory | Decisions, discoveries, history | Git history, session context |

### 3. Remove Broken References

Check all internal links in MASTERPROMPT.md. If a referenced file doesn't exist:
- Either create it (if it should exist)
- Or remove the reference (if it's not applicable)

Common broken references in AIEP-generated stubs:
- `docs/ARCHITECTURE.md` → create from analysis
- `.ai/memory.yaml` → only exists in AIEP projects, remove if not applicable
- `ai sync` / `ai context` → AIEP-specific commands, note as optional

### 4. Security Scan (Firebase + Capacitor)

#### 4a. Dependencies
```bash
npm audit                  # list vulnerabilities
npm audit fix              # auto-fix non-breaking
# Document remaining (require --force / breaking changes)
```

#### 4b. Code Patterns
```bash
# XSS / injection
grep -rn "dangerouslySetInnerHTML\|eval(\|document\.write" src/

# Hardcoded secrets (excluding VITE_ env vars which are public-by-design in Firebase)
grep -rn "apiKey\|private_key\|client_email" src/ | grep -v "import.meta.env"

# Insecure origins
grep -rn "innerHTML" src/  # React — should be zero
```

#### 4c. Firestore Rules
Verify:
- `sameBusiness()` or equivalent isolation function
- Role-based access (admin/seller/client)
- No delete permissions for non-admins
- Default deny-all at the end
- Scoped collections (no wildcard allows)

#### 4d. NAS Services
Verify:
- Token auth on all endpoints
- Firebase ID token validation (not just token)
- CORS configured
- No shell injection (validate file names, use execFile not exec)

#### 4e. Output
Create `docs/SECURITY_SCAN.md` with:
- Dependency vulnerabilities (severity, fix status)
- Code pattern findings (safe/warning)
- Secrets audit
- Firestore rules assessment
- NAS service security
- Prioritized action items

### 5. Update Roadmap

Structure into phases:
1. **Foundation** — completed items (from git log + existing features)
2. **Security/Quality** — in progress (vulnerabilities, tests)
3. **Production** — pending (CI/CD, monitoring, hardening)

Include real metrics:
- File counts by extension
- Dependency counts
- Vulnerability counts
- Test coverage (if available)

### 6. Verify

```bash
npm run build              # must pass
npm run test               # document pass/fail rate
npm run lint               # must pass
```

### 7. Gitflow

```bash
git checkout -b docs/masterprompt-security-scan
git add MASTERPROMPT.md docs/ROADMAP.md docs/SECURITY_SCAN.md docs/ARCHITECTURE.md
git commit -m "docs: complete MASTERPROMPT, update ROADMAP, run security scan"
git push -u origin docs/masterprompt-security-scan
```

## Pitfalls

- **Leaving placeholder text** — `_Descripción..._` and `_Sin memoria aún_` mean the doc is NOT complete
- **Broken internal links** — every referenced file must exist or be removed
- **Ignoring AIEP-specific references** — `.ai/memory.yaml`, `ai sync` only exist in AIEP projects
- **Not running npm audit** — dependencies have vulnerabilities by default
- **Missing Firestore rules review** — authorization is the source of truth
- **Overlooking NAS services** — they handle push, OCR, backup with their own auth
- **Not verifying build/tests** — documentation commits should not break the build

## Output Artifacts

- `MASTERPROMPT.md` — complete, no placeholders
- `docs/ROADMAP.md` — phased with progress tracking
- `docs/SECURITY_SCAN.md` — vulnerability report + action items
- `docs/ARCHITECTURE.md` — project structure + dependencies (if not existing)
