# SPEC-002: AI Prompt Amplifier

## Objective

Build the "pre-prompt" engine that transforms a raw, vague user idea into a structured, intent-rich, trend-optimized prompt for image/video generation and social media publishing.

## What It Does

Takes input like "promoción de perfumes 2x800 pesos" and produces:

1. **Structural prompt** — formatted prompt for AI image/video generation with:
   - Scene description (visual composition, lighting, mood)
   - Text overlay specifications (what text to display, font style, placement)
   - Color palette (brand colors, trending aesthetics)
   - Style reference (trend type: luxury, minimalist, bold, nostalgic, etc.)

2. **Marketing intent layer** — psychological triggers and sale optimization:
   - Scarcity cues ("2x800", "oferta limitada")
   - Social proof framing
   - CTA (call to action) placement
   - Hashtag strategy (trending + niche)

3. **Platform-native formatting** — each platform gets adapted output:
   - Instagram: vertical 9:16, bold text overlay, punchy hook
   - TikTok: fast-paced, trending audio cues, hook in first 2 seconds
   - Facebook: wider format, more descriptive, community tone
   - WhatsApp: concise text + image for broadcast

4. **Iterative refinement** — user can say "make it more luxury" or "change colors to warm tones" and the system re-amplifies.

## How It Works

### Input → Processing → Output

```
User idea: "promoción de perfumes 2x800 pesos"
    │
    ▼
┌─────────────────────┐
│  Parse & Extract    │  → Product: perfumes, Offer: 2x800, Intent: promotion
│  Key Entities       │
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  Intent Analysis    │  → Sale type: bundle deal, Target: perfume buyers,
│                     │     Urgency: limited offer, Emotion: excitement/value
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  Trend Research     │  → Current trending styles (via LLM knowledge)
│  (LLM-based)        │     Color trends, composition trends, hashtag trends
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  Prompt Amplification│  → Structured, detailed prompt
│  (LLM generation)   │     for image generation + video script + captions
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  Platform Adapter   │  → Platform-specific versions
│  (per platform)     │     Instagram version, TikTok version, etc.
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  Output             │  → amplified_prompt, platform_prompts,
│                     │     video_script, hashtags, cta
└─────────────────────┘
```

### Prompt Amplification Pattern

```
RAW: "promoción de perfumes 2x800 pesos"

AMPLIFIED (for image generation):
"A luxury perfume ad in cinematic style, deep gold and amber tones, 
two elegant perfume bottles side by side on a dark marble surface, 
golden light reflecting off the glass. Bold text overlay at the bottom 
reading '2x800 PESOS' in gold foil font with 'OFERTA ESPECIAL' above it. 
Dark moody background with subtle bokeh lights. Trendy luxury aesthetic, 
Instagram Stories format 9:16 vertical, high contrast, dramatic lighting."

AMPLIFIED (video script):
Scene 1 (0-2s): Close-up of perfume bottle, golden light, text appears: 
  "¿Cuánto vale tu confianza?" [hook]
Scene 2 (2-5s): Two bottles revealed, price tag animation: 
  "2x800 PESOS — Llévate 2 por el precio de 1"
Scene 3 (5-8s): Lifestyle shot, person spraying perfume, CTA:
  "Escribe 'QUERO' para más info" [WhatsApp CTA]

HASHTAGS: #Perfume #Ofertas #Lujo #2x800 #PromoDelDía #BellezaMX

PLATFORM ADAPTATIONS:
- Instagram: 9:16 vertical, bold text overlay, gold/amber palette
- TikTok: 9:16, faster cuts, trending audio style, text hooks
- WhatsApp: Image + text: "🔥 PERFUMES 🔥 2x800 pesos - 2 por el precio de 1. Escribe QUERO"
```

## LLM Integration

- Use the configured LLM provider (Nous/free model by default)
- The prompt amplifier is a structured system prompt + few-shot examples
- User can provide reference images for style calibration
- If user provides product photo, the prompt incorporates it as visual reference

## Iteration Loop

```
User: "makes it more luxury, warmer colors"
    │
    ▼
System: Re-amplifies with luxury + warm palette constraints
    │
    ▼
User previews → "this one is better" → publish
```

## Inputs/Outputs

### Input Schema
```json
{
  "idea": "promoción de perfumes 2x800 pesos",
  "product_type": "perfumes",
  "offer_details": { "deal": "2x800", "original_price": null, "expiry": null },
  "reference_image": "optional product photo URL/path",
  "style_override": "luxury",
  "platforms": ["instagram", "tiktok", "whatsapp"]
}
```

### Output Schema
```json
{
  "amplified_prompt": "...",
  "platform_prompts": {
    "instagram": "...",
    "tiktok": "...",
    "whatsapp": "..."
  },
  "video_script": [...],
  "hashtags": ["..."],
  "cta": "...",
  "color_palette": ["gold", "amber", "dark"],
  "text_overlay": "2x800 PESOS",
  "suggested_audio_style": "luxury ambient"
}
```

## Files

```
src/server/api/prompt_amplifier.py   # Main amplifier logic
src/server/core/amplifier/
├── __init__.py
├── parser.py          # Extract entities from raw idea
├── intent_analyzer.py # Sale intent, emotion, urgency
├── prompt_builder.py  # Build structured prompts
├── platform_adapter.py # Per-platform formatting
└── templates/         # Few-shot examples per category
```

## Acceptance Criteria

1. Raw idea → amplified prompt works end-to-end
2. Platform-specific outputs are correctly formatted
3. User can adjust and re-amplify
4. Reference images are incorporated into the prompt
5. Hashtag strategy is generated per platform
6. Video script is generated for video content
7. Tests cover parser, analyzer, builder, adapter
8. Works with the configured LLM provider (Nous/free or local Ollama fallback)

## Dependencies

- LLM provider configured in the system (Nous or Ollama)
- For video: Agnes Video Generator API
- For image: Agnes AI image generation API

## Open Questions

1. Which LLM model is best for prompt amplification? The free tier should suffice.
2. Should the prompt amplifier have category-specific templates (perfumes, fashion, electronics)?
3. How many few-shot examples to include in the system prompt?