# NAS Repository Separation Pattern

**Decision**: Split NAS services into TWO repos based on data sensitivity, not function.

## Repos

### nas-services (PRIVATE)
Services that handle sensitive business data:
- **backup-server** (8787): receives app backups with business/customer data
- **ocr-server** (8788): PDF invoice OCR with financial data

Reason for privacy: Both process confidential business information (customer data, financial invoices).

### nas-gateway (PUBLIC)
Pure infrastructure services:
- **app-gateway** (8790): push notifications, app release
- **automation-engine** (8791): IF-THEN rule engine

Reason for grouping: Shared auth (`x-gateway-token`), shared docker-compose, shared deployment cycle.

## Implementation (2026-08-19)

```bash
# Repo 1: nas-services (private)
mkdir nas-services && cd nas-services && git init
mkdir backup-server ocr-server
# Copy from MiNegocio/nas-backup-server and nas-ocr-server

# Repo 2: nas-gateway (public)  
mkdir nas-gateway && cd nas-gateway && git init
mkdir gateway automation
# Copy gateway from MiNegocio/nas-app-gateway
# Create automation/ from scratch
```

## Key Insight

User correction: Initially separated into 3 repos (gateway, automation, services) but corrected to 2 — gateway+automation together (infrastructure), backup+OCR together (data-sensitive). Group by data sensitivity, not by technical function.
