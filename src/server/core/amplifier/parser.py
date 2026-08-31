"""Parser: extract key entities from a raw promotional idea."""

import re
from dataclasses import dataclass, field


@dataclass
class ParsedIdea:
    product_type: str = ""
    offer_type: str = ""
    price: str | None = None
    original_price: str | None = None
    discount_pct: int | None = None
    urgency: str = ""
    emotion: str = ""
    raw_text: str = ""
    keywords: list[str] = field(default_factory=list)


# Patterns for Spanish promotional language
_OFFER_PATTERNS = [
    (
        re.compile(r"\b(\d+)\s*[x×]\s*(\d+)\s*(?:pesos?|MXN?|\$)\b", re.IGNORECASE),
        "bundle",
    ),
    (
        re.compile(r"\b(\d+)%\s*(?:de\s*)?descuento\b", re.IGNORECASE),
        "percent_discount",
    ),
    (
        re.compile(r"\b(descuento|oferta|promoci|promo)\b", re.IGNORECASE),
        "generic_promo",
    ),
    (re.compile(r"\b2x1\b", re.IGNORECASE), "two_for_one"),
    (re.compile(r"\b(gratis|free|sin costo)\b", re.IGNORECASE), "free"),
    (
        re.compile(r"\b(ultimas\s+unidades|agotandose|agotamiento)\b", re.IGNORECASE),
        "scarcity",
    ),
]

_EMOTION_KEYWORDS = {
    "lujo": "luxury",
    "elegante": "elegant",
    "exclusivo": "exclusive",
    "premium": "premium",
    "boutique": "boutique",
    "refinado": "refined",
    "barato": "budget",
    "econmico": "budget",
    "ahorro": "savings",
    "urgente": "urgent",
    "rpido": "fast",
    "limitado": "limited",
    "nuevo": "new",
    "tendencia": "trending",
    "hot": "hot",
}


def parse_idea(raw_text: str) -> ParsedIdea:
    """Parse a raw promotional idea into structured entities."""
    text = raw_text.strip()
    if not text:
        return ParsedIdea(raw_text="")

    idea = ParsedIdea(raw_text=text)
    idea.keywords = [w.lower() for w in re.findall(r"\b[a-z]{3,}\b", text.lower())]

    # Extract offer type
    for pattern, offer_type in _OFFER_PATTERNS:
        match = pattern.search(text)
        if match:
            idea.offer_type = offer_type
            if offer_type == "bundle" and match.groups():
                idea.price = match.group(2)
            break

    # Extract price
    price_match = re.search(r"(\d+)\s*(?:pesos?|\$|MXN?)", text, re.IGNORECASE)
    if price_match:
        idea.price = price_match.group(1)

    # Extract emotion/tone
    for kw, emotion in _EMOTION_KEYWORDS.items():
        if kw.lower() in text.lower():
            idea.emotion = emotion
            break

    # Detect urgency cues
    urgency_cues = [
        "2x",
        "oferta",
        "promo",
        "limitado",
        "escaso",
        "hoy",
        "últimas unidades",
        "agotandose",
        "agotamiento",
    ]
    for cue in urgency_cues:
        if cue.lower() in text.lower():
            idea.urgency = "high"
            break

    # Product type: first noun before offer keywords, or first significant word
    _STOP_WORDS = {
        "la",
        "el",
        "los",
        "las",
        "un",
        "una",
        "del",
        "al",
        "en",
        "por",
        "con",
        "para",
        "de",
        "y",
        "o",
        "2x",
        "x",
    }
    words = re.findall(r"\b[a-z]{3,}\b", text.lower())
    product_words = [w for w in words if w not in _STOP_WORDS]
    if product_words:
        idea.product_type = product_words[0]

    return idea
