---
name: mis-redes-sociales
description: "Motor de contenido para redes sociales — amplificación de prompts con IA, generación de imágenes/video con Agnes, y difusión multi-plataforma."
tags: [aiep, project-init, compliance]
---

# Mis Redes Sociales — Social Media Content Engine

## Descripción

Motor de contenido que transforma ideas simples en publicaciones optimizadas para todas las plataformas. Usa IA para amplificar prompts, genera contenido visual con Agnes, y distribuye automáticamente a Instagram, TikTok, Facebook y WhatsApp.

## Funcionalidades Principales

1. **Amplificación de Prompts**: Idea cruda → prompt optimizado con IA (parser, análisis de intención, builder)
2. **Generación de Contenido**: Imágenes y videos con Agnes Video Generator (fallback inteligente si no disponible)
3. **Publicación Multi-Plataforma**: Instagram, TikTok, Facebook (con fallback manual)
4. **Difusión WhatsApp**: Envío automático via Twilio + modo manual sin APIs
5. **Historial y Reutilización**: Guardar campañas, reutilizar prompts, ver historial completo
6. **Configuración Centralizada**: Estado de servicios, API keys, modo fallback

## Arquitectura del Proyecto

```
mis-redes-sociales/
├── src/
│   ├── client/                    # React frontend (TypeScript + Vite)
│   │   ├── components/            # Componentes UI
│   │   │   ├── AmplifyPanel.tsx
│   │   │   ├── ResultPanel.tsx
│   │   │   ├── PlatformGrid.tsx
│   │   │   ├── PlatformPreview.tsx
│   │   │   ├── ManualDiffusion.tsx
│   │   │   ├── WhatsAppPanel.tsx
│   │   │   ├── HistoryScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── types.ts
│   └── server/                    # FastAPI backend (Python)
│       ├── api/                   # Routers REST
│       │   ├── campaigns.py      # CRUD campañas
│       │   ├── generate.py       # Generación con Agnes
│       │   ├── diffuse.py        # Difusión manual
│       │   ├── whatsapp.py       # WhatsApp Twilio
│       │   └── publish.py        # Publicación multi-plataforma
│       ├── core/                  # Servicios principales
│       │   ├── amplifier/        # Pipeline de amplificación
│       │   │   ├── parser.py
│       │   │   ├── intent_analyzer.py
│       │   │   ├── prompt_builder.py
│       │   │   └── platform_adapter.py
│       │   ├── agnes_client.py   # Cliente HTTP Agnes
│       │   ├── content_generator.py  # Servicio de generación
│       │   └── social_clients/   # Clientes de redes sociales
│       │       ├── __init__.py   # Instagram, TikTok, Facebook
│       │       └── whatsapp.py   # Twilio WhatsApp
│       ├── database/              # Configuración BD
│       │   └── __init__.py       # Engine, Session, Base
│       ├── models/                # Modelos SQLAlchemy
│       │   └── database.py       # Campaign, GeneratedContent, DiffusionHistory
│       └── main.py               # Entry point FastAPI
├── tests/                        # Tests pytest
│   └── unit/
│       ├── test_amplifier.py     # Tests del amplificador
│       ├── test_integration.py   # Tests de integración
│       └── test_database.py      # Tests de base de datos
├── docs/
│   ├── specs/                    # Especificaciones técnicas (SPEC-XXX)
│   └── tasks/                    # Planificación de tareas (TASK-XXX)
├── docker-compose.yml            # Orquestación para NAS
├── Dockerfile                    # Imagen backend
├── pyproject.toml                # Dependencias Python
├── MASTERPROMPT.md               # Este archivo
└── README.md                     # Documentación principal
```

## Puntos de Entrada

| Componente | Archivo | Descripción |
|-----------|---------|-------------|
| Backend API | `src/server/main:app` | FastAPI app — entry point |
| Frontend | `src/client/src/main.tsx` | React app — entry point |
| Amplificador | `src/server/core/amplifier/__init__.py:amplify()` | Función principal |
| Base de datos | `src/server/database/__init__.py:init_db()` | Inicializa tablas |

## Variables de Entorno

```bash
# Opcionales — el sistema funciona sin ellas (modo fallback)
AGNES_API_KEY=free
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
INSTAGRAM_ACCESS_TOKEN=your_token
INSTAGRAM_ACCOUNT_ID=your_account_id
TIKTOK_ACCESS_TOKEN=your_token
FACEBOOK_ACCESS_TOKEN=your_token
FACEBOOK_PAGE_ID=your_page_id
```

## Scripts Disponibles

```bash
# Backend
uvicorn src.server.main:app --reload          # Desarrollo
pytest tests/                                  # Tests (45 tests)

# Frontend (desde src/client/)
pnpm dev                                       # Desarrollo (puerto 5173)
pnpm build                                     # Build producción

# Docker
docker-compose up -d                           # Producción en NAS
```

## Convenciones del Proyecto

1. **pnpm only** — Nunca npm, yarn o bun
2. **Estilos inline** — CSS via `style={{}}` en React (sin Tailwind en runtime)
3. **Sin Co-authored-by** — Commits limpios sin tags de IA
4. **Fallback inteligente** — Todas las APIs externas tienen modo degradado
5. **Tests obligatorios** — Cada feature debe tener tests pytest
6. **Documentación en español** — Todo el código y docs en español

## Estado de Componentes

| Componente | Estado | Fallback |
|-----------|--------|----------|
| Amplificador de prompts | ✅ Completo | N/A (funciona offline) |
| Generación Agnes | ✅ Completo | Placeholder con mensaje |
| WhatsApp Twilio | ✅ Completo | Difusión manual sin API |
| Instagram API | ✅ Completo | Copiar texto manualmente |
| TikTok API | ✅ Completo | Copiar texto manualmente |
| Facebook API | ✅ Completo | Copiar texto manualmente |
| Historial/Campañas | ✅ Completo | N/A (SQLite local) |
| Configuración | ✅ Completo | N/A (UI local) |

## Próximos Pasos (Roadmap)

- [ ] Integración con ViMax para videos multi-scena
- [ ] Scheduler de publicaciones (cron jobs)
- [ ] Dashboard de métricas y analytics
- [ ] Exportar campañas a PDF/CSV
- [ ] Modo oscuro/claro toggle
- [ ] Internacionalización (inglés/portugués)

## Seguridad

- API keys almacenadas en variables de entorno (nunca en código)
- SQLite sin exposición externa (solo localhost)
- CORS configurado para desarrollo
- Sin secrets en commits (usar `.env`)

## Licencia

MIT