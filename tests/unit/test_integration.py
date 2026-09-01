"""Integration tests for the content generation and social clients."""

import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from src.server.core.agnes_client import (
    AgnesClient,
    AgnesConfig,
    TaskResult,
    TaskStatus,
)
from src.server.core.content_generator import (
    ContentGenerationService,
    GeneratedContent,
    GenerationConfig,
)
from src.server.core.social_clients import (
    FacebookClient,
    InstagramClient,
    PublishResult,
    TikTokClient,
    get_social_client,
)


def test_agnes_client_creation():
    """Test AgnesClient instantiation."""
    config = AgnesConfig(base_url="http://localhost:8765", api_key="test_key")
    client = AgnesClient(config)
    assert client.config.base_url == "http://localhost:8765"
    assert client.config.api_key == "test_key"
    print("✅ test_agnes_client_creation")


def test_agnes_config_defaults():
    """Test AgnesConfig defaults."""
    config = AgnesConfig()
    assert config.base_url == "http://localhost:8765"
    assert config.api_key == ""
    assert config.timeout == 120
    print("✅ test_agnes_config_defaults")


def test_task_result_creation():
    """Test TaskResult instantiation."""
    result = TaskResult(task_id="test-123", status=TaskStatus.PENDING)
    assert result.task_id == "test-123"
    assert result.status == TaskStatus.PENDING
    assert result.output_url is None
    assert result.error is None
    print("✅ test_task_result_creation")


def test_task_result_completed():
    """Test TaskResult with completed status."""
    result = TaskResult(
        task_id="test-456",
        status=TaskStatus.COMPLETED,
        output_url="https://example.com/result.mp4",
    )
    assert result.status == TaskStatus.COMPLETED
    assert result.output_url == "https://example.com/result.mp4"
    print("✅ test_task_result_completed")


def test_generated_content_creation():
    """Test GeneratedContent instantiation."""
    content = GeneratedContent(
        content_id="gen-001",
        type="image",
        platform="instagram",
        prompt="a luxury perfume ad",
    )
    assert content.content_id == "gen-001"
    assert content.type == "image"
    assert content.status == "pending"
    print("✅ test_generated_content_creation")


def test_content_generation_service_creation():
    """Test ContentGenerationService instantiation."""
    config = GenerationConfig(agnes_base_url="http://localhost:8765")
    service = ContentGenerationService(config)
    assert service.config.agnes_base_url == "http://localhost:8765"
    print("✅ test_content_generation_service_creation")


def test_instagram_client_creation():
    """Test InstagramClient instantiation."""
    client = InstagramClient(access_token="token123", instagram_account_id="12345")
    assert client.access_token == "token123"
    assert client.instagram_account_id == "12345"
    print("✅ test_instagram_client_creation")


def test_tiktok_client_creation():
    """Test TikTokClient instantiation."""
    client = TikTokClient(
        access_token="token123", app_key="key123", app_secret="secret123"
    )
    assert client.access_token == "token123"
    assert client.app_key == "key123"
    print("✅ test_tiktok_client_creation")


def test_facebook_client_creation():
    """Test FacebookClient instantiation."""
    client = FacebookClient(access_token="token123", page_id="page123")
    assert client.access_token == "token123"
    assert client.page_id == "page123"
    print("✅ test_facebook_client_creation")


def test_publish_result_creation():
    """Test PublishResult instantiation."""
    result = PublishResult(platform="instagram", success=True, post_id="post-123")
    assert result.platform == "instagram"
    assert result.success is True
    assert result.post_id == "post-123"
    print("✅ test_publish_result_creation")


def test_publish_result_failure():
    """Test PublishResult with failure."""
    result = PublishResult(platform="tiktok", success=False, error="API error")
    assert result.success is False
    assert result.error == "API error"
    print("✅ test_publish_result_failure")


def test_get_social_client_instagram():
    """Test social client factory for Instagram."""
    client = get_social_client(
        "instagram", {"access_token": "t", "instagram_account_id": "123"}
    )
    assert isinstance(client, InstagramClient)
    print("✅ test_get_social_client_instagram")


def test_get_social_client_tiktok():
    """Test social client factory for TikTok."""
    client = get_social_client(
        "tiktok", {"access_token": "t", "app_key": "k", "app_secret": "s"}
    )
    assert client.__class__.__name__ == "TikTokClient"
    print("✅ test_get_social_client_tiktok")


def test_get_social_client_facebook():
    """Test social client factory for Facebook."""
    client = get_social_client("facebook", {"access_token": "t", "page_id": "p"})
    assert client.__class__.__name__ == "FacebookClient"
    print("✅ test_get_social_client_facebook")


def test_get_social_client_invalid():
    """Test social client factory with invalid platform."""
    try:
        get_social_client("twitter", {})
        assert False, "Should have raised"
    except ValueError:
        pass
    print("✅ test_get_social_client_invalid")


def test_task_status_enum():
    """Test TaskStatus enum values."""
    assert TaskStatus.PENDING.value == "pending"
    assert TaskStatus.COMPLETED.value == "completed"
    assert TaskStatus.FAILED.value == "failed"
    print("✅ test_task_status_enum")


def test_platform_enum():
    """Test Platform enum values."""
    from src.server.models import Platform

    assert Platform.INSTAGRAM.value == "instagram"
    assert Platform.TIKTOK.value == "tiktok"
    assert Platform.FACEBOOK.value == "facebook"
    assert Platform.WHATSAPP.value == "whatsapp"
    print("✅ test_platform_enum")


def test_campaign_to_dict():
    """Test Campaign serialization."""
    from src.server.models import Campaign

    campaign = Campaign(
        id="camp-1",
        name="Perfume Promo",
        raw_idea="2x800 en perfumes",
        platforms=["instagram", "tiktok"],
    )
    d = campaign.to_dict()
    assert d["name"] == "Perfume Promo"
    assert d["platforms"] == ["instagram", "tiktok"]
    print("✅ test_campaign_to_dict")


def test_campaign_from_dict():
    """Test Campaign deserialization."""
    from src.server.models import Campaign

    data = {
        "id": "camp-1",
        "name": "Test Campaign",
        "raw_idea": "2x1 en zapatos",
        "platforms": ["facebook"],
    }
    campaign = Campaign.from_dict(data)
    assert campaign.name == "Test Campaign"
    assert campaign.platforms == ["facebook"]
    print("✅ test_campaign_from_dict")


def test_scheduled_post_to_dict():
    """Test ScheduledPost serialization."""
    from src.server.models import ScheduledPost

    post = ScheduledPost(
        id="post-1",
        campaign_id="camp-1",
        platform="instagram",
        content_type="video",
    )
    d = post.to_dict()
    assert d["platform"] == "instagram"
    assert d["content_type"] == "video"
    print("✅ test_scheduled_post_to_dict")


def test_whatsapp_config_defaults():
    """Test WhatsAppConfig defaults."""
    from src.server.core.social_clients.whatsapp import WhatsAppConfig

    config = WhatsAppConfig()
    assert config.base_url == "https://api.twilio.com/2010-04-01"
    print("✅ test_whatsapp_config_defaults")


def test_diffusion_result_creation():
    """Test DiffusionResult instantiation."""
    from src.server.core.social_clients.whatsapp import DiffusionResult

    result = DiffusionResult(message_id="msg-123", success=True, status="sent")
    assert result.message_id == "msg-123"
    assert result.success is True
    print("✅ test_diffusion_result_creation")


def test_whatsapp_bot_config_attrs():
    """Test WhatsAppDiffusionBot config attributes."""
    from src.server.core.social_clients.whatsapp import WhatsAppConfig

    config = WhatsAppConfig(
        account_sid="AC123", auth_token="tok", from_number="whatsapp:+1"
    )
    assert config.account_sid == "AC123"
    assert config.auth_token == "tok"
    assert config.from_number == "whatsapp:+1"
    print("✅ test_whatsapp_bot_config_attrs")


if __name__ == "__main__":
    tests = [
        test_agnes_client_creation,
        test_agnes_config_defaults,
        test_task_result_creation,
        test_task_result_completed,
        test_generated_content_creation,
        test_content_generation_service_creation,
        test_instagram_client_creation,
        test_tiktok_client_creation,
        test_facebook_client_creation,
        test_publish_result_creation,
        test_publish_result_failure,
        test_get_social_client_instagram,
        test_get_social_client_tiktok,
        test_get_social_client_facebook,
        test_get_social_client_invalid,
        test_task_status_enum,
        test_platform_enum,
        test_campaign_to_dict,
        test_campaign_from_dict,
        test_scheduled_post_to_dict,
        test_whatsapp_config_defaults,
        test_diffusion_result_creation,
        test_whatsapp_bot_config_attrs,
    ]

    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            passed += 1
        except Exception:  # noqa: BLE001
            failed += 1

    print(f"\n{passed} passed, {failed} failed out of {len(tests)} tests")
    if failed == 0:
        print("🎉 All tests passed!")
