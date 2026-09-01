"""Tests for database persistence."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.server.database import init_db, SessionLocal, DB_PATH
from src.server.models.database import Campaign, GeneratedContent, DiffusionHistory


def setup():
    """Initialize test database."""
    if DB_PATH.exists():
        DB_PATH.unlink()
    init_db()


def test_create_campaign():
    """Test creating a campaign."""
    db = SessionLocal()
    try:
        campaign = Campaign(
            name="Test Campaign",
            raw_idea="promoción de perfumes 2x800 pesos",
            amplified_prompt="test prompt",
            sale_type="bundle_deal",
            emotion="exciting",
            tone="urgent",
            style="trending",
            cta="Lleva 2 por el precio de 1",
            text_overlay="2x800 PESOS",
            color_palette=["#6c5ce7", "#a29bfe"],
            hashtags=["ofertas", "promo"],
            psychological_triggers=["urgency", "value"],
            platforms=["instagram", "tiktok"],
            diffusion_message="🔥 2x800 PESOS",
        )
        db.add(campaign)
        db.commit()
        db.refresh(campaign)
        
        assert campaign.id is not None
        assert campaign.name == "Test Campaign"
        assert campaign.raw_idea == "promoción de perfumes 2x800 pesos"
        assert campaign.status == "active"
        print(f"✅ test_create_campaign (id={campaign.id})")
    finally:
        db.close()


def test_list_campaigns():
    """Test listing campaigns."""
    db = SessionLocal()
    try:
        campaigns = db.query(Campaign).all()
        assert len(campaigns) >= 1
        print(f"✅ test_list_campaigns (count={len(campaigns)})")
    finally:
        db.close()


def test_get_campaign():
    """Test getting a campaign by ID."""
    db = SessionLocal()
    try:
        # Create a specific campaign to find
        test_campaign = Campaign(
            name="Get Test Campaign",
            raw_idea="get test idea",
            sale_type="test_type",
        )
        db.add(test_campaign)
        db.commit()
        db.refresh(test_campaign)
        
        # Fetch by ID
        campaign = db.query(Campaign).filter(Campaign.id == test_campaign.id).first()
        assert campaign is not None
        d = campaign.to_dict()
        assert d["name"] == "Get Test Campaign"
        assert d["sale_type"] == "test_type"
        print("✅ test_get_campaign")
    finally:
        db.close()


def test_update_campaign():
    """Test updating a campaign."""
    db = SessionLocal()
    try:
        campaign = db.query(Campaign).first()
        campaign.status = "archived"
        db.commit()
        db.refresh(campaign)
        assert campaign.status == "archived"
        print("✅ test_update_campaign")
    finally:
        db.close()


def test_delete_campaign():
    """Test deleting a campaign."""
    db = SessionLocal()
    try:
        campaign = db.query(Campaign).first()
        campaign_id = campaign.id
        db.delete(campaign)
        db.commit()
        
        deleted = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        assert deleted is None
        print("✅ test_delete_campaign")
    finally:
        db.close()


def test_campaign_to_dict():
    """Test campaign serialization."""
    campaign = Campaign(
        name="Dict Test",
        raw_idea="test idea",
        color_palette=["#fff"],
        hashtags=["test"],
    )
    d = campaign.to_dict()
    assert d["name"] == "Dict Test"
    assert d["color_palette"] == ["#fff"]
    assert d["hashtags"] == ["#test"] or d["hashtags"] == ["test"]
    print("✅ test_campaign_to_dict")


if __name__ == "__main__":
    setup()
    test_create_campaign()
    test_list_campaigns()
    test_get_campaign()
    test_update_campaign()
    test_delete_campaign()
    test_campaign_to_dict()
    print("\n🎉 All database tests passed!")