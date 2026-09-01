"""Content generation service with Agnes integration and fallback."""

import logging
import httpx
from dataclasses import dataclass, field
from typing import Any

from src.server.core.agnes_client import AgnesClient, AgnesConfig, TaskStatus

logger = logging.getLogger(__name__)


@dataclass
class GenerationConfig:
    """Configuration for content generation."""
    agnes_base_url: str = "http://localhost:8765"
    agnes_api_key: str = ""
    default_mode: str = "simple"
    use_fallback: bool = False  # Force fallback mode


@dataclass
class GenerationResult:
    """Result of content generation."""
    content_id: str
    type: str  # "image" | "video"
    platform: str
    prompt: str
    result_url: str | None = None
    status: str = "pending"
    metadata: dict[str, Any] = field(default_factory=dict)


class ContentGenerationService:
    """Service for generating images and videos via Agnes.
    
    Supports two modes:
    1. Agnes mode: Connects to Agnes Video Generator API
    2. Fallback mode: Creates placeholder content for development
    
    Example:
        service = ContentGenerationService()
        result = await service.generate_image("luxury perfume ad", platform="instagram")
    """

    def __init__(self, config: GenerationConfig | None = None) -> None:
        self.config = config or GenerationConfig()
        self._agnes_client: AgnesClient | None = None
        self._use_fallback = self.config.use_fallback

    async def _get_agnes_client(self) -> AgnesClient | None:
        """Get or create the Agnes client."""
        if self._agnes_client is None:
            agnes_config = AgnesConfig(
                base_url=self.config.agnes_base_url,
                api_key=self.config.agnes_api_key,
            )
            self._agnes_client = AgnesClient(agnes_config)
            
            # Test connection
            try:
                models = await self._agnes_client.list_models()
                if models:
                    logger.info(f"Agnes connected: {len(models)} models available")
                else:
                    logger.warning("Agnes returned no models, using fallback")
                    self._use_fallback = True
            except Exception as e:
                logger.warning(f"Agnes connection failed: {e}, using fallback mode")
                self._use_fallback = True
        
        return self._agnes_client

    async def generate_image(
        self,
        prompt: str,
        platform: str = "instagram",
        reference_image: str | None = None,
    ) -> GenerationResult:
        """Generate an image from a prompt."""
        client = await self._get_agnes_client()
        
        if self._use_fallback or client is None:
            return await self._fallback_generate("image", prompt, platform)
        
        try:
            task = await client.generate_image(prompt, reference_image)
            return GenerationResult(
                content_id=task.task_id,
                type="image",
                platform=platform,
                prompt=prompt,
                status=task.status.value,
            )
        except Exception as e:
            logger.error(f"Agnes image generation failed: {e}")
            return await self._fallback_generate("image", prompt, platform)

    async def generate_video(
        self,
        prompt: str,
        platform: str = "instagram",
        mode: str = "simple",
        reference_image: str | None = None,
    ) -> GenerationResult:
        """Generate a video from a prompt."""
        client = await self._get_agnes_client()
        
        if self._use_fallback or client is None:
            return await self._fallback_generate("video", prompt, platform)
        
        try:
            task = await client.generate_video(prompt, mode, reference_image)
            return GenerationResult(
                content_id=task.task_id,
                type="video",
                platform=platform,
                prompt=prompt,
                status=task.status.value,
            )
        except Exception as e:
            logger.error(f"Agnes video generation failed: {e}")
            return await self._fallback_generate("video", prompt, platform)

    async def get_content_status(self, content_id: str) -> GenerationResult:
        """Check the status of generated content."""
        if self._use_fallback:
            return GenerationResult(
                content_id=content_id,
                type="unknown",
                platform="unknown",
                prompt="",
                status="completed",
                result_url=f"https://placeholder.example.com/{content_id}",
            )
        
        client = await self._get_agnes_client()
        if client is None:
            return GenerationResult(
                content_id=content_id,
                type="unknown",
                platform="unknown",
                prompt="",
                status="failed",
            )
        
        task = await client.get_task_status(content_id)
        return GenerationResult(
            content_id=content_id,
            type="unknown",
            platform="unknown",
            prompt="",
            result_url=task.output_url,
            status=task.status.value,
        )

    async def _fallback_generate(
        self,
        content_type: str,
        prompt: str,
        platform: str,
    ) -> GenerationResult:
        """Generate placeholder content for development."""
        import hashlib
        import time
        
        # Generate a unique ID based on content
        content_hash = hashlib.md5(f"{prompt}{platform}{time.time()}".encode()).hexdigest()[:12]
        content_id = f"fallback_{content_hash}"
        
        logger.info(f"Fallback generation: {content_type} for {platform}")
        
        return GenerationResult(
            content_id=content_id,
            type=content_type,
            platform=platform,
            prompt=prompt,
            status="completed",  # Fallback completes immediately
            result_url=f"https://placeholder.example.com/{content_id}.{content_type}",
            metadata={
                "fallback": True,
                "message": "Agnes not available. This is a placeholder.",
                "tip": "Start Agnes on port 8765 for real generation.",
            },
        )

    async def close(self) -> None:
        """Close the Agnes client."""
        if self._agnes_client:
            await self._agnes_client.close()
            self._agnes_client = None