"""LLM-powered prompt amplification using Ollama (local)."""

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
    base_url: str = "http://localhost:11537/v1"
    model: str = "qwen2.5-coder:1.5b"
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


# System prompt for the amplification task - very explicit about format
AMPLIFICATION_SYSTEM_PROMPT = """You are a social media marketing expert. Generate a JSON object for social media content creation.

CRITICAL: Respond ONLY with a valid JSON object. No markdown, no code blocks, no explanations.

The JSON MUST have these exact keys with these types:
- "prompt": string (detailed image generation prompt in English)
- "image_prompt": string (specific image prompt with style, lighting, composition)
- "video_script": array of 3 objects with "time", "scene", "description"
- "hashtags": array of strings
- "cta": string (short call to action)
- "color_palette": array of 5 hex color strings like "#FF5733"
- "style": string (one of: luxury, premium, elegant, budget, trending, hot)
- "text_overlay": string (short text in CAPS)
- "sale_type": string (one of: bundle_deal, percentage_discount, flash_promo, two_for_one, free_offer, limited_edition, promotion)
- "emotion": string (one of: exciting, exclusive, sophisticated, enthusiastic, urgent)
- "tone": string (one of: urgent, premium, professional, enthusiastic, value)
- "psychological_triggers": array of strings (from: scarcity, social_proof, urgency, value, exclusivity)

Example response:
{
  "prompt": "A luxury perfume bottle with golden accents...",
  "image_prompt": "Professional product photography, luxury perfume bottle...",
  "video_script": [
    {"time": "0-2s", "scene": "Hook", "description": "..."},
    {"time": "2-5s", "scene": "Offer", "description": "..."},
    {"time": "5-8s", "scene": "CTA", "description": "..."}
  ],
  "hashtags": ["perfume", "luxury", "oferta"],
  "cta": "Buy now!",
  "color_palette": ["#1a1a2e", "#e2b714", "#f5e6ca", "#16213e", "#c9a227"],
  "style": "luxury",
  "text_overlay": "2X800 PESOS",
  "sale_type": "bundle_deal",
  "emotion": "exciting",
  "tone": "urgent",
  "psychological_triggers": ["urgency", "value"]
}"""


class LLMPromptAmplifier:
    """Amplify prompts using LLM (Ollama local)."""

    def __init__(self, config: LLMConfig | None = None) -> None:
        self.config = config or LLMConfig()
        self._available: bool | None = None

    async def is_available(self) -> bool:
        """Check if LLM is available."""
        if self._available is not None:
            return self._available
        
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                res = await client.get(f"{self.config.base_url}/models")
                self._available = res.status_code == 200
        except Exception:
            self._available = False
        
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
            {"role": "user", "content": f"Idea: {raw_idea}\nStyle: {style_override or 'auto-detect'}"},
        ]
        
        payload = {
            "model": self.config.model,
            "messages": messages,
            "max_tokens": self.config.max_tokens,
            "temperature": self.config.temperature,
            "stream": False,
        }
        
        async with httpx.AsyncClient(timeout=self.config.timeout) as client:
            res = await client.post(
                f"{self.config.base_url}/chat/completions",
                json=payload,
            )
            res.raise_for_status()
            data = res.json()
            return data["choices"][0]["message"]["content"]

    def _parse_response(self, response: str) -> AmplifiedResult:
        """Parse LLM JSON response with flexible format handling."""
        # Clean response
        clean = response.strip()
        
        # Remove markdown code blocks
        if clean.startswith("```json"):
            clean = clean[7:]
        elif clean.startswith("```"):
            clean = clean[3:]
        if clean.endswith("```"):
            clean = clean[:-3]
        clean = clean.strip()
        
        try:
            data = json.loads(clean)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response: {e}")
            return AmplifiedResult(success=False, error=f"Invalid JSON: {e}", raw_response=response)
        
        # Extract values with flexible handling for nested objects
        def extract_str(val) -> str:
            if isinstance(val, str):
                return val
            if isinstance(val, dict):
                return val.get("text", val.get("type", str(val)))
            return str(val)
        
        def extract_list(val) -> list:
            if isinstance(val, list):
                return val
            if isinstance(val, str):
                return [val]
            return []
        
        # Handle video_script - ensure it has the right format
        video_script = data.get("video_script", [])
        formatted_script = []
        for i, scene in enumerate(video_script[:3]):  # Max 3 scenes
            if isinstance(scene, dict):
                formatted_script.append({
                    "time": str(scene.get("time", f"{i*2}-{i*2+2}s")),
                    "scene": str(scene.get("scene", f"Scene {i+1}")),
                    "description": str(scene.get("description", "")),
                })
        
        # Ensure we have exactly 3 scenes
        while len(formatted_script) < 3:
            formatted_script.append({
                "time": f"{len(formatted_script)*2}-{len(formatted_script)*2+2}s",
                "scene": ["Hook", "Offer", "CTA"][len(formatted_script)],
                "description": "",
            })
        
        # Handle color_palette - ensure 5 colors
        colors = extract_list(data.get("color_palette", []))
        while len(colors) < 5:
            colors.append(["#1a1a2e", "#e2b714", "#f5e6ca", "#16213e", "#c9a227"][len(colors)])
        
        return AmplifiedResult(
            success=True,
            prompt=extract_str(data.get("prompt", "")),
            image_prompt=extract_str(data.get("image_prompt", data.get("prompt", ""))),
            video_script=formatted_script,
            hashtags=extract_list(data.get("hashtags", [])),
            cta=extract_str(data.get("cta", "")),
            color_palette=colors[:5],
            style=extract_str(data.get("style", "")),
            text_overlay=extract_str(data.get("text_overlay", "")),
            sale_type=extract_str(data.get("sale_type", "")),
            emotion=extract_str(data.get("emotion", "")),
            tone=extract_str(data.get("tone", "")),
            psychological_triggers=extract_list(data.get("psychological_triggers", [])),
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