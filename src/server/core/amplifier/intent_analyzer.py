"""Intent analyzer: classify sale intent, emotion, urgency from parsed idea."""

from dataclasses import dataclass, field

from .parser import ParsedIdea


@dataclass
class IntentAnalysis:
    sale_type: str = "promotion"
    emotion: str = "enthusiastic"
    urgency: str = "medium"
    tone: str = "professional"
    psychological_triggers: list[str] = field(default_factory=list)
    target_audience: str = "general"
    cta: str = "Contact for more info"
    suggested_hashtags: list[str] = field(default_factory=list)


_SALE_TYPE_MAP = {
    "bundle": "bundle_deal",
    "percent_discount": "percentage_discount",
    "generic_promo": "flash_promo",
    "two_for_one": "two_for_one",
    "free": "free_offer",
    "scarcity": "limited_edition",
}

_EMOTION_TONE_MAP = {
    "luxury": ("exclusive", "premium"),
    "elegant": ("sophisticated", "classy"),
    "exclusive": ("exclusive", "premium"),
    "premium": ("premium", "luxury"),
    "budget": ("affordable", "value"),
    "savings": ("value", "smart_shopper"),
    "urgent": ("urgent", "fomo"),
    "fast": ("quick", "urgent"),
    "limited": ("limited", "fomo"),
    "new": ("fresh", "trending"),
    "trending": ("trending", "viral"),
}

_TRIGGER_KEYWORDS = {
    "scarcity": ["limited", "few", "last", "urgent", "escaso", "limitado"],
    "social_proof": ["best", "top", "favorite", "favorito", "popular"],
    "urgency": ["today", "hoy", "now", "ahora", "2x", "x"],
    "value": ["deal", "oferta", "promo", "2x800", "descount"],
    "exclusivity": ["exclusive", "only", "solo", "vip", "special"],
}


def analyze_intent(parsed: ParsedIdea) -> IntentAnalysis:
    """Analyze parsed idea to determine sale intent and psychological triggers."""
    analysis = IntentAnalysis()

    # Sale type
    if parsed.offer_type:
        analysis.sale_type = _SALE_TYPE_MAP.get(parsed.offer_type, "promotion")

    # Emotion and tone
    emotion_keyword = parsed.emotion
    if emotion_keyword and emotion_keyword in _EMOTION_TONE_MAP:
        analysis.emotion = _EMOTION_TONE_MAP[emotion_keyword][0]
        analysis.tone = _EMOTION_TONE_MAP[emotion_keyword][1]
    elif parsed.urgency == "high":
        analysis.tone = "urgent"
        analysis.emotion = "exciting"

    # Urgency
    if parsed.urgency == "high":
        analysis.urgency = "high"
    elif parsed.price:
        analysis.urgency = "medium"

    # Psychological triggers
    for trigger, keywords in _TRIGGER_KEYWORDS.items():
        text_lower = parsed.raw_text.lower()
        if any(kw in text_lower for kw in keywords):
            analysis.psychological_triggers.append(trigger)

    # Default triggers if none detected
    if not analysis.psychological_triggers:
        analysis.psychological_triggers = ["value", "urgency"]

    # CTA based on sale type
    _CTA_MAP = {
        "bundle_deal": "Lleva 2 por el precio de 1",
        "percentage_discount": "No pierdas tu descuento",
        "flash_promo": "Aprovecha esta oferta",
        "two_for_one": "2x1, llévate el doble",
        "free_offer": "Gratis, solo por tiempo limitado",
        "limited_edition": "Últimas unidades, actúa ya",
    }
    analysis.cta = _CTA_MAP.get(analysis.sale_type, "Contacta para más info")

    # Suggested hashtags
    base_tags = ["ofertas", "promo", "descuento"]
    if parsed.product_type:
        base_tags.append(parsed.product_type)
    if analysis.emotion:
        base_tags.append(analysis.emotion)
    analysis.suggested_hashtags = base_tags

    return analysis
