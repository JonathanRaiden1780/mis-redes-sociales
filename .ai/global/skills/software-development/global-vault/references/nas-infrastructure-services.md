# NAS Infrastructure Services

## Overview

A production deployment of global-vault principles using Docker services at `~/proyectos/nas-infrastructure/`.

## Architecture

```
nas-infrastructure/
├── core/
│   ├── nas-app-gateway/      # Puerto 8790 - Push notifications & version gateway
│   ├── nas-automation-engine/ # Puerto 8791 - Scheduled cron tasks (default: 0 */12 * * *)
│   ├── nas-backup-server/    # Puerto 8787 - Backup storage
│   ├── nas-ocr-server/       # Puerto 8788 - Invoice OCR processing (Firebase project: minegocio-mk)
│   ├── nas-llm-server/       # Puerto 8792 - Local AI API (Ollama + 4 modos: mi_negocio, chat, night, secretary)
│   ├── nas-ollama/           # Puerto 11434 - LLM engine (qwen2.5:7b-instruct-q4_K_M)
│   ├── nas-sync-server/      # Puerto 8794 - Bidirectional sync with AIEP + backups
│   ├── nas-dashboard/        # Puerto 8793 - Observability dashboard
│   └── nas-bot/              # Telegram bot multi-tenant (usa nas-llm-server)
├── media/music-server/       # Music sync (Spotify/YouTube Music)
├── docs/services/            # Service documentation
├── .ai/global/               # Vault (rules, patterns, skills, projects)
└── docker-compose.yml        # All services with healthchecks
```

## Service Details

### nas-app-gateway (8790)
- Firebase service account path: `/app/config/service-account.json`
- Config dir: `/app/config/apps`
- Token: `NAS_GATEWAY_TOKEN`

### nas-automation-engine (8791)
- Depende de: nas-app-gateway (condition: service_healthy)
- Cron default: `0 */12 * * *`
- Firebase service account: Sí

### nas-backup-server (8787)
- Data dir: `./core/nas-backup-server/data`
- Token: `MN_BACKUP_TOKEN`

### nas-ocr-server (8788)
- Data dir: `./core/nas-ocr-server/data`
- Max file size: 16MB
- Firebase project: `minegocio-mk`
- Token: `MN_OCR_TOKEN`

### nas-llm-server (8792)
- Modelo: `qwen2.5:7b-instruct-q4_K_M`
- Ollama host: `http://nas-ollama:11434`
- Telegram token: `TELEGRAM_BOT_TOKEN`
- Firebase: `minegocio-mk`
- Modos: mi_negocio, chat, night, secretary
- Endpoints:
  - POST /api/chat - Chat con modo
  - POST /api/mi_negocio/suggest - Sugerencia de estrategia
  - POST /api/mi_negocio/inventory_advice - Advice de inventario
  - GET /api/recommendations - Listar recomendaciones
  - POST /api/reminders - Crear recordatorio
  - GET /api/reminders - Listar recordatorios
  - POST /api/memories - Guardar memoria
  - GET /api/memories - Listar memorias

### nas-ollama (11434)
- Imagen: `ollama/ollama:latest`
- Volumen compartido: `ollama-models`

### nas-sync-server (8794)
- Sync interval: 300s (5 min)
- Conflict strategy: `newer` (default), opciones: `nas-wins`, `aiep-wins`
- Endpoints:
  - POST /sync - Ejecutar sincronización
  - POST /backup - Crear backup manual
  - GET /status - Estado de sync
  - GET /backups - Listar backups
  - POST /cleanup - Limpiar backups antiguos
- Backup diario: 3 AM
- Limpieza: >7 días

### nas-dashboard (8793)
- Actualiza cada 30s
- Categorías: Network, Media, Core, AI, Sync
- Botones por servicio para testear endpoints
- Info del sistema: CPU, RAM, disco, uptime

### nas-bot (Telegram)
- Dockerfile: `Dockerfile.bot` (en `core/nas-llm-server/`)
- Depende de: nas-llm-server
- Multi-tenant: cada usuario aislado por telegram_id
- Comandos: /start, /ayuda, /link, /unlink, /modo, /recordatorios, /recuerda, /memorias, /misdatos, /borratodo

## Environment Variables

| Variable | Uso | Servicio |
|----------|-----|----------|
| CLOUDFLARE_TOKEN | Cloudflare Tunnel | tunnel |
| TAILSCALE_KEY | Tailscale VPN | tailscale |
| NAS_GATEWAY_TOKEN | Gateway auth | gateway, automation |
| MN_BACKUP_TOKEN | Backup auth | backup-server |
| MN_OCR_TOKEN | OCR auth | ocr-server |
| TELEGRAM_BOT_TOKEN | Telegram bot | llm-server, bot |
| TELEGRAM_CHAT_ID | Telegram chat | dashboard, bot |
| FIREBASE_SERVICE_ACCOUNT_PATH | Firebase | gateway, automation, ocr |
| FIREBASE_PROJECT_ID | Firebase | ocr-server (minegocio-mk) |
| LLM_MODEL | Modelo Ollama | llm-server |
| LLM_HOST | URL Ollama | llm-server |
| SYNC_INTERVAL | Intervalo sync (seg) | sync-server |
| CONFLICT_STRATEGY | Estrategia conflictos | sync-server |

## Volúmenes Docker

| Volumen | Ruta NAS | Servicios |
|---------|----------|-----------|
| ollama-models | Docker volume | nas-ollama, nas-llm-server |
| service-account.json | /volume1/Docker/secrets/ | nas-app-gateway, automation, ocr |

## Despliegue Independiente

```bash
# Solo un servicio
docker compose up -d nas-ollama
docker compose up -d nas-dashboard

# IA completa
docker compose up -d nas-ollama nas-llm-server nas-bot

# Todo
docker compose up -d
```
