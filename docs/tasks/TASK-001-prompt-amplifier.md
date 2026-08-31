# TASK-001: AI Prompt Amplifier Implementation

## Scope

Implement SPEC-002: the pre-prompt engine that transforms raw ideas into structured, trend-optimized prompts for image/video generation and social media publishing.

## Tasks

### 1. Set up project skeleton
- Create `mis-redes-sociales/` directory structure
- `src/server/core/amplifier/` with all modules
- `requirements.txt` (FastAPI, httpx, pydantic, pytest, ruff, black, mypy)
- `pyproject.toml` with pnpm reference
- Docker Compose base

### 2. Implement prompt parser
- `src/server/core/amplifier/parser.py`
- Extract key entities: product type, offer details, price, intent keywords
- Regex + LLM fallback for entity extraction
- Input: raw text idea → Output: structured dict

### 3. Implement intent analyzer
- `src/server/core/amplifier/intent_analyzer.py`
- Classify sale type (bundle, discount, clearance, new launch, flash sale)
- Detect urgency cues
- Detect emotion/brand tone
- Output: intent classification + suggested psychological triggers

### 4. Implement prompt builder
- `src/server/core/amplifier/prompt_builder.py`
- System prompt with few-shot examples per category
- Build image generation prompt (scene, lighting, colors, text overlay, style)
- Build video script (scene-by-scene with timing)
- Build hashtag strategy
- Build CTA
- Input: parsed idea + intent → Output: structured prompt

### 5. Implement platform adapter
- `src/server/core/amplifier/platform_adapter.py`
- Instagram adapter (9:16, bold text, hooks)
- TikTok adapter (fast-paced, trending cues)
- Facebook adapter (wider, community tone)
- WhatsApp adapter (concise text + image layout)
- Input: base prompt + platform → Output: platform-specific version

### 6. Implement CLI/API endpoint
- `src/server/api/prompt_amplifier.py` — FastAPI endpoint
- POST `/api/amplify` — takes idea, returns amplified prompt
- POST `/api/amplify/preview` — returns preview without generating
- GET `/api/amplify/categories` — list available category templates

### 7. Tests
- `tests/unit/test_parser.py`
- `tests/unit/test_intent_analyzer.py`
- `tests/unit/test_prompt_builder.py`
- `tests/unit/test_platform_adapter.py`
- All tests use fakes/mocks — no real LLM calls
- Test edge cases: empty input, non-Spanish input, very long input

### 8. Integration with Agnes
- Wire amplified prompt to Agnes Video Generator API client
- Test end-to-end: idea → amplified prompt → Agnes generate

### 9. QA + commit
- ruff, black, mypy, pytest
- Update ROADMAP.md
- Commit

## Acceptance Criteria
- All 5 amplifier modules implemented
- 20+ unit tests
- ruff + black + mypy clean
- End-to-end: raw idea → amplified prompt generated
- API endpoint working

## Dependencies
- FastAPI
- LLM provider (Nous free tier or Ollama)
- Agnes AI API key