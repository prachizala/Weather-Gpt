"""Chat and citation schemas for WeatherGPT interaction."""

from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Optional
from pydantic import Field, model_validator
from backend.app.schemas.base import BaseMetadataModel, Coordinates
from backend.app.schemas.location import Location


class SourceRef(BaseMetadataModel):
    """Citation reference pointing to an underlying data source or document."""
    title: str = Field(..., min_length=1, description="Source or document title")
    uri: Optional[str] = Field(default=None, description="Direct URL or identifier of the source")
    summary: Optional[str] = Field(default=None, description="Summary or snippet of relevant content")
    attribution: Optional[str] = Field(
        default="Weather data by Open-Meteo.com (CC BY 4.0)",
        description="Mandatory data attribution notice",
    )
    provider: str = Field(default="open-meteo", description="Data provider identifier")
    retrieved_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp when source was consulted",
    )
    coordinates: Optional[Coordinates] = Field(default=None, description="Associated coordinates if geographic")
    timezone: str = Field(default="UTC", description="Associated timezone")
    units: dict[str, str] = Field(default_factory=dict, description="Associated measurement units")


class ChatRequest(BaseMetadataModel):
    """Incoming user chat query and contextual constraints."""
    message: str = Field(..., min_length=1, description="User prompt or meteorological question")
    conversation_id: Optional[str] = Field(default=None, description="Thread or conversation identifier")
    session_id: Optional[str] = Field(default=None, description="Session identifier alias")
    provider: str = Field(default="user", description="Request originator identifier")
    retrieved_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp when request was issued",
    )
    coordinates: Optional[Coordinates] = Field(default=None, description="Client coordinates if supplied")
    timezone: str = Field(default="UTC", description="Client timezone")
    units: dict[str, str] = Field(default_factory=dict, description="Preferred unit system")
    location: Optional[Location] = Field(default=None, description="Explicitly selected location from frontend")

    @model_validator(mode="before")
    @classmethod
    def sync_session_id(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "session_id" in data and not data.get("conversation_id"):
                data["conversation_id"] = data["session_id"]
            elif "conversation_id" in data and not data.get("session_id"):
                data["session_id"] = data["conversation_id"]
        return data


class ChatResponse(BaseMetadataModel):
    """Outgoing assistant response adhering to the Phase 3 Chat Contract."""
    answer: str = Field(default="", description="Grounded natural language answer")
    response: Optional[str] = Field(default=None, description="Response text alias")
    intent: str = Field(default="weather_query", description="Detected intent or executed tool name")
    location: Optional[Location] = Field(default=None, description="Resolved geographic location")
    valid_period: Optional[dict[str, Any]] = Field(default=None, description="Temporal validity window")
    weather_data: Optional[Any] = Field(default=None, description="Structured meteorological payload")
    sources: list[SourceRef] = Field(default_factory=list, description="Grounding source citations")
    knowledge_citations: list[SourceRef] = Field(
        default_factory=list,
        description="Knowledge-base document citations (separate from weather API sources)",
    )
    limitations: list[str] = Field(default_factory=list, description="Operational limits, horizon caps, or alerts")
    conversation_id: Optional[str] = Field(default=None, description="Thread or conversation identifier")
    language: str = Field(default="en", description="Detected or generated response language code (en, hi, gu)")
    latency_stages: dict[str, float] = Field(default_factory=dict, description="Latency breakdown in seconds per stage")

    provider: str = Field(default="weather-gpt", description="Response generator identifier")
    retrieved_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp when response was generated",
    )
    coordinates: Optional[Coordinates] = Field(default=None, description="Resolved query coordinates")
    timezone: str = Field(default="UTC", description="Resolved timezone")
    units: dict[str, str] = Field(default_factory=dict, description="Units utilized in response")

    @model_validator(mode="before")
    @classmethod
    def sync_answer_and_response(cls, data: Any) -> Any:
        if isinstance(data, dict):
            ans = data.get("answer")
            resp = data.get("response")
            if not ans and resp:
                data["answer"] = resp
            elif not resp and ans:
                data["response"] = ans
        return data
