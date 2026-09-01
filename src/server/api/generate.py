"""API endpoints for content generation with Agnes."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from src.server.core.agnes_client import AgnesClient, AgnesConfig, TaskStatus
from src.server.core.content_generator import ContentGenerationService, GenerationConfig

router = APIRouter(prefix="/api/generate", tags=["generate"])


class GenerateRequest(BaseModel):
    """Request to generate content."""
    campaign_id: int
    platform: str = "instagram"
    content_type: str = "image"  # image, video
    mode: str = "simple"  # simple, creative, manuscript, anchor


class GenerateResponse(BaseModel):
    """Response from generation request."""
    success: bool
    content_id: Optional[int] = None
    task_id: Optional[str] = None
    status: str = "pending"
    message: str = ""


# Global state for tracking tasks (in production, use a proper task queue)
_generation_tasks: dict[str, dict] = {}


@router.post("/image", response_model=GenerateResponse)
async def generate_image(request: GenerateRequest) -> GenerateResponse:
    """Generate an image from a campaign's amplified prompt."""
    try:
        service = ContentGenerationService()
        # Get campaign prompt
        from src.server.database import SessionLocal
        from src.server.models.database import Campaign, GeneratedContent
        
        db = SessionLocal()
        try:
            campaign = db.query(Campaign).filter(Campaign.id == request.campaign_id).first()
            if not campaign:
                raise HTTPException(status_code=404, detail="Campaign not found")
            
            # Get the platform-specific prompt
            platform_prompts = campaign.amplified_prompt
            if hasattr(campaign, 'platform_prompts') and campaign.platform_prompts:
                import json
                prompts = json.loads(campaign.platform_prompts) if isinstance(campaign.platform_prompts, str) else campaign.platform_prompts
                if request.platform in prompts:
                    platform_prompts = prompts[request.platform].get("prompt", campaign.amplified_prompt)
            
            # Generate image
            content = await service.generate_image(
                prompt=platform_prompts or campaign.amplified_prompt,
                platform=request.platform,
            )
            
            # Save to database
            db_content = GeneratedContent(
                campaign_id=request.campaign_id,
                content_type="image",
                platform=request.platform,
                prompt=platform_prompts or campaign.amplified_prompt,
                status="processing",
            )
            db.add(db_content)
            db.commit()
            db.refresh(db_content)
            
            # Track task
            _generation_tasks[content.content_id] = {
                "db_id": db_content.id,
                "campaign_id": request.campaign_id,
                "platform": request.platform,
            }
            
            return GenerateResponse(
                success=True,
                content_id=db_content.id,
                task_id=content.content_id,
                status="processing",
                message=f"Image generation started for {request.platform}",
            )
        finally:
            db.close()
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/video", response_model=GenerateResponse)
async def generate_video(request: GenerateRequest) -> GenerateResponse:
    """Generate a video from a campaign's amplified prompt."""
    try:
        service = ContentGenerationService()
        from src.server.database import SessionLocal
        from src.server.models.database import Campaign, GeneratedContent
        
        db = SessionLocal()
        try:
            campaign = db.query(Campaign).filter(Campaign.id == request.campaign_id).first()
            if not campaign:
                raise HTTPException(status_code=404, detail="Campaign not found")
            
            content = await service.generate_video(
                prompt=campaign.amplified_prompt,
                platform=request.platform,
                mode=request.mode,
            )
            
            # Save to database
            db_content = GeneratedContent(
                campaign_id=request.campaign_id,
                content_type="video",
                platform=request.platform,
                prompt=campaign.amplified_prompt,
                status="processing",
            )
            db.add(db_content)
            db.commit()
            db.refresh(db_content)
            
            _generation_tasks[content.content_id] = {
                "db_id": db_content.id,
                "campaign_id": request.campaign_id,
                "platform": request.platform,
            }
            
            return GenerateResponse(
                success=True,
                content_id=db_content.id,
                task_id=content.content_id,
                status="processing",
                message=f"Video generation started ({request.mode} mode)",
            )
        finally:
            db.close()
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{task_id}")
async def get_generation_status(task_id: str) -> dict:
    """Check the status of a generation task."""
    try:
        service = ContentGenerationService()
        content = await service.get_content_status(task_id)
        return {
            "task_id": task_id,
            "status": content.status,
            "result_url": content.result_url,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/content/{content_id}")
async def get_generated_content(content_id: int) -> dict:
    """Get a generated content by ID."""
    from src.server.database import SessionLocal
    from src.server.models.database import GeneratedContent
    
    db = SessionLocal()
    try:
        content = db.query(GeneratedContent).filter(GeneratedContent.id == content_id).first()
        if not content:
            raise HTTPException(status_code=404, detail="Content not found")
        return content.to_dict()
    finally:
        db.close()