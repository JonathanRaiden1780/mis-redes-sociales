# Mis Redes Sociales — Social Media Content Engine

Motor de contenido para redes sociales que transforma ideas simples en publicaciones optimizadas para todas las plataformas. Amplificación de prompts con IA, generación de imágenes/video con Agnes, y difusión multi-plataforma (Instagram, TikTok, Facebook, WhatsApp).

## Estado del Proyecto

| Componente | Estado | Descripción |
|-----------|--------|-------------|
| Backend API | ✅ Completo | FastAPI + SQLite + SQLAlchemy |
| Frontend | ✅ Completo | React + TypeScript + Vite |
| Prompt Amplifier | ✅ Completo | Parser + Intent + Builder + Adapter |
| Persistencia | ✅ Completo | Campañas, Contenido, Difusiones |
| Generación Agnes | ✅ Completo | Con fallback inteligente |
| WhatsApp | ✅ Completo | Twilio API + difusión manual |
| Publicación | ✅ Completo | Instagram/TikTok/Facebook APIs |
| Historial | ✅ Completo | CRUD + detalle + eliminar |
| Configuración | ✅ Completo | Estado de servicios + API keys |
| Docker | ✅ Completo | docker-compose.yml para NAS |

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Dashboard   │  │  Historial  │  │ Configuración│            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         └─────────────────┼─────────────────┘                   │
│                           │                                     │
│  ┌────────────────────────┴────────────────────────┐           │
│  │              AmplifyPanel + ResultPanel          │           │
│  │         PlatformGrid + ManualDiffusion           │           │
│  │              WhatsAppPanel + History             │           │
│  └────────────────────────┬────────────────────────┘           │
└───────────────────────────┼─────────────────────────────────────┘
                            │ HTTP/JSON
┌───────────────────────────┼─────────────────────────────────────┐
│                      Backend (FastAPI)                           │
│  ┌────────────────────────┴────────────────────────┐           │
│  │                  API Routers                     │           │
│  │  /api/amplify  /api/campaigns  /api/generate    │           │
│  │  /api/diffuse  /api/whatsapp   /api/publish    │           │
│  └────────────────────────┬────────────────────────┘           │
│                           │                                     │
│  ┌────────────────────────┴────────────────────────┐           │
│  │                Core Services                     │           │
│  │  Amplifier    ContentGen    SocialClients       │           │
│  │  Parser       AgnesClient   WhatsAppBot         │           │
│  │  Intent       ViMax         Instagram           │           │
│  │  Builder      Fallback      TikTok             │           │
│  │  Adapter                       Facebook         │           │
│  └────────────────────────┬────────────────────────┘           │
│                           │                                     │
│  ┌────────────────────────┴────────────────────────┐           │
│  │              Database (SQLite)                   │           │
│  │  Campaign  GeneratedContent  DiffusionHistory   │           │
│  └─────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────┴────┐        ┌────┴────┐        ┌────┴────┐
   │  Agnes  │        │ Twilio  │        │  Meta   │
   │  (local)│        │  (API)  │        │ Graph   │
   └─────────┘        └─────────┘        └─────────┘
```

## Tech Stack

| Capa | Tecnología | Propósito |
|------|-----------|-----------|
| Backend | FastAPI (Python) | API REST asíncrona |
| Frontend | React 19 + TypeScript | UI interactiva |
| Estilos | CSS inline + Design system | Sin dependencias externas |
| Base de datos | SQLite + SQLAlchemy | Persistencia ligera |
| IA Imágenes | Agnes Video Generator | Generación de contenido |
| WhatsApp | Twilio Business API | Difusión automática |
| Redes Sociales | Meta Graph API, TikTok API | Publicación automática |
| Contenedores | Docker Compose | Despliegue en NAS |

## Requisitos

- Python 3.11+
- pnpm 11.22.0+
- Node.js 22+
- Docker + Docker Compose (opcional)

## Inicio Rápido

```bash
# 1. Clonar repositorio
git clone https://github.com/JonathanRaiden1780/mis-redes-sociales.git
cd mis-redes-sociales

# 2. Backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# 3. Frontend
cd src/client
pnpm install
pnpm dev

# 4. Backend (otra terminal)
cd ../..
uvicorn src.server.main:app --reload

# Acceder a http://localhost:5173
```

## Configuración de APIs

Las APIs externas son opcionales. El sistema funciona sin ellas usando modo fallback.

```bash
# .env (opcional)
AGNES_API_KEY=free
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_token
INSTAGRAM_ACCESS_TOKEN=your_token
FACEBOOK_ACCESS_TOKEN=your_token
```

## Documentación

- [MASTERPROMPT.md](MASTERPROMPT.md) — Contexto completo para IAs externas
- [docs/specs/](docs/specs/) — Especificaciones técnicas (SPEC-XXX)
- [docs/tasks/](docs/tasks/) — Planificación de tareas
- [README.md](README.md) — Este archivo

## Licencia

MIT