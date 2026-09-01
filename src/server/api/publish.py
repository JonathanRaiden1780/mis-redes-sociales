"""API endpoints for multi-platform publishing (Instagram, TikTok, Facebook)."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from src.server.core.social_clients import (
    InstagramClient,
    TikTokClient,
    FacebookClient,
    PublishResult,
)

router = APIRouter(prefix="/api/publish", tags=["publish"])


class PublishRequest(BaseModel):
    """Request to publish content."""
    campaign_id: int
    platform: str  # instagram, tiktok, facebook
    content_url: str = ""
    caption: str = ""
    content_type: str = "image"  # image, video


class PublishResponse(BaseModel):
    """Response from publish operation."""
    success: bool
    post_id: str = ""
    error: str = ""
    platform: str = ""


# Client instances (configured via environment variables)
_clients: dict[str, any] = {}


def _get_client(platform: str):
    """Get or create a social media client."""
    if platform not in _clients:
        import os
        if platform == "instagram":
            token = os.getenv("INSTAGRAM_ACCESS_TOKEN", "")
            account_id = os.getenv("INSTAGRAM_ACCOUNT_ID", "")
            if token and account_id:
                _clients[platform] = InstagramClient(token, account_id)
        elif platform == "tiktok":
            token = os.getenv("TIKTOK_ACCESS_TOKEN", "")
            app_key = os.getenv("TIKTOK_APP_KEY", "")
            app_secret = os.getenv("TIKTOK_APP_SECRET", "")
            if token and app_key and app_secret:
                _clients[platform] = TikTokClient(token, app_key, app_secret)
        elif platform == "facebook":
            token = os.getenv("FACEBOOK_ACCESS_TOKEN", "")
            page_id = os.getenv("FACEBOOK_PAGE_ID", "")
            if token and page_id:
                _clients[platform] = FacebookClient(token, page_id)
    return _clients.get(platform)


def _get_db():
    """Get a database session."""
    from src.server.database import SessionLocal
    return SessionLocal()


@router.post("/{platform}", response_model=PublishResponse)
async def publish_to_platform(platform: str, request: PublishRequest) -> PublishResponse:
    """Publish content to a social media platform."""
    client = _get_client(platform)
    if client is None:
        return PublishResponse(
            success=False,
            error=f"{platform.title()} no configurado. Configura las variables de entorno necesarias.",
            platform=platform,
        )
    
    try:
        # Get campaign content if not provided
        caption = request.caption
        content_url = request.content_url
        
        if not caption or not content_url:
            db = _get_db()
            try:
                from src.server.models.database import Campaign
                campaign = db.query(Campaign).filter(Campaign.id == request.campaign_id).first()
                if not campaign:
                    raise HTTPException(status_code=404, detail="Campaign not found")
                caption = caption or campaign.amplified_prompt
            finally:
                db.close()
        
        # Publish based on platform
        result: PublishResult | None = None
        
        if platform == "instagram":
            if request.content_type == "video":
                result = await client.publish_story(video_url=content_url, caption=caption)
            else:
                result = await client.publish_post(image_url=content_url, caption=caption)
        
        elif platform == "tiktok":
            result = await client.publish_video(
                video_url=content_url,
                caption=caption,
            )
        
        elif platform == "facebook":
            if request.content_type == "video":
                result = await client.publish_video(
                    video_url=content_url,
                    caption=caption,
                )
            else:
                result = await client.publish_photo(
                    image_url=content_url,
                    caption=caption,
                )
        
        if result is None:
            return PublishResponse(
                success=False,
                error=f"Plataforma {platform} no soportada",
                platform=platform,
            )
        
        return PublishResponse(
            success=result.success,
            post_id=result.post_id or "",
            error=result.error or "",
            platform=platform,
        )
    
    except Exception as e:
        return PublishResponse(
            success=False,
            error=str(e),
            platform=platform,
        )


@router.get("/config")
async def get_publish_config() -> dict:
    """Get publishing configuration status."""
    import os
    return {
        "instagram": {
            "configured": bool(os.getenv("INSTAGRAM_ACCESS_TOKEN") and os.getenv("INSTAGRAM_ACCOUNT_ID")),
            "account_id": os.getenv("INSTAGRAM_ACCOUNT_ID", "")[:8] + "..." if os.getenv("INSTAGRAM_ACCOUNT_ID") else "",
        },
        "tiktok": {
            "configured": bool(os.getenv("TIKTOK_ACCESS_TOKEN") and os.getenv("TIKTOK_APP_KEY")),
            "app_key": os.getenv("TIKTOK_APP_KEY", "")[:8] + "..." if os.getenv("TIKTOK_APP_KEY") else "",
        },
        "facebook": {
            "configured": bool(os.getenv("FACEBOOK_ACCESS_TOKEN") and os.getenv("FACEBOOK_PAGE_ID")),
            "page_id": os.getenv("FACEBOOK_PAGE_ID", "")[:8] + "..." if os.getenv("FACEBOOK_PAGE_ID") else "",
        },
    }