"""Prompt amplifier: main entry point combining all modules."""

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


def amplify(
    raw_idea: str,
    style_override: str | None = None,
) -> AmplificationResult:
    """Full amplification pipeline: parse → analyze → build → adapt."""
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
    )


# Initialize submodules to avoid import issues
__all__ = [
    "AmplificationResult",
    "AmplifiedPrompt",
    "IntentAnalysis",
    "ParsedIdea",
    "PlatformPrompt",
    "adapt_for_all_platforms",
    "adapt_for_platform",
    "amplify",
    "analyze_intent",
    "build_diffusion_message",
    "build_prompt",
    "parse_idea",
]
