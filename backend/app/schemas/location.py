"""Location schemas for WeatherGPT geocoding and entity resolution."""

from __future__ import annotations
from typing import Optional
from pydantic import Field
from backend.app.schemas.base import BaseMetadataModel, Coordinates


class Location(BaseMetadataModel):
    """Geographic location entity with administrative metadata and coordinates."""
    name: str = Field(..., min_length=1, description="Location/city name")
    country: Optional[str] = Field(default=None, description="Country name")
    country_code: Optional[str] = Field(default=None, description="ISO 3166-1 alpha-2 country code")
    admin1: Optional[str] = Field(default=None, description="First-level administrative division (e.g. state/province)")
    admin2: Optional[str] = Field(default=None, description="Second-level administrative division (e.g. county/district)")
    elevation: Optional[float] = Field(default=None, description="Elevation in meters")
    population: Optional[int] = Field(default=None, ge=0, description="Estimated population")
    coordinates: Coordinates = Field(..., description="Geographical coordinates (latitude and longitude required)")
