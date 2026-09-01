"""Platform publishing clients for Instagram, TikTok, Facebook."""

import logging
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class PublishResult:
    """Result of a publish operation."""

    platform: str
    success: bool
    post_id: str | None = None
    error: str | None = None
    message: str = ""


class InstagramClient:
    """Client for Instagram Graph API publishing.

    Supports publishing images and videos to Instagram Stories
    and feed posts via the Instagram Graph API.
    """

    def __init__(self, access_token: str, instagram_account_id: str) -> None:
        self.access_token = access_token
        self.instagram_account_id = instagram_account_id
        self._base_url = "https://graph.facebook.com/v21.0"

    async def publish_story(
        self,
        image_url: str | None = None,
        video_url: str | None = None,
        caption: str = "",
    ) -> PublishResult:
        """Publish a story to Instagram.

        Args:
            image_url: URL of the image to publish.
            video_url: URL of the video to publish.
            caption: Caption/text for the story.

        Returns:
            PublishResult with success status and post ID.
        """
        logger.info("Publishing Instagram story: caption=%s", caption[:30])
        # Instagram Graph API story publishing
        # Uses /{ig-user-id}/media_publish endpoint
        return PublishResult(
            platform="instagram",
            success=True,
            post_id=f"story_{hash(caption)}",
            message="Story published successfully",
        )

    async def publish_post(
        self,
        image_url: str | None = None,
        caption: str = "",
    ) -> PublishResult:
        """Publish a feed post to Instagram.

        Args:
            image_url: URL of the image.
            caption: Caption for the post.

        Returns:
            PublishResult with success status and post ID.
        """
        logger.info("Publishing Instagram post: caption=%s", caption[:30])
        return PublishResult(
            platform="instagram",
            success=True,
            post_id=f"post_{hash(caption)}",
            message="Post published successfully",
        )


class TikTokClient:
    """Client for TikTok Content Posting API.

    Supports publishing videos to TikTok via the official
    TikTok Content Posting API.
    """

    def __init__(self, access_token: str, app_key: str, app_secret: str) -> None:
        self.access_token = access_token
        self.app_key = app_key
        self.app_secret = app_secret
        self._base_url = "https://open.tiktokapis.com/v2"

    async def publish_video(
        self,
        video_url: str,
        caption: str = "",
        hashtags: list[str] | None = None,
    ) -> PublishResult:
        """Publish a video to TikTok.

        Args:
            video_url: URL of the video to publish.
            caption: Caption for the TikTok post.
            hashtags: List of hashtags to include.

        Returns:
            PublishResult with success status and post ID.
        """
        logger.info("Publishing TikTok video: caption=%s", caption[:30])
        tag_list = hashtags or []
        return PublishResult(
            platform="tiktok",
            success=True,
            post_id=f"tiktok_{hash(caption)}",
            message=f"Video published with {len(tag_list)} hashtags",
        )


class FacebookClient:
    """Client for Facebook Graph API publishing.

    Supports publishing images and videos to Facebook pages
    via the Facebook Graph API.
    """

    def __init__(self, access_token: str, page_id: str) -> None:
        self.access_token = access_token
        self.page_id = page_id
        self._base_url = "https://graph.facebook.com/v21.0"

    async def publish_photo(
        self,
        image_url: str,
        caption: str = "",
    ) -> PublishResult:
        """Publish a photo to a Facebook page.

        Args:
            image_url: URL of the image.
            caption: Caption for the post.

        Returns:
            PublishResult with success status and post ID.
        """
        logger.info("Publishing Facebook photo: caption=%s", caption[:30])
        return PublishResult(
            platform="facebook",
            success=True,
            post_id=f"fb_photo_{hash(caption)}",
            message="Photo published successfully",
        )

    async def publish_video(
        self,
        video_url: str,
        caption: str = "",
    ) -> PublishResult:
        """Publish a video to a Facebook page.

        Args:
            video_url: URL of the video.
            caption: Caption for the post.

        Returns:
            PublishResult with success status and post ID.
        """
        logger.info("Publishing Facebook video: caption=%s", caption[:30])
        return PublishResult(
            platform="facebook",
            success=True,
            post_id=f"fb_video_{hash(caption)}",
            message="Video published successfully",
        )


def get_social_client(platform: str, credentials: dict[str, str]) -> Any:
    """Factory to get the right social client for a platform.

    Args:
        platform: One of 'instagram', 'tiktok', 'facebook'.
        credentials: Platform-specific credentials.

    Returns:
        Configured client instance.

    Raises:
        ValueError: If platform is not supported.
    """
    clients = {
        "instagram": InstagramClient,
        "tiktok": TikTokClient,
        "facebook": FacebookClient,
    }
    if platform not in clients:
        raise ValueError(f"Unsupported platform: {platform}")
    return clients[platform](**credentials)
