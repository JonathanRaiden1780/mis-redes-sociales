# NAS ↔ Repo Bidirectional Sync Pattern (2026-08-20)

When NAS services exist both in production (NAS share) and in code repos, maintain bidirectional sync with clear source-of-truth rules.

## Source of Truth Rules

| What | Source of Truth | Direction |
|------|-----------------|-----------|
| Production configs (`.env`, `config/`) | NAS share | NAS → Repo |
| Production scripts (`run-*.sh`) | NAS share | NAS → Repo |
| Production data (`data/`) | NAS share | NAS → Repo (for testing) |
| New features (automation, new services) | Git repo | Repo → NAS |
| `docker-compose.yml` | Both | Keep both in sync |
| `node_modules/` | NAS only | Never commit to git |

## Sync Commands

### NAS → Repo (pull production state)
```bash
cp "/nas/share/run-notifications-job.sh" repo/gateway/
cp -r "/nas/share/data/." repo/backup-server/
cp "/nas/share/docker-compose.yml" repo/
```

### Repo → NAS (deploy new features)
```bash
mkdir -p "/nas/share/nas-automation-engine"
cp -r repo/automation/* "/nas/share/nas-automation-engine/"
# On NAS:
cd "/nas/share/" && docker compose down && docker compose up -d --build
```

## Verification
```bash
# Compare structures
diff <(ls /nas/share/service/) <(ls repo/service/)

# Validate YAML
python3 -c "import yaml; yaml.safe_load(open('docker-compose.yml'))"

# Check services match expected
expected=("tunnel" "tailscale" "portainer" "nas-app-gateway" "nas-automation-engine" "nas-backup-server" "nas-ocr-server" "homeassistant" "navidrome" "music-syncer" "picard" "telegram-downloader")
```

## Pitfalls

1. **Don't delete NAS `node_modules`** — they're needed for production, just don't commit them
2. **Don't assume repo = production** — NAS share may have runtime fixes not yet in git
3. **Always validate docker-compose after sync** — YAML errors break all services
4. **Test on NAS before pushing to git** — NAS is where real users hit the services
