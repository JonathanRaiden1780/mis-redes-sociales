# Repo Separation Pattern — Session 2026-08-19

## Context

MiNegocio had NAS services (gateway, automation, backup, OCR) in subdirectories. Extracted to independent repos for better separation of concerns.

## Decision Matrix

| Service | Repo | Visibility | Reason |
|---|---|---|---|
| nas-app-gateway | `nas-gateway` | Public | Non-sensitive, reusable push/release jobs |
| nas-automation-engine | `nas-gateway` | Public | Rule engine, no sensitive data |
| nas-backup-server | `nas-services` | **Private** | Receives user backups, sensitive data |
| nas-ocr-server | `nas-services` | **Private** | Processes invoices, potentially sensitive |

## Directory Structure (After Separation)

```
~/proyectos/
├── MiNegocio/                 # Frontend + Functions
├── nas-gateway/               # Public NAS services
│   ├── gateway/               # Port 8790
│   └── automation/            # Port 8791
└── nas-services/              # Private NAS services
    ├── backup-server/         # Port 8787
    └── ocr-server/            # Port 8788
```

## Migration Steps

1. Create new repos with `git init` + `ai init-project`
2. Copy service directories to new repos
3. Add `.gitignore` (node_modules, __pycache__, .env)
4. Commit and push to remote
5. Remove directories from original repo (`rm -rf <dir>`)
6. Update documentation (README.md, MASTERPROMPT.md, PROJECT_CARD.md)
7. Verify tests pass: `python -m pytest tests/ -x -q`

## Commands Used

```bash
# Create repo
mkdir -p nas-gateway && cd nas-gateway
git init
ai init-project

# Copy service
cp -r ../MiNegocio/nas-app-gateway/* gateway/

# Gitignore
echo "node_modules/" >> .gitignore

# Commit
git add -A
git commit -m "initial commit: ..."

# Cleanup original
cd ../MiNegocio
rm -rf nas-app-gateway
git add -A
git commit -m "refactor: move to independent repo"
```

## Pitfalls Encountered

1. **node_modules committed accidentally** — Always `.gitignore` before first commit
2. **Standalone script vs package** — `python -m aiep.module` requires `__init__.py` + `__main__.py`
3. **Missing type annotations** — mypy strict mode requires `-> None` on main()
4. **Old files left in repo** — After moving, verify `git status` shows clean tree
