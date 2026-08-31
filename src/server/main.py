"""FastAPI main application entry point."""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from src.server.core.amplifier import AmplificationResult, amplify

app = FastAPI(title="Mis Redes Sociales API", version="0.1.0")


class AmplifyRequest(BaseModel):
    idea: str
    style_override: str | None = None


class AmplifyResponse(BaseModel):
    success: bool
    amplified_prompt: str
    image_prompt: str
    video_script: list[dict]
    hashtags: list[str]
    cta: str
    color_palette: list[str]
    style: str
    text_overlay: str
    platform_prompts: dict[str, dict]
    diffusion_message: str
    sale_type: str
    emotion: str
    tone: str
    psychological_triggers: list[str]


@app.post("/api/amplify", response_model=AmplifyResponse)
async def amplify_prompt(request: AmplifyRequest) -> AmplifyResponse:
    """Amplify a raw idea into a structured, platform-ready prompt."""
    if not request.idea.strip():
        raise HTTPException(status_code=400, detail="Idea cannot be empty")

    result: AmplificationResult = amplify(request.idea, request.style_override)
    ap = result.amplified_prompt
    platform_dict = {
        k: {
            "prompt": v.prompt,
            "format": v.format,
            "hashtags": v.hashtags,
            "additional_params": v.additional_params,
        }
        for k, v in result.platform_prompts.items()
    }

    return AmplifyResponse(
        success=True,
        amplified_prompt=ap.image_prompt,
        image_prompt=ap.image_prompt,
        video_script=ap.video_script,
        hashtags=ap.hashtags,
        cta=ap.cta,
        color_palette=ap.color_palette,
        style=ap.style,
        text_overlay=ap.text_overlay,
        platform_prompts=platform_dict,
        diffusion_message=result.diffusion_message,
        sale_type=result.intent.sale_type,
        emotion=result.intent.emotion,
        tone=result.intent.tone,
        psychological_triggers=result.intent.psychological_triggers,
    )


@app.get("/api/health")
async def health() -> dict:
    """Health check."""
    return {"status": "ok", "service": "mis-redes-sociales"}


@app.get("/api/platforms")
async def get_platforms() -> dict:
    """List supported platforms."""
    return {
        "platforms": ["instagram", "tiktok", "facebook", "whatsapp"],
        "formats": {
            "instagram": "9:16",
            "tiktok": "9:16",
            "facebook": "16:9",
            "whatsapp": "1:1",
        },
    }


@app.get("/api/categories")
async def get_categories() -> dict:
    """List available product categories."""
    return {
        "categories": [
            "perfumes",
            "moda",
            "electrónica",
            "belleza",
            "hogar",
            "deportes",
            "alimentación",
            "viajes",
            "tecnología",
        ],
    }
