"""Platform adapter: format prompts per social media platform."""

from dataclasses import dataclass, field
from typing import Any

from .prompt_builder import AmplifiedPrompt


@dataclass
class PlatformPrompt:
    platform: str
    prompt: str
    format: str
    hashtags: list[str] = field(default_factory=list)
    character_limit: int | None = None
    additional_params: dict[str, Any] = field(default_factory=dict)


_PLATFORM_DEFAULTS: dict[str, dict[str, Any]] = {
    "instagram": {
        "format": "9:16",
        "character_limit": 2200,
        "additional_params": {
            "media_type": "STORIES",
            "aspect_ratio": "9:16",
        },
    },
    "tiktok": {
        "format": "9:16",
        "character_limit": 2200,
        "additional_params": {
            "media_type": "VIDEO",
            "aspect_ratio": "9:16",
            "auto_add_music": True,
        },
    },
    "facebook": {
        "format": "16:9",
        "character_limit": 63206,
        "additional_params": {
            "media_type": "IMAGE",
            "aspect_ratio": "16:9",
        },
    },
    "whatsapp": {
        "format": "1:1",
        "character_limit": 4096,
        "additional_params": {
            "media_type": "IMAGE",
            "aspect_ratio": "1:1",
        },
    },
}


def adapt_for_platform(prompt: AmplifiedPrompt, platform: str) -> PlatformPrompt:
    """Adapt the amplified prompt for a specific platform."""
    defaults = _PLATFORM_DEFAULTS.get(platform, _PLATFORM_DEFAULTS["instagram"])

    platform_prompt = prompt.platform_prompts.get(platform, prompt.image_prompt)
    hashtags = list(prompt.hashtags)

    # Platform-specific hashtag additions
    _PLATFORM_HASHTAGS = {
        "instagram": ["#Instagram", "#InstagramES", "#Historias"],
        "tiktok": ["#TikTok", "#ParaTi", "#FYP", "#Viral"],
        "facebook": ["#Facebook", "#OfertasFacebook", "#Comunidad"],
        "whatsapp": [],
    }
    hashtags.extend(_PLATFORM_HASHTAGS.get(platform, []))

    # Character-based truncation for platform limits
    if defaults["character_limit"]:
        platform_prompt = truncate_to_limit(
            platform_prompt, defaults["character_limit"]
        )

    return PlatformPrompt(
        platform=platform,
        prompt=platform_prompt,
        format=defaults["format"],
        hashtags=hashtags,
        character_limit=defaults["character_limit"],
        additional_params=defaults["additional_params"],
    )


def adapt_for_all_platforms(prompt: AmplifiedPrompt) -> dict[str, PlatformPrompt]:
    """Adapt prompt for all supported platforms."""
    result: dict[str, PlatformPrompt] = {}
    for platform in ["instagram", "tiktok", "facebook", "whatsapp"]:
        result[platform] = adapt_for_platform(prompt, platform)
    return result


def truncate_to_limit(text: str, limit: int) -> str:
    """Truncate text to fit within character limit."""
    if len(text) <= limit:
        return text
    return text[: limit - 3] + "..."


def build_diffusion_message(prompt: AmplifiedPrompt) -> str:
    """Build a concise WhatsApp diffusion message from amplified prompt."""
    parts = [f"🔥 {prompt.text_overlay}"]
    if prompt.cta:
        parts.append(f"📩 {prompt.cta}")
    if prompt.hashtags:
        parts.append(" ".join(prompt.hashtags[:5]))
    return "\n".join(parts)
