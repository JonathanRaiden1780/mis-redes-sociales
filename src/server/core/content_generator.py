"""Video generation service wrapping Agnes and ViMax."""

import logging
from dataclasses import dataclass, field
from typing import Any

from src.server.core.agnes_client import (
    AgnesClient,
    AgnesConfig,
    TaskStatus,
)

logger = logging.getLogger(__name__)


@dataclass
class GenerationConfig:
    """Configuration for content generation."""

    agnes_base_url: str = "http://localhost:8765"
    agnes_api_key: str = ""
    default_mode: str = "simple"


@dataclass
class GeneratedContent:
    """Result of content generation."""

    content_id: str
    type: str  # "image" | "video"
    platform: str
    prompt: str
    result_url: str | None = None
    status: str = "pending"
    metadata: dict[str, Any] = field(default_factory=dict)


class ContentGenerationService:
    """Service for generating images and videos via Agnes and ViMax.

    Uses Agnes as the primary engine for image/video generation.
    ViMax is an optional agentic pipeline for complex multi-scene videos.

    Example:
        service = ContentGenerationService()
        content = await service.generate_image("luxury perfume ad", platform="instagram")
    """

    def __init__(self, config: GenerationConfig | None = None) -> None:
        self.config = config or GenerationConfig()
        self._agnes_client: AgnesClient | None = None

    async def _get_agnes_client(self) -> AgnesClient:
        """Get or create the Agnes client."""
        if self._agnes_client is None:
            agnes_config = AgnesConfig(
                base_url=self.config.agnes_base_url,
                api_key=self.config.agnes_api_key,
            )
            self._agnes_client = AgnesClient(agnes_config)
        return self._agnes_client

    async def generate_image(
        self,
        prompt: str,
        platform: str = "instagram",
        reference_image: str | None = None,
    ) -> GeneratedContent:
        """Generate an image from an amplified prompt.

        Args:
            prompt: The amplified prompt for image generation.
            platform: Target platform (for format adaptation).
            reference_image: Optional reference image URL for i2i.

        Returns:
            GeneratedContent with task ID and status.
        """
        client = await self._get_agnes_client()
        task = await client.generate_image(prompt, reference_image)
        return GeneratedContent(
            content_id=task.task_id,
            type="image",
            platform=platform,
            prompt=prompt,
            status=task.status.value,
        )

    async def generate_video(
        self,
        prompt: str,
        platform: str = "instagram",
        mode: str = "simple",
        reference_image: str | None = None,
    ) -> GeneratedContent:
        """Generate a video from an amplified prompt.

        Args:
            prompt: The amplified prompt or screenplay.
            platform: Target platform (for format adaptation).
            mode: Generation mode - 'simple', 'creative', 'manuscript', 'anchor'.
            reference_image: Optional reference image URL for i2v.

        Returns:
            GeneratedContent with task ID and status.
        """
        client = await self._get_agnes_client()
        task = await client.generate_video(prompt, mode, reference_image)
        return GeneratedContent(
            content_id=task.task_id,
            type="video",
            platform=platform,
            prompt=prompt,
            status=task.status.value,
        )

    async def get_content_status(self, content_id: str) -> GeneratedContent | None:
        """Check the status of generated content.

        Args:
            content_id: The content/task ID.

        Returns:
            GeneratedContent with current status and result URL if available.
        """
        client = await self._get_agnes_client()
        task = await client.get_task_status(content_id)
        if task.status == TaskStatus.COMPLETED:
            return GeneratedContent(
                content_id=content_id,
                type="unknown",
                platform="unknown",
                prompt="",
                result_url=task.output_url,
                status="completed",
            )
        return GeneratedContent(
            content_id=content_id,
            type="unknown",
            platform="unknown",
            prompt="",
            status=task.status.value,
        )

    async def wait_for_content(
        self,
        content_id: str,
        poll_interval: float = 2.0,
        max_attempts: int = 60,
    ) -> GeneratedContent:
        """Wait for content generation to complete.

        Args:
            content_id: The content/task ID.
            poll_interval: Seconds between polls.
            max_attempts: Maximum number of poll attempts.

        Returns:
            GeneratedContent with completed status and result URL.

        Raises:
            RuntimeError: If generation fails or times out.
        """
        client = await self._get_agnes_client()
        task = await client.wait_for_completion(content_id, poll_interval, max_attempts)
        return GeneratedContent(
            content_id=content_id,
            type="unknown",
            platform="unknown",
            prompt="",
            result_url=task.output_url,
            status="completed",
        )

    async def download_content(self, content_id: str) -> bytes | None:
        """Download generated content bytes.

        Args:
            content_id: The content/task ID.

        Returns:
            Bytes of the generated file, or None if not available.
        """
        client = await self._get_agnes_client()
        return await client.download_result(content_id)

    async def close(self) -> None:
        """Close the Agnes client."""
        if self._agnes_client:
            await self._agnes_client.close()
            self._agnes_client = None
