# TASK-004: ViMax Agentic Video Pipeline (Optional)

## Scope

Integrate ViMax as an optional agentic video pipeline for more complex, multi-scene video content.

## ViMax Overview

ViMax is an agentic video generation framework that orchestrates:
1. **Director** — Overall creative direction
2. **Screenwriter** — Script generation
3. **Producer** — Scene production coordination
4. **Video Generator** — Final video assembly

Uses Gemini API for AI capabilities. 12.2k stars on GitHub, MIT licensed.

## When to Use ViMax vs Agnes

- **Agnes**: Simple to medium videos, quick generation, free tier, self-hosted
- **ViMax**: Complex multi-scene narratives, cinematic quality, agent-directed

## Integration Approach

ViMax runs as a Python package. It's a separate process that we can call via subprocess or API.

### Setup
```bash
git clone https://github.com/HKUDS/ViMax.git
cd ViMax
uv sync
```

### API
ViMax provides a Python API:
```python
from vimax import ViMaxDirector

director = ViMaxDirector(api_key="gemini-key")
result = director.create_video(
    idea="promoción de perfumes 2x800 pesos",
    script="EXT. LUXURY STORE - DAY..."
)
```

## Files
- `src/server/core/vimax_client.py` — ViMax client wrapper
- Optional module — only loaded if Gemini API key configured

## Acceptance Criteria
- ViMax client module implemented
- Falls back gracefully if Gemini key not configured
- Can generate videos from scripts
- Documentation clear about Gemini API dependency