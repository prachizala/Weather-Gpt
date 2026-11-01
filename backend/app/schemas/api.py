"""Standard API response envelope and pagination schemas."""

from __future__ import annotations
from datetime import datetime
from typing import Generic, Optional, TypeVar
from pydantic import BaseModel, Field
from backend.app.schemas.chat import SourceRef

T = TypeVar("T")


class APIResponseEnvelope(BaseModel, Generic[T]):
    """Standard unified response wrapper across WeatherGPT data endpoints."""
    data: T = Field(..., description="Payload data (single model, list, or domain object)")
    source: SourceRef = Field(..., description="Attribution and source reference")
    retrieved_at: datetime = Field(..., description="UTC timestamp when data was fetched/cached")
    units: dict[str, str] = Field(default_factory=dict, description="Units applied to variables")
    timezone: str = Field(default="UTC", description="Resolved timezone identifier")
    alerts: Optional[str] = Field(
        default=None,
        description="Official warning or regional meteorological authority notice (e.g. IMD for India)"
    )
