"""API endpoints for content generation with Agnes."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

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
    fallback: bool = False


@router.post("/image", response_model=GenerateResponse)
async def generate_image(request: GenerateRequest) -> GenerateResponse:
    """Generate an image from a campaign's amplified prompt."""
    try:
        service = ContentGenerationService()
        from src.server.database import SessionLocal
        from src.server.models.database import Campaign, GeneratedContent
        
        db = SessionLocal()
        try:
            campaign = db.query(Campaign).filter(Campaign.id == request.campaign_id).first()
            if not campaign:
                raise HTTPException(status_code=404, detail="Campaign not found")
            
            # Generate image
            result = await service.generate_image(
                prompt=campaign.amplified_prompt,
                platform=request.platform,
            )
            
            # Save to database
            db_content = GeneratedContent(
                campaign_id=request.campaign_id,
                content_type="image",
                platform=request.platform,
                prompt=campaign.amplified_prompt,
                status=result.status,
                result_url=result.result_url or "",
                metadata_json=result.metadata,
            )
            db.add(db_content)
            db.commit()
            db.refresh(db_content)
            
            return GenerateResponse(
                success=True,
                content_id=db_content.id,
                task_id=result.content_id,
                status=result.status,
                message=f"Image generation {'started' if result.status == 'pending' else 'completed'} for {request.platform}",
                fallback=result.metadata.get("fallback", False),
            )
        finally:
            db.close()
            
    except HTTPException:
        raise
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
            
            result = await service.generate_video(
                prompt=campaign.amplified_prompt,
                platform=request.platform,
                mode=request.mode,
            )
            
            db_content = GeneratedContent(
                campaign_id=request.campaign_id,
                content_type="video",
                platform=request.platform,
                prompt=campaign.amplified_prompt,
                status=result.status,
                result_url=result.result_url or "",
                metadata_json=result.metadata,
            )
            db.add(db_content)
            db.commit()
            db.refresh(db_content)
            
            return GenerateResponse(
                success=True,
                content_id=db_content.id,
                task_id=result.content_id,
                status=result.status,
                message=f"Video generation {'started' if result.status == 'pending' else 'completed'} ({request.mode} mode)",
                fallback=result.metadata.get("fallback", False),
            )
        finally:
            db.close()
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{task_id}")
async def get_generation_status(task_id: str) -> dict:
    """Check the status of a generation task."""
    try:
        service = ContentGenerationService()
        result = await service.get_content_status(task_id)
        return {
            "task_id": task_id,
            "status": result.status,
            "result_url": result.result_url,
            "metadata": result.metadata,
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