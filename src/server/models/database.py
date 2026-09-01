"""Database models for the Social Media Content Engine."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from src.server.database import Base


class Campaign(Base):
    """A content campaign with a shared brief."""
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    raw_idea = Column(Text, nullable=False)
    amplified_prompt = Column(Text, default="")
    sale_type = Column(String(50), default="")
    emotion = Column(String(50), default="")
    tone = Column(String(50), default="")
    style = Column(String(50), default="")
    cta = Column(String(255), default="")
    text_overlay = Column(String(255), default="")
    color_palette = Column(JSON, default=list)
    hashtags = Column(JSON, default=list)
    psychological_triggers = Column(JSON, default=list)
    platforms = Column(JSON, default=list)
    diffusion_message = Column(Text, default="")
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "raw_idea": self.raw_idea,
            "amplified_prompt": self.amplified_prompt,
            "sale_type": self.sale_type,
            "emotion": self.emotion,
            "tone": self.tone,
            "style": self.style,
            "cta": self.cta,
            "text_overlay": self.text_overlay,
            "color_palette": self.color_palette,
            "hashtags": self.hashtags,
            "psychological_triggers": self.psychological_triggers,
            "platforms": self.platforms,
            "diffusion_message": self.diffusion_message,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class GeneratedContent(Base):
    """Generated content (image/video) for a campaign."""
    __tablename__ = "generated_content"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, nullable=False, index=True)
    content_type = Column(String(20), nullable=False)  # image, video
    platform = Column(String(50), nullable=False)
    prompt = Column(Text, nullable=False)
    result_url = Column(String(500), default="")
    status = Column(String(20), default="pending")  # pending, processing, completed, failed
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "campaign_id": self.campaign_id,
            "content_type": self.content_type,
            "platform": self.platform,
            "prompt": self.prompt,
            "result_url": self.result_url,
            "status": self.status,
            "metadata": self.metadata_json,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class DiffusionHistory(Base):
    """History of WhatsApp diffusion messages sent."""
    __tablename__ = "diffusion_history"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, nullable=False, index=True)
    message = Column(Text, nullable=False)
    recipients = Column(JSON, default=list)
    status = Column(String(20), default="pending")  # pending, sent, failed
    message_id = Column(String(255), default="")
    error = Column(Text, default="")
    sent_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "campaign_id": self.campaign_id,
            "message": self.message,
            "recipients": self.recipients,
            "status": self.status,
            "message_id": self.message_id,
            "error": self.error,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
        }