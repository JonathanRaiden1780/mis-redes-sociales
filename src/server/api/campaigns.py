"""API endpoints for campaign management and history."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from src.server.database import get_db
from src.server.models.database import Campaign, GeneratedContent, DiffusionHistory

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])


@router.get("/", response_model=dict)
async def list_campaigns(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
) -> dict:
    """List all campaigns."""
    campaigns = db.query(Campaign).order_by(Campaign.created_at.desc()).offset(skip).limit(limit).all()
    total = db.query(Campaign).count()
    return {
        "campaigns": [c.to_dict() for c in campaigns],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/{campaign_id}", response_model=dict)
async def get_campaign(campaign_id: int, db: Session = Depends(get_db)) -> dict:
    """Get a campaign by ID."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign.to_dict()


@router.post("/", response_model=dict)
async def create_campaign(
    name: str,
    raw_idea: str,
    amplified_prompt: str = "",
    sale_type: str = "",
    emotion: str = "",
    tone: str = "",
    style: str = "",
    cta: str = "",
    text_overlay: str = "",
    color_palette: Optional[list] = None,
    hashtags: Optional[list] = None,
    psychological_triggers: Optional[list] = None,
    platforms: Optional[list] = None,
    diffusion_message: str = "",
    db: Session = Depends(get_db),
) -> dict:
    """Create a new campaign."""
    campaign = Campaign(
        name=name,
        raw_idea=raw_idea,
        amplified_prompt=amplified_prompt,
        sale_type=sale_type,
        emotion=emotion,
        tone=tone,
        style=style,
        cta=cta,
        text_overlay=text_overlay,
        color_palette=color_palette or [],
        hashtags=hashtags or [],
        psychological_triggers=psychological_triggers or [],
        platforms=platforms or [],
        diffusion_message=diffusion_message,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign.to_dict()


@router.put("/{campaign_id}", response_model=dict)
async def update_campaign(
    campaign_id: int,
    name: Optional[str] = None,
    raw_idea: Optional[str] = None,
    amplified_prompt: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
) -> dict:
    """Update a campaign."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if name is not None:
        campaign.name = name
    if raw_idea is not None:
        campaign.raw_idea = raw_idea
    if amplified_prompt is not None:
        campaign.amplified_prompt = amplified_prompt
    if status is not None:
        campaign.status = status
    
    campaign.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(campaign)
    return campaign.to_dict()


@router.delete("/{campaign_id}", response_model=dict)
async def delete_campaign(campaign_id: int, db: Session = Depends(get_db)) -> dict:
    """Delete a campaign."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    db.delete(campaign)
    db.commit()
    return {"success": True, "message": "Campaign deleted"}


@router.get("/{campaign_id}/content", response_model=dict)
async def get_campaign_content(campaign_id: int, db: Session = Depends(get_db)) -> dict:
    """Get generated content for a campaign."""
    content = db.query(GeneratedContent).filter(GeneratedContent.campaign_id == campaign_id).all()
    return {"content": [c.to_dict() for c in content]}


@router.get("/{campaign_id}/diffusions", response_model=dict)
async def get_campaign_diffusions(campaign_id: int, db: Session = Depends(get_db)) -> dict:
    """Get diffusion history for a campaign."""
    diffusions = db.query(DiffusionHistory).filter(DiffusionHistory.campaign_id == campaign_id).all()
    return {"diffusions": [d.to_dict() for d in diffusions]}