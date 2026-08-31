---
name: mis-redes-sociales
description: "Social media content engine — multi-platform publishing with AI content generation and WhatsApp diffusion."
tags: [aiep, project-init, compliance]
---

# Mis Redes Sociales — Social Media Content Engine

## Overview

A multi-platform social media content engine that transforms simple promotional ideas into publishing-ready content (images + videos) and distributes them across Instagram, TikTok, Facebook, and WhatsApp (diffusion).

## Core Features

1. **AI Prompt Amplifier**: Raw idea → structured, trend-optimized prompt
2. **Content Generation**: Images and videos via Agnes Video Generator (free, self-hosted)
3. **Multi-Platform Publishing**: Instagram, TikTok, Facebook, WhatsApp
4. **WhatsApp Diffusion**: Broadcast offers/promotions to contacts
5. **Iterative Refinement**: Adjust pre-prompt → regenerate until satisfied

## Tech Stack

- **Backend**: FastAPI (Python)
- **Frontend**: React + Tailwind + pnpm
- **AI Video/Image**: Agnes Video Generator (free, self-hosted on NAS)
- **Agentic Video (optional)**: ViMax (Gemini-based agentic pipeline)
- **WhatsApp**: Twilio WhatsApp Business API
- **Platform APIs**: Meta Graph API + TikTok Content Posting API + Zernio aggregator
- **Database**: SQLite / PostgreSQL
- **Infrastructure**: Docker Compose on NAS (linux/arm64)
- **Package Manager**: pnpm only

## Project Structure

```
mis-redes-sociales/
├── src/
│   ├── client/                    # React frontend
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── App.jsx
│   │   └── styles.css
│   ├── server/                    # FastAPI backend
│   │   ├── api/
│   │   │   ├── campaigns.py
│   │   │   ├── content.py
│   │   │   ├── publish.py
│   │   │   ├── whatsapp.py
│   │   │   └── prompt_amplifier.py
│   │   ├── core/
│   │   │   ├── agnes_client.py
│   │   │   ├── prompt_amplifier/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── parser.py
│   │   │   │   ├── intent_analyzer.py
│   │   │   │   ├── prompt_builder.py
│   │   │   │   └── platform_adapter.py
│   │   │   └── social_clients/
│   │   │       ├── instagram.py
│   │   │       ├── tiktok.py
│   │   │       └── facebook.py
│   │   ├── models/
│   │   └── main.py
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── agnes-video-generator/           # Sub-service (cloned)
└── docs/
    └── specs/
        ├── SPEC-001-social-media-engine.md
        └── SPEC-002-ai-prompt-amplifier.md
```

## Commands

```bash
# Install
pnpm install          # frontend
pip install -r requirements.txt

# Run
pnpm dev              # frontend on port 7795
uvicorn main:app      # backend on port 8000

# Agnes Video Generator (sub-service)
cd agnes-video-generator && ./start.sh

# Full stack
docker-compose up -d
```

## AIEP Compliance

- **Package Manager**: pnpm only
- **Workflow**: SPEC → TASK → implementation → tests → QA → commit
- **Documentation**: README.md, ARCHITECTURE.md, ROADMAP.md, docs/specs/
- **No Co-authored-by** trailers
- **Design**: Split-screen auth (MiNegocio style), CSS custom properties
- **Zero-friction onboarding**: Guest access

## Platform API Notes

### Instagram
- Graph API for business/creator accounts
- Stories: `media_type: STORIES`, `image_url` or `video_url`
- Limit: 100 API-published posts per 24h period
- Container-based: create container → wait for FINISHED → publish

### TikTok
- Content Posting API (official, no paid tier)
- `media_type: PHOTO` or `VIDEO`
- `source_info.source: PULL_FROM_URL` for URL-based uploads
- App audit required for non-sandbox posting
- Alternative: Zernio API as multi-platform aggregator

### Facebook
- Meta Graph API (same ecosystem as Instagram)
- Page access token required
- Can post to Facebook Page or linked Instagram

### WhatsApp
- Twilio WhatsApp Business API for programmatic sending
- Template messages required for outbound
- Opt-in required from recipients
- Sandbox available for testing

## Status

- [x] SPEC-001: Social Media Content Engine (architecture + requirements)
- [x] SPEC-002: AI Prompt Amplifier (spec)
- [ ] TASK-001: AI Prompt Amplifier implementation
- [ ] TASK-002: Content generation (Agnes integration)
- [ ] TASK-003: Multi-platform publishing
- [ ] TASK-004: WhatsApp diffusion bot
- [ ] TASK-005: WebApp UI
- [ ] QA + commit + deploy

## Open Questions

1. Agnes AI API key — free tier sufficient for video generation?
2. ViMax requires Gemini API key — budgeted?
3. Twilio account for WhatsApp sandbox
4. Instagram business account setup
5. TikTok Content Posting API app audit