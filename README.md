# Mis Redes Sociales — Social Media Content Engine

A multi-platform social media content engine that transforms simple promotional ideas into publishing-ready content (images + videos) and distributes them across Instagram, TikTok, Facebook, and WhatsApp (diffusion). Powered by AI prompt amplification and Agnes Video Generator.

## 🚀 Features

- **AI Prompt Amplifier**: Raw idea → structured, trend-optimized prompt
- **Content Generation**: Images + videos via Agnes Video Generator (free)
- **Multi-Platform Publishing**: Instagram, TikTok, Facebook
- **WhatsApp Diffusion**: Broadcast offers/promotions to contacts
- **Iterative Refinement**: Adjust pre-prompt → regenerate until satisfied

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI (Python) |
| Frontend | React + Tailwind + pnpm |
| AI Video/Image | Agnes Video Generator (free, self-hosted) |
| WhatsApp | Twilio WhatsApp Business API |
| Platforms | Meta Graph API + TikTok Content Posting API |
| Database | SQLite / PostgreSQL |
| Infrastructure | Docker Compose on NAS |

## 📋 Requirements

- Python 3.11+
- pnpm 11.22.0+
- Docker + Docker Compose
- Agnes AI API key (free: https://platform.agnes-ai.com)
- Twilio account (for WhatsApp)

## 🚦 Quick Start

```bash
# 1. Clone the project
git clone <repo-url>
cd mis-redes-sociales

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Start the full stack
docker-compose up -d

# Frontend: http://localhost:7795
# Backend: http://localhost:8000
# Agnes: http://localhost:8765
```

## 📚 Documentation

- [SPEC-001: Social Media Content Engine](docs/specs/SPEC-001-social-media-engine.md) — Architecture and requirements
- [SPEC-002: AI Prompt Amplifier](docs/specs/SPEC-002-ai-prompt-amplifier.md) — Pre-prompt engine design
- [TASK-001: AI Prompt Amplifier](docs/tasks/TASK-001-prompt-amplifier.md) — Implementation plan
- [TASK-003: Agnes Integration](docs/tasks/TASK-003-agnes-integration.md) — Video engine integration
- [TASK-005: WhatsApp Diffusion](docs/tasks/TASK-005-whatsapp-diffusion.md) — WhatsApp bot plan

## 🔧 AIEP Compliance

- **Package Manager**: pnpm only
- **Workflow**: SPEC → TASK → implementation → tests → QA → commit
- **Design**: Split-screen (MiNegocio style), CSS custom properties

## 🏗️ Architecture

```
mis-redes-sociales/
├── src/
│   ├── client/          # React frontend
│   └── server/          # FastAPI backend
│       ├── api/         # REST endpoints
│       └── core/        # AI clients, amplifiers, social clients
├── agnes-video-generator/  # Sub-service (cloned)
├── docker-compose.yml
└── docs/specs/
```

## 📄 License

MIT