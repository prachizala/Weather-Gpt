"""Base models and validation logic for WeatherGPT domain schemas."""

from __future__ import annotations
from datetime import datetime, timezone, timedelta
from typing import Any, Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator


# Recognized and validated units for meteorological and air quality metrics
ALLOWED_UNITS: dict[str, set[str]] = {
    "temperature": {"celsius", "fahrenheit", "c", "f", "°c", "°f", "k", "kelvin"},
    "apparent_temperature": {"celsius", "fahrenheit", "c", "f", "°c", "°f", "k", "kelvin"},
    "wind_speed": {"km/h", "m/s", "mph", "kn", "knots"},
    "precipitation": {"mm", "inch", "inches", "cm"},
    "pressure": {"hpa", "kpa", "pa", "bar", "psi", "atm"},
    "surface_pressure": {"hpa", "kpa", "pa", "bar", "psi", "atm"},
    "relative_humidity": {"%", "percent", "fraction"},
    "cloud_cover": {"%", "percent", "fraction"},
    "pm2_5": {"μg/m³", "ug/m3", "µg/m³", "mg/m3"},
    "pm10": {"μg/m³", "ug/m3", "µg/m³", "mg/m3"},
    "aqi": {"index", "points", "us_aqi", "eu_aqi"},
    "carbon_monoxide": {"μg/m³", "ug/m3", "µg/m³", "mg/m3", "ppm"},
    "nitrogen_dioxide": {"μg/m³", "ug/m3", "µg/m³", "mg/m3", "ppb"},
    "sulphur_dioxide": {"μg/m³", "ug/m3", "µg/m³", "mg/m3", "ppb"},
    "ozone": {"μg/m³", "ug/m3", "µg/m³", "mg/m3", "ppb"},
    "uv_index": {"index", "points"},
}


class Coordinates(BaseModel):
    """Geographical coordinates representing latitude, longitude, and elevation."""
    model_config = ConfigDict(extra="forbid")

    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees (-90 to 90)")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees (-180 to 180)")
    elevation: Optional[float] = Field(default=None, description="Elevation above sea level in meters")


class BaseMetadataModel(BaseModel):
    """Base model enforcing core metadata: provider, retrieved_at, coordinates, timezone, units."""
    model_config = ConfigDict(extra="forbid")

    provider: str = Field(..., min_length=1, description="Data provider identifier (e.g. 'open-meteo')")
    retrieved_at: datetime = Field(..., description="UTC timestamp when data was retrieved or record created")
    coordinates: Optional[Coordinates] = Field(default=None, description="Geographical coordinates")
    timezone: str = Field(..., min_length=1, description="IANA timezone name or abbreviation (e.g. 'UTC', 'America/New_York')")
    units: dict[str, str] = Field(default_factory=dict, description="Dictionary mapping variable names to their measurement units")

    @field_validator("units", mode="after")
    @classmethod
    def validate_units(cls, units_dict: dict[str, str]) -> dict[str, str]:
        for var_name, unit in units_dict.items():
            norm_var = var_name.lower().strip()
            norm_unit = unit.lower().strip()
            if norm_var in ALLOWED_UNITS:
                if norm_unit not in ALLOWED_UNITS[norm_var]:
                    allowed = sorted(list(ALLOWED_UNITS[norm_var]))
                    raise ValueError(
                        f"Invalid unit '{unit}' for variable '{var_name}'. Allowed units: {allowed}"
                    )
        return units_dict

    @field_validator("retrieved_at", mode="after")
    @classmethod
    def validate_retrieved_at(cls, v: datetime) -> datetime:
        now = datetime.now(timezone.utc)
        v_utc = v if v.tzinfo else v.replace(tzinfo=timezone.utc)
        # Prevent timestamps in the far future
        if v_utc > now + timedelta(days=2):
            raise ValueError(f"retrieved_at timestamp cannot be in the future: {v}")
        return v
