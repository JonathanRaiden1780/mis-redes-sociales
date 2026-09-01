"""Models for the Social Media Content Engine."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class Platform(str, Enum):
    """Supported social media platforms."""

    INSTAGRAM = "instagram"
    TIKTOK = "tiktok"
    FACEBOOK = "facebook"
    WHATSAPP = "whatsapp"


class ContentType(str, Enum):
    """Types of generated content."""

    IMAGE = "image"
    VIDEO = "video"


class TaskStatus(str, Enum):
    """Task lifecycle statuses."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class Campaign:
    """A content campaign with a shared brief."""

    id: str
    name: str
    raw_idea: str
    amplified_prompt: str = ""
    platforms: list[str] = field(default_factory=list)
    status: str = "active"
    created_at: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "raw_idea": self.raw_idea,
            "amplified_prompt": self.amplified_prompt,
            "platforms": self.platforms,
            "status": self.status,
            "created_at": self.created_at,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Campaign":
        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            raw_idea=data.get("raw_idea", ""),
            amplified_prompt=data.get("amplified_prompt", ""),
            platforms=data.get("platforms", []),
            status=data.get("status", "active"),
            created_at=data.get("created_at", ""),
            metadata=data.get("metadata", {}),
        )


@dataclass
class ScheduledPost:
    """A scheduled social media post."""

    id: str
    campaign_id: str
    platform: str
    content_type: str = "image"
    content_url: str = ""
    caption: str = ""
    hashtags: list[str] = field(default_factory=list)
    status: str = "pending"
    scheduled_for: str = ""
    sent_at: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "campaign_id": self.campaign_id,
            "platform": self.platform,
            "content_type": self.content_type,
            "content_url": self.content_url,
            "caption": self.caption,
            "hashtags": self.hashtags,
            "status": self.status,
            "scheduled_for": self.scheduled_for,
            "sent_at": self.sent_at,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ScheduledPost":
        return cls(
            id=data.get("id", ""),
            campaign_id=data.get("campaign_id", ""),
            platform=data.get("platform", ""),
            content_type=data.get("content_type", "image"),
            content_url=data.get("content_url", ""),
            caption=data.get("caption", ""),
            hashtags=data.get("hashtags", []),
            status=data.get("status", "pending"),
            scheduled_for=data.get("scheduled_for", ""),
            sent_at=data.get("sent_at", ""),
            metadata=data.get("metadata", {}),
        )
