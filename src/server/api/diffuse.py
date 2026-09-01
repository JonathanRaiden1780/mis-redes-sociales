"""API endpoints for manual diffusion - prepare messages for manual sharing."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from src.server.core.amplifier import amplify

router = APIRouter(prefix="/api/diffuse", tags=["diffuse"])


class DiffuseRequest(BaseModel):
    """Request to prepare manual diffusion content."""
    idea: str
    style_override: Optional[str] = None
    campaign_id: Optional[int] = None


class ManualDiffusionKit(BaseModel):
    """Complete kit for manual diffusion."""
    whatsapp_message: str
    telegram_message: str
    instagram_caption: str
    tiktok_caption: str
    facebook_post: str
    twitter_post: str
    text_overlay: str
    hashtags: str
    cta: str
    image_prompt: str
    video_script: str


@router.post("/prepare", response_model=ManualDiffusionKit)
async def prepare_manual_diffusion(request: DiffuseRequest) -> ManualDiffusionKit:
    """Prepare a complete manual diffusion kit from an idea.
    
    This works WITHOUT external APIs - just needs the idea.
    Returns formatted messages ready to copy-paste to any platform.
    """
    if not request.idea.strip():
        raise HTTPException(status_code=400, detail="Idea cannot be empty")

    result = amplify(request.idea, request.style_override)
    ap = result.amplified_prompt
    intent = result.intent

    # Build platform-specific messages
    whatsapp_msg = _build_whatsapp(result)
    telegram_msg = _build_telegram(result)
    instagram_caption = _build_instagram(result)
    tiktok_caption = _build_tiktok(result)
    facebook_post = _build_facebook(result)
    twitter_post = _build_twitter(result)

    return ManualDiffusionKit(
        whatsapp_message=whatsapp_msg,
        telegram_message=telegram_msg,
        instagram_caption=instagram_caption,
        tiktok_caption=tiktok_caption,
        facebook_post=facebook_post,
        twitter_post=twitter_post,
        text_overlay=ap.text_overlay,
        hashtags=" ".join(ap.hashtags),
        cta=intent.cta,
        image_prompt=ap.image_prompt,
        video_script=_format_video_script(ap.video_script),
    )


def _build_whatsapp(result) -> str:
    """Build WhatsApp message."""
    ap = result.amplified_prompt
    intent = result.intent
    lines = [
        f"🔥 {ap.text_overlay}",
        "",
        f"📢 {intent.cta}",
        "",
        "━━━━━━━━━━━━━━━━━",
        "📲 ¡Pide el tuyo ahora!",
    ]
    if ap.hashtags:
        lines.append("")
        lines.append(" ".join(ap.hashtags[:5]))
    return "\n".join(lines)


def _build_telegram(result) -> str:
    """Build Telegram message."""
    ap = result.amplified_prompt
    intent = result.intent
    lines = [
        f"🔥 *{ap.text_overlay}*",
        "",
        f"📢 _{intent.cta}_",
        "",
        "━━━━━━━━━━━━━━━━━",
        "📲 ¡Pide el tuyo ahora!",
    ]
    if ap.hashtags:
        lines.append("")
        lines.append(" ".join(ap.hashtags[:5]))
    return "\n".join(lines)


def _build_instagram(result) -> str:
    """Build Instagram caption."""
    ap = result.amplified_prompt
    intent = result.intent
    lines = [
        f"✨ {ap.text_overlay}",
        "",
        f"🔥 {intent.cta}",
        "",
        "👉 Desliza para ver más",
        "👉 Link en bio",
    ]
    if ap.hashtags:
        lines.append("")
        lines.append(" ".join(ap.hashtags))
    return "\n".join(lines)


def _build_tiktok(result) -> str:
    """Build TikTok caption."""
    ap = result.amplified_prompt
    intent = result.intent
    lines = [
        f"🔥 {ap.text_overlay}",
        f"⚡ {intent.cta}",
    ]
    if ap.hashtags:
        lines.append("")
        lines.append(" ".join(ap.hashtags[:4]))
    return "\n".join(lines)


def _build_facebook(result) -> str:
    """Build Facebook post."""
    ap = result.amplified_prompt
    intent = result.intent
    lines = [
        f"🎉 {ap.text_overlay}",
        "",
        f"¡Atención! {intent.cta}",
        "",
        "✅ Calidad premium",
        "✅ Precios imbatibles",
        "✅ Envío inmediato",
        "",
        "📩 Escríbenos por DM para más info",
    ]
    if ap.hashtags:
        lines.append("")
        lines.append(" ".join(ap.hashtags[:5]))
    return "\n".join(lines)


def _build_twitter(result) -> str:
    """Build Twitter/X post."""
    ap = result.amplified_prompt
    intent = result.intent
    lines = [
        f"🔥 {ap.text_overlay}",
        f"⚡ {intent.cta}",
    ]
    if ap.hashtags:
        lines.append(" ".join(ap.hashtags[:3]))
    return "\n".join(lines)


def _format_video_script(video_script: list) -> str:
    """Format video script for display."""
    if not video_script:
        return ""
    lines = []
    for scene in video_script:
        time = scene.get("time", "")
        desc = scene.get("description", "")
        lines.append(f"[{time}] {desc}")
    return "\n".join(lines)