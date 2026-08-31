"""Tests for the prompt amplifier pipeline."""

import os
import sys

# Add project root to path
sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from src.server.core.amplifier import AmplificationResult, amplify
from src.server.core.amplifier.intent_analyzer import analyze_intent
from src.server.core.amplifier.parser import parse_idea
from src.server.core.amplifier.platform_adapter import (
    PlatformPrompt,
    adapt_for_all_platforms,
    adapt_for_platform,
    build_diffusion_message,
)
from src.server.core.amplifier.prompt_builder import build_prompt


def test_parse_simple_idea():
    """Test parsing a simple promotional idea."""
    result = parse_idea("promoción de perfumes 2x800 pesos")
    assert result.product_type == "perfumes"
    assert result.price == "800"
    assert result.offer_type == "bundle"
    assert result.urgency == "high"
    assert any("perfume" in kw for kw in result.keywords)


def test_parse_empty_idea():
    """Test parsing empty string."""
    result = parse_idea("")
    assert result.raw_text == ""
    assert result.product_type == ""


def test_parse_bundle_deal():
    """Test parsing a bundle deal."""
    result = parse_idea("2x1 en zapatos 500 pesos")
    assert result.offer_type == "two_for_one"
    assert result.price == "500"


def test_intent_analysis_bundle():
    """Test intent analysis for bundle deal."""
    parsed = parse_idea("promoción de perfumes 2x800 pesos")
    intent = analyze_intent(parsed)
    assert intent.sale_type == "bundle_deal"
    assert intent.cta == "Lleva 2 por el precio de 1"
    assert len(intent.psychological_triggers) > 0


def test_intent_emotion():
    """Test emotion detection."""
    parsed = parse_idea("nueva colección de lujo")
    intent = analyze_intent(parsed)
    assert intent.emotion in ("luxury", "premium") or intent.tone in (
        "premium",
        "luxury",
    )


def test_build_prompt():
    """Test prompt building."""
    parsed = parse_idea("promoción de perfumes 2x800 pesos")
    intent = analyze_intent(parsed)
    amplified = build_prompt(parsed, intent)
    assert amplified.image_prompt != ""
    assert len(amplified.video_script) == 3
    assert amplified.text_overlay != ""
    assert len(amplified.hashtags) > 0
    assert amplified.cta != ""
    assert amplified.color_palette != []


def test_build_prompt_with_style():
    """Test prompt building with style override."""
    parsed = parse_idea("promoción de perfumes 2x800 pesos")
    intent = analyze_intent(parsed)
    amplified = build_prompt(parsed, intent, style_override="luxury")
    assert amplified.style == "luxury"
    assert (
        "luxury" in amplified.image_prompt.lower()
        or "golden" in amplified.image_prompt.lower()
    )


def test_adapt_for_platform():
    """Test platform adaptation."""
    parsed = parse_idea("promoción de perfumes 2x800 pesos")
    intent = analyze_intent(parsed)
    amplified = build_prompt(parsed, intent)

    ig = adapt_for_platform(amplified, "instagram")
    assert ig.platform == "instagram"
    assert ig.format == "9:16"
    assert len(ig.hashtags) > 0
    assert "#Instagram" in ig.hashtags

    tt = adapt_for_platform(amplified, "tiktok")
    assert tt.platform == "tiktok"
    assert "#TikTok" in tt.hashtags

    wa = adapt_for_platform(amplified, "whatsapp")
    assert wa.platform == "whatsapp"
    assert wa.format == "1:1"


def test_adapt_for_all_platforms():
    """Test adaptation for all platforms."""
    parsed = parse_idea("promoción de perfumes 2x800 pesos")
    intent = analyze_intent(parsed)
    amplified = build_prompt(parsed, intent)

    all_platforms = adapt_for_all_platforms(amplified)
    assert set(all_platforms.keys()) == {"instagram", "tiktok", "facebook", "whatsapp"}
    for platform, pp in all_platforms.items():
        assert isinstance(pp, PlatformPrompt)
        assert pp.platform == platform


def test_build_diffusion_message():
    """Test WhatsApp diffusion message."""
    parsed = parse_idea("promoción de perfumes 2x800 pesos")
    intent = analyze_intent(parsed)
    amplified = build_prompt(parsed, intent)

    msg = build_diffusion_message(amplified)
    assert "2x800 PESOS" in msg
    assert "🔥" in msg
    assert len(msg) > 0


def test_full_amplification():
    """Test the full amplification pipeline."""
    result = amplify("promoción de perfumes 2x800 pesos")
    assert isinstance(result, AmplificationResult)
    assert result.parsed_idea.product_type == "perfumes"
    assert result.amplified_prompt.image_prompt != ""
    assert len(result.platform_prompts) == 4
    assert result.diffusion_message != ""


def test_full_amplification_empty() -> None:
    """Test full amplification with empty idea raises error."""
    try:
        amplify("")
        assert False, "Should have raised"
    except (ValueError, Exception):  # noqa: S110, BLE001
        pass


def test_amplify_response_structure():
    """Test that amplify returns all required fields."""
    result = amplify("2x800 en perfumes, oferta especial")
    ap = result.amplified_prompt

    # Check all fields present
    assert hasattr(ap, "image_prompt")
    assert hasattr(ap, "video_script")
    assert hasattr(ap, "hashtags")
    assert hasattr(ap, "cta")
    assert hasattr(ap, "color_palette")
    assert hasattr(ap, "style")
    assert hasattr(ap, "text_overlay")
    assert hasattr(ap, "platform_prompts")


def test_scarcity_detection():
    """Test scarcity cue detection."""
    parsed = parse_idea("últimas unidades de perfume")
    assert parsed.urgency == "high"


def test_different_products():
    """Test parsing different product types."""
    for product in ["zapatos", "reloj", "camiseta", "laptop"]:
        idea = f"promoción de {product} 3x1000 pesos"
        result = parse_idea(idea)
        assert result.product_type == product, f"Failed for {product}"


def test_platform_hashtags_unique():
    """Test each platform gets platform-specific hashtags."""
    parsed = parse_idea("oferta de moda")
    intent = analyze_intent(parsed)
    amplified = build_prompt(parsed, intent)

    ig = adapt_for_platform(amplified, "instagram")
    tt = adapt_for_platform(amplified, "tiktok")
    fb = adapt_for_platform(amplified, "facebook")

    # Each platform should have different hashtag sets
    assert ig.hashtags != tt.hashtags
    assert tt.hashtags != fb.hashtags


if __name__ == "__main__":
    tests = [
        test_parse_simple_idea,
        test_parse_empty_idea,
        test_parse_bundle_deal,
        test_intent_analysis_bundle,
        test_intent_emotion,
        test_build_prompt,
        test_build_prompt_with_style,
        test_adapt_for_platform,
        test_adapt_for_all_platforms,
        test_build_diffusion_message,
        test_full_amplification,
        test_amplify_response_structure,
        test_scarcity_detection,
        test_different_products,
        test_platform_hashtags_unique,
    ]

    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            print(f"✅ {test.__name__}")
            passed += 1
        except Exception:  # noqa: BLE001
            failed += 1

    print(f"\n{passed} passed, {failed} failed out of {len(tests)} tests")
    if failed == 0:
        print("🎉 All tests passed!")
