"""Weather, forecast, historical records, and air quality schemas."""

from __future__ import annotations
from datetime import datetime, timezone, timedelta
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator, ValidationInfo
from backend.app.schemas.base import BaseMetadataModel, Coordinates

DatasetType = Literal["observation", "reanalysis", "forecast"]


class WeatherSnapshot(BaseMetadataModel):
    """Snapshot of current weather conditions for a specific point and time."""
    timestamp: datetime = Field(..., description="Timestamp of the weather observation")
    temperature: float = Field(..., description="Current temperature")
    apparent_temperature: Optional[float] = Field(default=None, description="Feels-like temperature")
    relative_humidity: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Relative humidity in percentage (0-100)")
    precipitation: Optional[float] = Field(default=None, ge=0.0, description="Precipitation amount")
    weather_code: Optional[int] = Field(default=None, ge=0, le=99, description="WMO Weather interpretation code (0-99)")
    cloud_cover: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Cloud cover percentage (0-100)")
    surface_pressure: Optional[float] = Field(default=None, ge=0.0, description="Surface atmospheric pressure")
    wind_speed: Optional[float] = Field(default=None, ge=0.0, description="Wind speed")
    wind_direction: Optional[float] = Field(default=None, ge=0.0, le=360.0, description="Wind direction in degrees (0-360)")
    is_day: Optional[int] = Field(default=None, ge=0, le=1, description="Day indicator: 1 for day, 0 for night")
    coordinates: Coordinates = Field(..., description="Geographical coordinates (latitude and longitude required)")


class ForecastPoint(BaseMetadataModel):
    """Forecast data point for a future timestamp."""
    timestamp: datetime = Field(..., description="Forecast target timestamp")
    temperature: float = Field(..., description="Forecasted temperature")
    apparent_temperature: Optional[float] = Field(default=None, description="Forecasted feels-like temperature")
    precipitation_probability: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Precipitation probability (0-100)")
    precipitation: Optional[float] = Field(default=None, ge=0.0, description="Forecasted precipitation amount")
    weather_code: Optional[int] = Field(default=None, ge=0, le=99, description="WMO weather code (0-99)")
    wind_speed: Optional[float] = Field(default=None, ge=0.0, description="Forecasted wind speed")
    wind_direction: Optional[float] = Field(default=None, ge=0.0, le=360.0, description="Forecasted wind direction in degrees (0-360)")
    coordinates: Coordinates = Field(..., description="Geographical coordinates (latitude and longitude required)")


class DailyForecast(BaseMetadataModel):
    """Daily forecast summary metrics."""
    date: str = Field(..., description="Forecast date in YYYY-MM-DD format")
    temperature_max: float = Field(..., description="Maximum forecasted daily temperature")
    temperature_min: float = Field(..., description="Minimum forecasted daily temperature")
    apparent_temperature_max: Optional[float] = Field(default=None, description="Maximum apparent temperature")
    apparent_temperature_min: Optional[float] = Field(default=None, description="Minimum apparent temperature")
    precipitation_sum: Optional[float] = Field(default=None, ge=0.0, description="Total daily precipitation sum")
    precipitation_probability_max: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Maximum precipitation probability (0-100)")
    weather_code: Optional[int] = Field(default=None, ge=0, le=99, description="Dominant WMO weather code (0-99)")
    wind_speed_max: Optional[float] = Field(default=None, ge=0.0, description="Maximum daily wind speed")
    wind_direction_dominant: Optional[float] = Field(default=None, ge=0.0, le=360.0, description="Dominant wind direction (0-360)")
    uv_index_max: Optional[float] = Field(default=None, ge=0.0, description="Maximum UV index")
    coordinates: Coordinates = Field(..., description="Geographical coordinates (latitude and longitude required)")


class ForecastData(BaseModel):
    """Container holding both daily summaries and granular hourly forecast points."""
    daily: list[DailyForecast] = Field(default_factory=list, description="List of daily forecast summaries")
    hourly: list[ForecastPoint] = Field(default_factory=list, description="List of hourly forecast points")


class HistoricalRecord(BaseMetadataModel):
    """Historical weather record with dataset classification (observation, reanalysis, forecast)."""
    dataset_type: DatasetType = Field(..., description="Source dataset type: observation, reanalysis, or forecast")
    timestamp: datetime = Field(..., description="Historical record timestamp")
    temperature: float = Field(..., description="Historical temperature")
    apparent_temperature: Optional[float] = Field(default=None, description="Apparent temperature")
    precipitation: Optional[float] = Field(default=None, ge=0.0, description="Precipitation amount")
    relative_humidity: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Relative humidity in percentage (0-100)")
    wind_speed: Optional[float] = Field(default=None, ge=0.0, description="Wind speed")
    surface_pressure: Optional[float] = Field(default=None, ge=0.0, description="Surface pressure")
    weather_code: Optional[int] = Field(default=None, ge=0, le=99, description="WMO weather code (0-99)")
    coordinates: Coordinates = Field(..., description="Geographical coordinates (latitude and longitude required)")

    @field_validator("timestamp", mode="after")
    @classmethod
    def validate_historical_timestamp(cls, v: datetime, info: ValidationInfo) -> datetime:
        dataset_type = info.data.get("dataset_type")
        if dataset_type in ("observation", "reanalysis"):
            now = datetime.now(timezone.utc)
            v_utc = v if v.tzinfo else v.replace(tzinfo=timezone.utc)
            if v_utc > now + timedelta(days=1):
                raise ValueError(
                    f"Historical '{dataset_type}' timestamp cannot be in the future: {v}"
                )
        return v


class AirQuality(BaseMetadataModel):
    """Air quality metrics and atmospheric composition data."""
    timestamp: datetime = Field(..., description="Timestamp of air quality measurement")
    aqi: Optional[float] = Field(default=None, ge=0.0, description="Composite air quality index")
    pm2_5: Optional[float] = Field(default=None, ge=0.0, description="Particulate matter < 2.5 µm concentration")
    pm10: Optional[float] = Field(default=None, ge=0.0, description="Particulate matter < 10 µm concentration")
    carbon_monoxide: Optional[float] = Field(default=None, ge=0.0, description="Carbon monoxide (CO) concentration")
    nitrogen_dioxide: Optional[float] = Field(default=None, ge=0.0, description="Nitrogen dioxide (NO2) concentration")
    sulphur_dioxide: Optional[float] = Field(default=None, ge=0.0, description="Sulphur dioxide (SO2) concentration")
    ozone: Optional[float] = Field(default=None, ge=0.0, description="Ozone (O3) concentration")
    uv_index: Optional[float] = Field(default=None, ge=0.0, description="UV index")
    coordinates: Coordinates = Field(..., description="Geographical coordinates (latitude and longitude required)")
