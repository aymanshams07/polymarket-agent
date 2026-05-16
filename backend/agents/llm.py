"""LLM factory — single place to configure models used across all agents."""
from functools import lru_cache
from langchain_anthropic import ChatAnthropic
from app.core.config import settings


@lru_cache(maxsize=4)
def get_llm(
    model: str = "claude-sonnet-4-6",
    temperature: float = 0.3,
    max_tokens: int = 4096,
) -> ChatAnthropic:
    if not settings.anthropic_api_key:
        raise ValueError(
            "ANTHROPIC_API_KEY is not set. Add it to your .env file to use AI agents."
        )
    return ChatAnthropic(
        model=model,
        api_key=settings.anthropic_api_key,
        temperature=temperature,
        max_tokens=max_tokens,
    )


# Convenience aliases
def analysis_llm() -> ChatAnthropic:
    return get_llm(model="claude-sonnet-4-6", temperature=0.2)


def debate_llm() -> ChatAnthropic:
    return get_llm(model="claude-sonnet-4-6", temperature=0.4)


def judge_llm() -> ChatAnthropic:
    return get_llm(model="claude-sonnet-4-6", temperature=0.1)
