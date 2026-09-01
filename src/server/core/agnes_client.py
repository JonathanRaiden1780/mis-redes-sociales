"""Async HTTP client for Agnes Video Generator API."""

import asyncio
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Self

import httpx

logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    """Agnes task lifecycle statuses."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class TaskResult:
    """Result of an Agnes generation task."""

    task_id: str
    status: TaskStatus
    output_url: str | None = None
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.metadata is None:
            self.metadata = {}


@dataclass
class AgnesConfig:
    """Configuration for the Agnes client."""

    base_url: str = "http://localhost:8765"
    api_key: str = ""
    timeout: int = 120


class AgnesClient:
    """Async client for the Agnes Video Generator REST API.

    Supports image generation (t2i, i2i), video generation (t2v, i2v, keyframes),
    and task status polling.

    Example:
        client = AgnesClient(base_url="http://localhost:8765", api_key="free")
        result = await client.generate_image("a luxury perfume ad")
        print(result.task_id)
    """

    def __init__(self, config: AgnesConfig | None = None) -> None:
        self.config = config or AgnesConfig()
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.config.base_url,
                timeout=self.config.timeout,
                headers={
                    "Content-Type": "application/json",
                    "X-API-Key": self.config.api_key,
                },
            )
        return self._client

    async def generate_image(
        self,
        prompt: str,
        reference_image: str | None = None,
    ) -> TaskResult:
        """Generate an image from a text prompt.

        Args:
            prompt: The text prompt for image generation.
            reference_image: Optional reference image URL for i2i.

        Returns:
            TaskResult with the task ID for polling.
        """
        client = await self._get_client()
        payload: dict[str, Any] = {"prompt": prompt}
        if reference_image:
            payload["reference_image"] = reference_image

        logger.info("Generating image with prompt: %s", prompt[:50])
        response = await client.post("/api/image/generate", json=payload)
        response.raise_for_status()
        data = response.json()
        return TaskResult(
            task_id=data["task_id"],
            status=TaskStatus.PENDING,
        )

    async def generate_video(
        self,
        prompt: str,
        mode: str = "simple",
        reference_image: str | None = None,
    ) -> TaskResult:
        """Generate a video from a text prompt.

        Args:
            prompt: The text prompt or screenplay for video generation.
            mode: Generation mode - 'simple' (t2v/i2v), 'creative', 'manuscript', 'anchor'.
            reference_image: Optional reference image URL for i2v.

        Returns:
            TaskResult with the task ID for polling.
        """
        client = await self._get_client()
        payload: dict[str, Any] = {
            "prompt": prompt,
            "mode": mode,
        }
        if reference_image:
            payload["reference_image"] = reference_image

        logger.info("Generating video (mode=%s) with prompt: %s", mode, prompt[:50])
        response = await client.post("/api/tasks/simple", json=payload)
        response.raise_for_status()
        data = response.json()
        return TaskResult(
            task_id=data["task_id"],
            status=TaskStatus.PENDING,
        )

    async def get_task_status(self, task_id: str) -> TaskResult:
        """Check the status of a generation task.

        Args:
            task_id: The task ID returned by generate_image or generate_video.

        Returns:
            TaskResult with current status and output URL if completed.
        """
        client = await self._get_client()
        response = await client.get(f"/api/tasks/{task_id}")
        response.raise_for_status()
        data = response.json()

        status_str = data.get("status", TaskStatus.PENDING.value)
        try:
            status = TaskStatus(status_str)
        except ValueError:
            status = TaskStatus.PENDING

        return TaskResult(
            task_id=task_id,
            status=status,
            output_url=data.get("output_url"),
            error=data.get("error"),
            metadata=data.get("metadata", {}),
        )

    async def download_result(self, task_id: str) -> bytes | None:
        """Download the generated result for a completed task.

        Args:
            task_id: The task ID.

        Returns:
            Bytes of the generated file, or None if not available.
        """
        result = await self.get_task_status(task_id)
        if result.status != TaskStatus.COMPLETED or not result.output_url:
            return None

        client = await self._get_client()
        response = await client.get(f"/api/image/{task_id}", follow_redirects=True)
        response.raise_for_status()
        return response.content

    async def list_models(self) -> list[dict[str, Any]]:
        """List available generation models.

        Returns:
            List of model dictionaries.
        """
        client = await self._get_client()
        response = await client.get("/api/models")
        response.raise_for_status()
        data: dict[str, Any] = response.json()
        models: list[dict[str, Any]] = data.get("models", [])
        return models

    async def wait_for_completion(
        self,
        task_id: str,
        poll_interval: float = 2.0,
        max_attempts: int = 60,
    ) -> TaskResult:
        """Poll until a task is completed or failed.

        Args:
            task_id: The task ID to poll.
            poll_interval: Seconds between polls.
            max_attempts: Maximum number of poll attempts.

        Returns:
            Final TaskResult with completed status and output URL.

        Raises:
            RuntimeError: If the task fails or times out.
        """
        for attempt in range(max_attempts):
            result = await self.get_task_status(task_id)
            logger.info(
                "Task %s status: %s (attempt %d/%d)",
                task_id,
                result.status.value,
                attempt + 1,
                max_attempts,
            )
            if result.status == TaskStatus.COMPLETED:
                return result
            if result.status == TaskStatus.FAILED:
                raise RuntimeError(f"Task {task_id} failed: {result.error}")
            await asyncio.sleep(poll_interval)

        raise RuntimeError(f"Task {task_id} timed out after {max_attempts} attempts")

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        await self.close()
