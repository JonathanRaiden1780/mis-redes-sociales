# Separating NAS Services into Independent Repos

**Date:** 2026-08-20
**Context:** MiNegocio had all NAS services in subdirectories of the main repo. We separated them for better isolation and maintainability.

## Decision Matrix

| Service | Repo | Visibility | Reason |
|---------|------|------------|--------|
| `nas-gateway` (push, automation) | `nas-gateway` | Public | Core infra, reusable |
| `nas-automation-engine` (cron rules) | `nas-gateway` | Public | Co-located with gateway |
| `nas-backup-server` | `nas-services` | **Private** | Has access to user data |
| `nas-ocr-server` | `nas-services` | **Private** | Has access to invoices |

## Architecture

```
~/proyectos/
├── MiNegocio/           # Frontend SPA + Firebase Functions
├── nas-gateway/         # Public NAS repos
│   ├── gateway/         # Express + FCM push (port 8790)
│   └── automation/      # node-cron + Firestore (port 8791)
└── nas-services/        # Private NAS repos
    ├── backup-server/   # Receives ZIP backups (port 8787)
    └── ocr-server/      # PDF invoice OCR (port 8788)
```

## Migration Steps

1. Create new repos and copy service files
2. Initialize with `ai init-project`
3. Remove service directories from main repo (`rm -rf nas-backup-server nas-ocr-server nas-app-gateway`)
4. Update main repo docs (README.md, MASTERPROMPT.md, PROJECT_CARD.md)
5. Update firestore.rules for new collection (`message_log`)

## Why Separate?

- **Security**: Backup/OCR handle sensitive data → private repos
- **Reuse**: Gateway/automation are generic → public repos
- **Independent deploy**: Each repo has its own docker-compose
- **Access control**: Only gateway needs to be on the main machine

## Docker Compose (combined for gateway)

```yaml
services:
  app-gateway:
    build: ./gateway
    ports: ["8790:8790"]
  automation-engine:
    build: ./automation
    ports: ["8791:8791"]
    depends_on: [app-gateway]
```

## Communication Between Services

- Automation → Gateway: internal Docker network (`http://app-gateway:8790`)
- App → Gateway: public URL with `x-gateway-token` auth
- All services share Firebase credentials (mounted volume)
