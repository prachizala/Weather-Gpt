"""Configuration management using pydantic-settings."""

from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable discovery and typing."""

    app_name: str = Field(default="WeatherGPT API", description="Service application name")
    app_env: str = Field(default="development", description="Environment: development, staging, production")
    app_host: str = Field(default="0.0.0.0", description="Host bind address")
    app_port: int = Field(default=8000, description="Port bind address")
    debug: bool = Field(default=False, description="Enable debug diagnostics")

    # Cache Settings
    cache_default_ttl_seconds: int = Field(default=300, description="Default TTL for cached entries in seconds")

    # Open-Meteo Configuration
    # Free tier is non-commercial only. Commercial deployment requires OPEN_METEO_COMMERCIAL=True and an API key.
    open_meteo_commercial: bool = Field(
        default=False,
        description="Whether commercial Open-Meteo access is enabled"
    )
    open_meteo_api_key: Optional[str] = Field(
        default=None,
        description="Commercial Open-Meteo API key"
    )
    open_meteo_base_url: str = Field(
        default="https://api.open-meteo.com",
        description="Base URL for forecast API"
    )
    open_meteo_archive_url: str = Field(
        default="https://archive-api.open-meteo.com",
        description="Base URL for historical weather archive API"
    )
    open_meteo_geocoding_url: str = Field(
        default="https://geocoding-api.open-meteo.com",
        description="Base URL for geocoding API"
    )
    open_meteo_air_quality_url: str = Field(
        default="https://air-quality-api.open-meteo.com",
        description="Base URL for air quality API"
    )

    # OpenRouter LLM Settings
    openrouter_api_key: Optional[str] = Field(default=None, description="OpenRouter API key")
    llm_model_main: str = Field(
        default="google/gemini-2.5-flash",
        description="Main LLM model slug in provider/model format"
    )
    llm_model_fast: str = Field(
        default="google/gemini-2.5-flash-lite",
        description="Fast, low-latency model slug in provider/model format for extraction & routing"
    )
    llm_model_fallback: Optional[str] = Field(
        default=None,
        description="Optional fallback model slug if main model fails"
    )
    openrouter_base_url: str = Field(
        default="https://openrouter.ai/api/v1",
        description="OpenRouter API base URL"
    )
    app_url: Optional[str] = Field(
        default=None,
        description="Optional HTTP-Referer attribution header for OpenRouter"
    )
    app_title: Optional[str] = Field(
        default="WeatherGPT",
        description="Optional X-Title attribution header for OpenRouter"
    )

    # RAG Settings
    rag_persist_directory: str = Field(default="data/chroma_db", description="ChromaDB persistence directory")
    rag_collection_name: str = Field(default="meteorological_knowledge", description="Chroma collection name")
    rag_relevance_threshold: float = Field(default=0.40, description="Minimum similarity score (0 to 1) for relevance")

    # Chat & Optimization Settings
    chat_request_timeout_seconds: float = Field(default=15.0, description="Per-request maximum latency timeout")
    chat_max_body_bytes: int = Field(default=8192, description="Maximum request body size in bytes for chat endpoint")
    chat_rate_limit_per_minute: int = Field(default=30, description="Max chat requests per minute per IP")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
