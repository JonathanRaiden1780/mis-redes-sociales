# SPEC-001: Social Media Content Engine

## Objective

Build a multi-platform social media content engine that lets the user create promotional content (images + videos), publish to Instagram Stories/Feed, Facebook, TikTok, and WhatsApp (diffusion), and use AI to amplify prompts for trend/sale intent. The user provides a simple idea like "promoción de perfumes 2x800 pesos" and the system generates publishing-ready content.

## What It Does

1. **Content creation**: User provides a simple promotional idea. System generates images (with optional product photo as base) and videos using Agnes Video Generator (primary) and optionally ViMax (agentic pipeline).
2. **AI Prompt Amplifier**: A "pre-prompt" engine that takes a raw idea and expands it into a structured, intent-rich prompt optimized for viral reach, sale intent, and audience targeting — then feeds it to the image/video generator.
3. **Multi-platform publishing**: Publish generated media to Instagram (Stories + Feed), TikTok, Facebook, and WhatsApp (broadcast diffusion for offers/promotions).
4. **Video editing assistant**: If user already has a video, the system edits it according to the pre-prompt details (subtitles, cuts, transitions, overlay text).
5. **Iterative refinement**: If the AI output isn't right, user can re-run with adjusted pre-prompt until satisfied.

## For Whom

A social media manager or small business owner who creates promotional content for multiple platforms without wanting to manually create and post to each one.

## Tech Stack

- **Backend**: Python (FastAPI) — NAS-compatible, pnpm only for frontend
- **Frontend**: React + Tailwind (split-screen app style, matching MiNegocio/PlayScore patterns)
- **AI Video**: Agnes Video Generator (text-to-video, image-to-video, keyframes, TTS narration, subtitles) — free, self-hosted
- **Agentic Video (optional)**: ViMax — Director/Screenwriter/Producer pipeline for more complex videos
- **WhatsApp**: Twilio WhatsApp Business API (or WhatsApp Business API directly)
- **Instagram/TikTok/Facebook**: Meta Graph API + TikTok Content Posting API + Zernio multi-platform posting API as aggregator
- **Image generation**: Agnes AI image models (free tier) + user-provided product photos as base
- **Database**: SQLite (local) or PostgreSQL (NAS) — to store campaigns, content history, schedules
- **Infrastructure**: Docker Compose on NAS (linux/arm64), Portainer deployable
- **Package manager**: pnpm only

## Architecture

```
social-media-engine/
├── src/
│   ├── client/                    # React frontend
│   │   ├── components/            # Reusable UI
│   │   │   ├── CampaignForm/      # Idea input + pre-prompt
│   │   │   ├── MediaPreview/      # Image/video preview
│   │   │   ├── PlatformSelector/  # Multi-platform checkboxes
│   │   │   ├── WhatsAppPanel/     # Diffusion message composer
│   │   │   └── SchedulePanel/     # Schedule posts
│   │   ├── pages/                 # Login, Dashboard, Create, Campaigns
│   │   ├── hooks/                 # useCreateContent, usePublish, etc.
│   │   ├── App.jsx
│   │   └── styles.css
│   ├── server/                    # FastAPI backend
│   │   ├── api/
│   │   │   ├── campaigns.py       # CRUD campaigns
│   │   │   ├── content.py         # Generate images/videos
│   │   │   ├── publish.py         # Multi-platform publish
│   │   │   ├── whatsapp.py        # WhatsApp diffusion
│   │   │   └── prompt_amplifier.py # AI pre-prompt engine
│   │   ├── core/
│   │   │   ├── agnes_client.py    # Agnes Video Generator API client
│   │   │   ├── vimax_client.py    # ViMax pipeline client (optional)
│   │   │   ├── prompt_amplifier.py # LLM-based prompt amplification
│   │   │   ├── social_clients/    # Platform API clients
│   │   │   │   ├── instagram.py
│   │   │   │   ├── tiktok.py
│   │   │   │   ├── facebook.py
│   │   │   │   └── whatsapp.py
│   │   │   └── media_processing/  # Image/video editing
│   │   │       ├── image_editor.py
│   │   │       └── video_editor.py
│   │   ├── models/                # DB models
│   │   └── main.py
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
└── docs/
    └── specs/
        └── SPEC-001-social-media-engine.md
```

## Data Model

### Campaign
- `id` (UUID)
- `user_id` (str)
- `idea` (text) — raw user input ("promoción de perfumes 2x800 pesos")
- `amplified_prompt` (text) — AI-amplified prompt
- `promotion_details` (JSON) — price, discount, products, expiry date, etc.
- `created_at`, `updated_at`, `scheduled_at`

### GeneratedContent
- `id` (UUID)
- `campaign_id` (FK)
- `type` (image | video)
- `source` (agnes | vimax | user_upload)
- `input_path` (original file, if user uploaded)
- `output_path` (generated file)
- `prompt_used` (text)
- `status` (pending | generating | done | failed | needs_rework)
- `metadata` (JSON — resolution, duration, platform-specific settings)

### PublishedPost
- `id` (UUID)
- `content_id` (FK)
- `platform` (instagram | tiktok | facebook | whatsapp)
- `platform_post_id` (str)
- `status` (scheduled | published | failed)
- `published_at`

### WhatsAppDiffusion
- `id` (UUID)
- `campaign_id` (FK)
- `message_template` (text)
- `recipients` (list of phone numbers or group)
- `status` (pending | sent | failed)
- `sent_at`

## Commands

```bash
# Backend
pnpm install        # (frontend)
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000

# Agnes Video Generator (sub-service)
cd agnes-video-generator && ./start.sh

# Full stack via Docker
docker-compose up -d
```

## Project Structure

```
src/client/
├── components/
│   ├── CampaignForm/        # Idea input + AI pre-prompt display
│   ├── MediaPreview/        # Image/video preview with re-run option
│   ├── PlatformSelector/    # Checkboxes: Instagram, TikTok, Facebook, WhatsApp
│   ├── WhatsAppPanel/       # Diffusion message composer + recipient list
│   └── SchedulePanel/       # Date/time picker for scheduled publishing
├── pages/
│   ├── LoginPage.jsx        # Auth (Google + email, matching MiNegocio)
│   ├── Dashboard.jsx        # Campaign list + quick create
│   ├── CreatePage.jsx       # Main creation flow
│   └── CampaignsPage.jsx    # History + published posts
├── hooks/
│   ├── useCampaign.ts
│   ├── useContentGen.ts
│   ├── usePublish.ts
│   └── useWhatsApp.ts
├── App.jsx
└── styles.css
```

## Code Style

- React components: small, focused, reusable
- CSS custom properties for design tokens
- Tailwind for utilities, custom CSS for design tokens
- Split-screen for login/auth pages (MiNegocio style)
- No emoji decoration, no glassmorphism without reason
- Google Sign-In button: SVG `width="14" height="14"`, `gap-3`, bordered white bg

## Testing Strategy

- Unit tests for prompt_amplifier, social_clients (mocked API responses)
- Integration tests for campaign creation → content generation → publish flow
- Test with fakes/mocks — no real API calls in tests
- pytest + ruff + black + mypy

## Boundaries

- **Always do**: Generate content from user idea, amplify prompts, publish to platforms, WhatsApp diffusion, store campaigns
- **Ask first**: Platform-specific ad spend, using paid AI model tiers, storing recipient phone numbers
- **Never do**: Store platform credentials in code, commit secrets, use npm instead of pnpm, hardcode API keys

## Acceptance Criteria

1. User can input a simple idea ("promoción de perfumes 2x800 pesos") and get an amplified prompt back
2. System generates an image or video from the amplified prompt using Agnes
3. User can upload a product photo and the system enhances it with text/overlay
4. User can select multiple platforms and publish generated content
5. WhatsApp diffusion sends broadcast messages with offer details
6. If output isn't right, user can adjust the pre-prompt and re-generate
7. All campaigns stored in database with full history
8. Docker Compose deploys cleanly on NAS (arm64)
9. Tests pass, ruff + black + mypy clean

## Out of Scope (Phase 1)

- Multiple user accounts / multi-tenancy (single user first)
- Analytics/insights on post performance
- Scheduling (can add in Phase 2)
- Facebook native posting API (use Zernio aggregator or manual)
- Advanced video editing beyond Agnes/ViMax capabilities
- Mobile app

## Open Questions

1. Agnes API key — is the free tier sufficient? Does it require the cloud API or can it run fully self-hosted?
2. ViMax dependency — Gemini API key needed for agentic pipeline. Is this budgeted?
3. WhatsApp — Twilio sandbox for testing, then WhatsApp Business API for production. Need Twilio account SID + auth token.
4. Instagram Stories — Graph API may not support programmatic Stories posting for all account types. Need to verify business account requirement.
5. TikTok — Content Posting API requires app audit. Alternative: Zernio API as aggregator.

## Success Criteria

The feature is successful when:
- A user can go from idea to published content on 2+ platforms in under 10 minutes
- Generated content looks professional and intentional (trend-optimized, sale-focused)
- WhatsApp diffusion works reliably for offer broadcasts
- The iterative refinement loop (adjust prompt → regenerate) feels fast and predictable
- All tests pass, QA gate is green, deployable via Docker Compose on NAS
