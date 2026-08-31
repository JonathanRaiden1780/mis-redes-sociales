"""Prompt builder: construct structured prompts for image/video generation."""

from dataclasses import dataclass, field

from .intent_analyzer import IntentAnalysis
from .parser import ParsedIdea


@dataclass
class AmplifiedPrompt:
    image_prompt: str = ""
    video_script: list[dict] = field(default_factory=list)
    hashtags: list[str] = field(default_factory=list)
    cta: str = ""
    color_palette: list[str] = field(default_factory=list)
    style: str = "cinematic"
    text_overlay: str = ""
    platform_prompts: dict[str, str] = field(default_factory=dict)


_COLOR_PALETTES = {
    "luxury": ["#1a1a2e", "#16213e", "#e2b714", "#c9a227", "#f5e6ca"],
    "premium": ["#0d0d0d", "#2c2c2c", "#d4af37", "#f0e68c", "#1a1a1a"],
    "elegant": ["#2c3e50", "#4a6fa5", "#c9a96e", "#f5f0e8", "#1a1a2e"],
    "budget": ["#27ae60", "#2ecc71", "#f39c12", "#ffffff", "#ecf0f1"],
    "trending": ["#6c5ce7", "#a29bfe", "#fd79a8", "#00cec9", "#0984e3"],
    "hot": ["#e74c3c", "#e67e22", "#f1c40f", "#2c3e50", "#1a1a1a"],
}

_STYLE_MAP = {
    "luxury": "luxury cinematic style, deep shadows, golden light",
    "premium": "premium product photography, studio lighting",
    "elegant": "elegant minimalist design, soft natural light",
    "budget": "bold vibrant, energetic, high contrast",
    "trending": "trendy aesthetic, modern, clean design",
    "hot": "bold dramatic, fiery tones, high energy",
}


def build_prompt(
    parsed: ParsedIdea,
    intent: IntentAnalysis,
    style_override: str | None = None,
) -> AmplifiedPrompt:
    """Build a structured prompt from parsed idea and intent analysis."""
    style = style_override if style_override else intent.emotion
    palette = _COLOR_PALETTES.get(style, _COLOR_PALETTES["trending"])
    style_desc = _STYLE_MAP.get(style, "modern professional style")

    # Build text overlay
    price_text = f"{parsed.price} pesos" if parsed.price else ""
    offer_text = ""
    if parsed.offer_type == "bundle":
        offer_text = "2x800 PESOS" if parsed.price else "OFERTA ESPECIAL"
    elif parsed.offer_type == "percent_discount":
        offer_text = "DESCUENTO EXCLUSIVO"
    else:
        offer_text = "OFERTA ESPECIAL"

    text_overlay = f"{offer_text}"
    if price_text and "800" not in price_text:
        text_overlay += f" | {price_text}"

    # Build image prompt
    product = parsed.product_type or "producto"
    image_prompt = (
        f"{style_desc}, a promotional ad for {product}. "
        f"Color palette: {', '.join(palette[:3])}. "
        f"Bold text overlay at the bottom reading '{text_overlay}' "
        f"in gold foil font on dark background. "
        f"Vertical 9:16 format, high contrast, dramatic lighting. "
        f"Professional social media aesthetic, Instagram Stories format. "
        f"Mood: {intent.emotion}. Tone: {intent.tone}."
    )

    # Build video script (simple 3-scene)
    video_script = [
        {
            "time": "0-2s",
            "scene": "Hook",
            "description": f"Bold text: '¿Cuánto vale tu {product}?'",
        },
        {
            "time": "2-5s",
            "scene": "Offer",
            "description": f"Product reveal with text: '{offer_text}'",
        },
        {
            "time": "5-8s",
            "scene": "CTA",
            "description": f"Closing shot with CTA: '{intent.cta}'",
        },
    ]

    # Build hashtags
    hashtags = intent.suggested_hashtags + ["#Ofertas", "#Promo", "#Descuento"]

    # Platform prompts
    platform_prompts = {
        "instagram": (
            f"Vertical 9:16 Instagram Story. {image_prompt}. "
            f"Bold text overlay. Premium feel. High engagement."
        ),
        "tiktok": (
            f"Vertical 9:16 TikTok. Fast-paced. {image_prompt}. "
            f"Trending audio cues. Hook in first 2 seconds. "
            f"Text overlays for key offer details."
        ),
        "facebook": (
            f"Wider format 16:9 or 1:1. {image_prompt}. "
            f"Community tone. More descriptive text. "
            f"Suitable for Facebook page post."
        ),
        "whatsapp": (
            f"Square format 1:1. {image_prompt}. "
            f"Concise visual. Bold offer text. "
            f"Shareable for broadcast diffusion."
        ),
    }

    return AmplifiedPrompt(
        image_prompt=image_prompt,
        video_script=video_script,
        hashtags=hashtags,
        cta=intent.cta,
        color_palette=palette,
        style=style,
        text_overlay=text_overlay,
        platform_prompts=platform_prompts,
    )
