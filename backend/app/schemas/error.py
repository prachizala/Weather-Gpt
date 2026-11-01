"""Standard error response schema across WeatherGPT."""

from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from pydantic import Field
from backend.app.schemas.base import BaseMetadataModel, Coordinates


class ErrorResponse(BaseMetadataModel):
    """Standardized API error response."""
    error: str = Field(..., min_length=1, description="Short error name or reason")
    detail: Optional[str] = Field(default=None, description="Detailed explanatory message or traceback context")
    code: str = Field(default="INTERNAL_ERROR", description="Machine-readable uppercase error code")
    status_code: int = Field(default=500, description="HTTP response status code")
    provider: str = Field(default="weather-gpt", description="Reporting subsystem or provider")
    retrieved_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of the error occurrence"
    )
    coordinates: Optional[Coordinates] = Field(default=None, description="Coordinates associated with the failed request")
    timezone: str = Field(default="UTC", description="Timezone associated with the error")
    units: dict[str, str] = Field(default_factory=dict, description="Units associated with the request context")
