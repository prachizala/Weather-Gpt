"""FastAPI dependencies for WeatherGPT."""

import os
from functools import lru_cache
from backend.app.config import settings
from backend.app.services.chat_orchestrator import ChatOrchestrator
from backend.app.services.llm_provider import BaseChatLLMProvider, MockLLMProvider, OpenRouterProvider
from backend.app.services.open_meteo import OpenMeteoClient
from backend.app.services.providers import WeatherProvider
from backend.app.services.session_store import session_store
from backend.app.utils.cache import Cache, InMemoryTTLCache

# Global shared in-memory TTL cache instance
_global_cache = InMemoryTTLCache(default_ttl_seconds=300)


def get_cache() -> Cache:
    """Return the application cache backend."""
    return _global_cache


@lru_cache(maxsize=1)
def get_weather_provider() -> WeatherProvider:
    """Return configured weather provider singleton."""
    return OpenMeteoClient(cache=_global_cache)


@lru_cache(maxsize=1)
def get_llm_provider() -> BaseChatLLMProvider:
    """Return configured LLM provider singleton (OpenRouter or Mock)."""
    api_key = settings.openrouter_api_key or os.getenv("OPENROUTER_API_KEY")
    if api_key:
        return OpenRouterProvider(
            api_key=api_key,
            model_main=settings.llm_model_main,
            model_fast=settings.llm_model_fast,
            model_fallback=settings.llm_model_fallback,
            base_url=settings.openrouter_base_url,
            app_url=settings.app_url,
            app_title=settings.app_title,
        )
    # If no OpenRouter API key configured, use intelligent mock provider
    return MockLLMProvider()


def get_chat_orchestrator() -> ChatOrchestrator:
    """Return an orchestrator instance combining weather provider, LLM, and session storage."""
    return ChatOrchestrator(
        weather_provider=get_weather_provider(),
        llm_provider=get_llm_provider(),
        sessions=session_store,
    )
