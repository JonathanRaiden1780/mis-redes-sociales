"""Prompt amplifier: main entry point combining all modules with LLM enhancement."""

from dataclasses import dataclass

from .intent_analyzer import IntentAnalysis, analyze_intent
from .parser import ParsedIdea, parse_idea
from .platform_adapter import (
    PlatformPrompt,
    adapt_for_all_platforms,
    build_diffusion_message,
)
from .prompt_builder import AmplifiedPrompt, build_prompt


@dataclass
class AmplificationResult:
    parsed_idea: ParsedIdea
    intent: IntentAnalysis
    amplified_prompt: AmplifiedPrompt
    platform_prompts: dict[str, PlatformPrompt]
    diffusion_message: str = ""
    llm_enhanced: bool = False


def amplify(
    raw_idea: str,
    style_override: str | None = None,
) -> AmplificationResult:
    """Full amplification pipeline: parse → analyze → build → adapt.
    
    Uses LLM enhancement when available, falls back to rule-based system.
    """
    # Try LLM enhancement first
    try:
        from src.server.core.llm_amplifier import get_amplifier
        import asyncio
        
        amplifier = get_amplifier()
        
        # Check if LLM is available (async)
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # We're in an async context, create a new loop
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, amplifier.is_available())
                    llm_available = future.result(timeout=5)
            else:
                llm_available = asyncio.run(amplifier.is_available())
        except Exception:
            llm_available = False
        
        if llm_available:
            # Use LLM for amplification
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor() as executor:
                        future = executor.submit(asyncio.run, amplifier.amplify(raw_idea, style_override or ""))
                        llm_result = future.result(timeout=30)
                else:
                    llm_result = asyncio.run(amplifier.amplify(raw_idea, style_override or ""))
                
                if llm_result.success:
                    return _build_from_llm(llm_result)
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"LLM amplification failed, using fallback: {e}")
    
    except Exception:
        pass
    
    # Fallback to rule-based system
    parsed = parse_idea(raw_idea)
    intent = analyze_intent(parsed)
    amplified = build_prompt(parsed, intent, style_override)
    platform_prompts = adapt_for_all_platforms(amplified)
    diffusion_message = build_diffusion_message(amplified)

    return AmplificationResult(
        parsed_idea=parsed,
        intent=intent,
        amplified_prompt=amplified,
        platform_prompts=platform_prompts,
        diffusion_message=diffusion_message,
        llm_enhanced=False,
    )


def _build_from_llm(llm_result) -> AmplificationResult:
    """Build AmplificationResult from LLM output."""
    from .parser import ParsedIdea
    from .intent_analyzer import IntentAnalysis
    from .prompt_builder import AmplifiedPrompt
    from .platform_adapter import PlatformPrompt, adapt_for_platform
    
    # Build platform prompts from LLM output
    platform_prompts = {}
    for platform_name in ["instagram", "tiktok", "facebook", "whatsapp"]:
        pp = PlatformPrompt(
            platform=platform_name,
            prompt=llm_result.image_prompt or llm_result.prompt,
            format={"instagram": "9:16", "tiktok": "9:16", "facebook": "16:9", "whatsapp": "1:1"}[platform_name],
            hashtags=llm_result.hashtags,
            additional_params={"media_type": "IMAGE", "aspect_ratio": "9:16"},
        )
        platform_prompts[platform_name] = pp
    
    # Build AmplifiedPrompt
    amplified = AmplifiedPrompt(
        image_prompt=llm_result.image_prompt or llm_result.prompt,
        video_script=llm_result.video_script,
        hashtags=llm_result.hashtags,
        cta=llm_result.cta,
        color_palette=llm_result.color_palette,
        style=llm_result.style,
        text_overlay=llm_result.text_overlay,
        platform_prompts={k: v.prompt for k, v in platform_prompts.items()},
    )
    
    # Build IntentAnalysis
    intent = IntentAnalysis(
        sale_type=llm_result.sale_type,
        emotion=llm_result.emotion,
        tone=llm_result.tone,
        cta=llm_result.cta,
        psychological_triggers=llm_result.psychological_triggers,
    )
    
    # Build diffusion message
    diffusion = f"🔥 {llm_result.text_overlay}\n📩 {llm_result.cta}\n{' '.join(llm_result.hashtags[:5])}"
    
    return AmplificationResult(
        parsed_idea=ParsedIdea(raw_text=llm_result.text_overlay),
        intent=intent,
        amplified_prompt=amplified,
        platform_prompts=platform_prompts,
        diffusion_message=diffusion,
        llm_enhanced=True,
    )


# Initialize submodules to avoid import issues
__all__ = [
    "AmplificationResult",
    "AmplifiedPrompt",
    "IntentAnalysis",
    "ParsedIdea",
    "PlatformPrompt",
    "amplify",
    "analyze_intent",
    "build_prompt",
    "adapt_for_platform",
    "adapt_for_all_platforms",
    "build_diffusion_message",
]