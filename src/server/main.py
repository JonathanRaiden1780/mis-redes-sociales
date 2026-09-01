"""FastAPI main application entry point."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.server.core.amplifier import AmplificationResult, amplify
from src.server.database import init_db
from src.server.api.campaigns import router as campaigns_router
from src.server.api.generate import router as generate_router
from src.server.api.diffuse import router as diffuse_router

# Initialize database
init_db()

app = FastAPI(title="Mis Redes Sociales API", version="0.1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(campaigns_router)
app.include_router(generate_router)
app.include_router(diffuse_router)


class AmplifyRequest(BaseModel):
    idea: str
    style_override: str | None = None
    save_campaign: bool = False
    campaign_name: str | None = None


class AmplifyResponse(BaseModel):
    success: bool
    campaign_id: int | None = None
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

    # Optionally save as campaign
    campaign_id = None
    if request.save_campaign:
        from src.server.database import SessionLocal
        from src.server.models.database import Campaign
        db = SessionLocal()
        try:
            campaign = Campaign(
                name=request.campaign_name or f"Campaign: {request.idea[:30]}...",
                raw_idea=request.idea,
                amplified_prompt=ap.image_prompt,
                sale_type=result.intent.sale_type,
                emotion=result.intent.emotion,
                tone=result.intent.tone,
                style=ap.style,
                cta=result.intent.cta,
                text_overlay=ap.text_overlay,
                color_palette=ap.color_palette,
                hashtags=ap.hashtags,
                psychological_triggers=result.intent.psychological_triggers,
                platforms=list(result.platform_prompts.keys()),
                diffusion_message=result.diffusion_message,
            )
            db.add(campaign)
            db.commit()
            db.refresh(campaign)
            campaign_id = campaign.id
        finally:
            db.close()

    return AmplifyResponse(
        success=True,
        campaign_id=campaign_id,
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
        "formats": {"instagram": "9:16", "tiktok": "9:16", "facebook": "16:9", "whatsapp": "1:1"},
    }


@app.get("/api/categories")
async def get_categories() -> dict:
    """List available product categories."""
    return {
        "categories": [
            "perfumes", "moda", "electrónica", "belleza", "hogar",
            "deportes", "alimentación", "viajes", "tecnología",
        ],
    }