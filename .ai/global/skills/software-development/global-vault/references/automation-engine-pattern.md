# Automation Engine Pattern — Session 2026-08-20

## Context

MiNegocio needs an automation engine (IF-THEN rule engine) to run on NAS. Evaluates leads against configured rules and executes actions automatically.

## Architecture

```javascript
// server.js — Automation Engine
const evaluateRules = async () => {
  const leadsSnap = await db.collection('leads').get();
  const rulesSnap = await db.collection('automation_rules').where('enabled', '==', true).get();
  const rules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  for (const leadDoc of leadsSnap.docs) {
    const lead = { id: leadDoc.id, ...leadDoc.data() };
    for (const rule of rules) {
      if (!matchesTrigger(rule.trigger, lead)) continue;
      if (!matchesConditions(rule.conditions, lead)) continue;
      await executeActions(rule.actions, lead);
    }
  }
};
```

## Rule Schema

```yaml
# automation_rules collection
trigger:
  type: days_inactive | threshold_reached
  days: number
conditions:
  - type: lifecycle | status
    value: string
actions:
  - type: send_whatsapp | add_bitacora | change_status | send_push
    messageTemplate: optional string
    statusId: optional string
    title: optional string
    body: optional string
    appId: optional string
```

## Deployment

- **Port**: 8791
- **Cron**: Every 12h (configurable via `CRON_SCHEDULE`)
- **Dependencies**: express, node-cron, firebase-admin
- **Config**: FIREBASE_SERVICE_ACCOUNT_PATH, NAS_GATEWAY_URL, NAS_GATEWAY_TOKEN

## Docker Integration

```yaml
# docker-compose.yml
nas-automation-engine:
  build: ./core/nas-automation-engine
  ports:
    - "8791:8791"
  environment:
    - PORT=8791
    - NAS_GATEWAY_TOKEN=${NAS_GATEWAY_TOKEN}
    - NAS_GATEWAY_URL=http://nas-app-gateway:8790
    - FIREBASE_SERVICE_ACCOUNT_PATH=/app/config/service-account.json
    - CRON_SCHEDULE=${CRON_SCHEDULE:-0 */12 * * *}
  depends_on:
    - nas-app-gateway
```

## Production Repo: nas-infrastructure

The actual production repo is at `~/proyectos/nas-infrastructure/` with structure:

```
nas-infrastructure/
├── core/
│   ├── nas-app-gateway/       # Port 8790
│   ├── nas-automation-engine/ # Port 8791
│   ├── nas-backup-server/     # Port 8787
│   └── nas-ocr-server/        # Port 8788
├── portainer/                 # Port 9000 (Docker management)
├── homeassistant/             # Domotics
├── media/                     # Music server
├── utilities/                 # Telegram downloader, etc.
└── docker-compose.yml         # Unified compose
```

## Verification

```bash
# Local verification
python3 -c "import ast; ast.parse(open('server.js').read()); print('Syntax OK')"

# Docker build
docker compose build nas-automation-engine
docker compose up -d nas-automation-engine

# Trigger manually
curl -X POST http://localhost:8791/jobs/automations/run \
  -H "Content-Type: application/json"
```
