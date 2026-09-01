"""LLM-powered prompt amplification using Hermes/Nous Inference API."""

import os
import json
import logging
from dataclasses import dataclass, field
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


@dataclass
class LLMConfig:
    """Configuration for LLM amplification."""
    base_url: str = "https://inference-api.nousresearch.com/v1"
    api_key: str = ""
    model: str = "poolside/laguna-xs-2.1:free"
    max_tokens: int = 1024
    temperature: float = 0.7
    timeout: int = 30


@dataclass
class AmplifiedResult:
    """Result from LLM amplification."""
    success: bool
    prompt: str = ""
    image_prompt: str = ""
    video_script: list[dict] = field(default_factory=list)
    hashtags: list[str] = field(default_factory=list)
    cta: str = ""
    color_palette: list[str] = field(default_factory=list)
    style: str = ""
    text_overlay: str = ""
    sale_type: str = ""
    emotion: str = ""
    tone: str = ""
    psychological_triggers: list[str] = field(default_factory=list)
    raw_response: str = ""
    error: str = ""


# System prompt for the amplification task
AMPLIFICATION_SYSTEM_PROMPT = """Eres un experto en marketing de redes sociales y generación de contenido con IA. 
Tu trabajo es transformar ideas simples de promoción en prompts detallados para generar imágenes y videos virales.

Recibirás una idea de promoción y debes generar un JSON estricto con esta estructura:

{
  "prompt": "prompt detallado para generar imagen principal",
  "image_prompt": "prompt específico para generación de imagen (detallado, con estilo, iluminación, composición)",
  "video_script": [
    {"time": "0-2s", "scene": "Hook", "description": "descripción visual del gancho inicial"},
    {"time": "2-5s", "scene": "Offer", "description": "revelación de la oferta"},
    {"time": "5-8s", "scene": "CTA", "description": "llamada a la acción final"}
  ],
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
  "cta": "llamada a la acción corta y directa",
  "color_palette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "style": "estilo visual (luxury/premium/elegant/budget/trending/hot)",
  "text_overlay": "texto principal que aparece en la imagen/video",
  "sale_type": "tipo de venta (bundle_deal/percentage_discount/flash_promo/two_for_one/free_offer/limited_edition/promotion)",
  "emotion": "emoción principal (exciting/exclusive/sophisticated/enthusiastic/urgent)",
  "tone": "tono (urgent/premium/professional/enthusiastic/value)",
  "psychological_triggers": ["trigger1", "trigger2"]
}

Reglas:
- Los prompts de imagen deben ser en INGLÉS y muy detallados (estilo, iluminación, composición, formato 9:16)
- Los hashtags en español e inglés según la plataforma
- El text_overlay debe ser corto, impactante y en MAYÚSCULAS
- Los colores deben ser vibrantes y contrastantes
- El video_script debe tener exactamente 3 escenas
- psychological_triggers debe ser una lista de: scarcity, social_proof, urgency, value, exclusivity

Responde SOLO con el JSON, sin markdown ni explicaciones."""


class LLMPromptAmplifier:
    """Amplify prompts using LLM (Nous Inference API via Hermes)."""

    def __init__(self, config: LLMConfig | None = None) -> None:
        self.config = config or LLMConfig()
        self._available: bool | None = None

    async def is_available(self) -> bool:
        """Check if LLM is available."""
        if self._available is not None:
            return self._available
        
        if not self.config.api_key:
            # Try without auth (free tier)
            try:
                async with httpx.AsyncClient(timeout=5) as client:
                    res = await client.get(f"{self.config.base_url}/models")
                    self._available = res.status_code == 200
            except Exception:
                self._available = False
        else:
            self._available = True
        
        return self._available

    async def amplify(self, raw_idea: str, style_override: str = "") -> AmplifiedResult:
        """Amplify a raw idea using LLM."""
        if not await self.is_available():
            return AmplifiedResult(success=False, error="LLM not available")
        
        try:
            response = await self._call_llm(raw_idea, style_override)
            return self._parse_response(response)
        except Exception as e:
            logger.error(f"LLM amplification failed: {e}")
            return AmplifiedResult(success=False, error=str(e))

    async def _call_llm(self, raw_idea: str, style_override: str) -> str:
        """Call the LLM API."""
        messages = [
            {"role": "system", "content": AMPLIFICATION_SYSTEM_PROMPT},
            {"role": "user", "content": f"Idea: {raw_idea}\nEstilo: {style_override or 'auto-detectar'}"},
        ]
        
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        
        payload = {
            "model": self.config.model,
            "messages": messages,
            "max_tokens": self.config.max_tokens,
            "temperature": self.config.temperature,
        }
        
        async with httpx.AsyncClient(timeout=self.config.timeout) as client:
            res = await client.post(
                f"{self.config.base_url}/chat/completions",
                json=payload,
                headers=headers,
            )
            res.raise_for_status()
            data = res.json()
            return data["choices"][0]["message"]["content"]

    def _parse_response(self, response: str) -> AmplifiedResult:
        """Parse LLM JSON response."""
        # Clean response (remove markdown if present)
        clean = response.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1]
        if clean.endswith("```"):
            clean = clean.rsplit("\n", 1)[0]
        if clean.startswith("json"):
            clean = clean[4:].strip()
        
        try:
            data = json.loads(clean)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response: {e}")
            return AmplifiedResult(success=False, error=f"Invalid JSON: {e}", raw_response=response)
        
        return AmplifiedResult(
            success=True,
            prompt=data.get("prompt", ""),
            image_prompt=data.get("image_prompt", ""),
            video_script=data.get("video_script", []),
            hashtags=data.get("hashtags", []),
            cta=data.get("cta", ""),
            color_palette=data.get("color_palette", []),
            style=data.get("style", ""),
            text_overlay=data.get("text_overlay", ""),
            sale_type=data.get("sale_type", ""),
            emotion=data.get("emotion", ""),
            tone=data.get("tone", ""),
            psychological_triggers=data.get("psychological_triggers", []),
            raw_response=response,
        )


# Singleton instance
_amplifier: LLMPromptAmplifier | None = None


def get_amplifier() -> LLMPromptAmplifier:
    """Get the singleton amplifier instance."""
    global _amplifier
    if _amplifier is None:
        _amplifier = LLMPromptAmplifier()
    return _amplifier