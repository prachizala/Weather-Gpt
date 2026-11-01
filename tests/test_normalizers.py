"""Tests for Open-Meteo payload normalization and schema transformation."""

import pytest
from backend.app.services.exceptions import UpstreamDataError
from backend.app.services.normalizers import (
    normalize_air_quality,
    normalize_current_weather,
    normalize_forecast,
    normalize_historical_weather,
    normalize_locations,
)


def test_normalize_locations_success():
    """Verify raw geocoding JSON is normalized to Location models."""
    raw = {
        "results": [
            {
                "id": 1279233,
                "name": "Ahmedabad",
                "latitude": 23.0225,
                "longitude": 72.5714,
                "elevation": 53.0,
                "country_code": "IN",
                "country": "India",
                "admin1": "Gujarat",
                "admin2": "Ahmadabad",
                "timezone": "Asia/Kolkata",
                "population": 6357693,
            }
        ]
    }
    locations = normalize_locations(raw)
    assert len(locations) == 1
    loc = locations[0]
    assert loc.name == "Ahmedabad"
    assert loc.country == "India"
    assert loc.country_code == "IN"
    assert loc.coordinates.latitude == 23.0225
    assert loc.coordinates.longitude == 72.5714
    assert loc.provider == "open-meteo"
    assert loc.timezone == "Asia/Kolkata"


def test_normalize_locations_empty():
    """Empty or missing results list returns an empty list."""
    assert normalize_locations({}) == []
    assert normalize_locations({"results": []}) == []


def test_normalize_locations_malformed():
    """Non-dict payload raises UpstreamDataError."""
    with pytest.raises(UpstreamDataError):
        normalize_locations(["not", "a", "dict"])  # type: ignore


def test_normalize_current_weather_success():
    """Verify raw current weather JSON is converted to WeatherSnapshot."""
    raw = {
        "latitude": 23.0225,
        "longitude": 72.5714,
        "elevation": 53.0,
        "timezone": "Asia/Kolkata",
        "current_units": {
            "temperature_2m": "°C",
            "wind_speed_10m": "km/h",
            "precipitation": "mm",
        },
        "current": {
            "time": "2026-10-18T10:00",
            "temperature_2m": 33.5,
            "apparent_temperature": 35.1,
            "relative_humidity_2m": 42.0,
            "precipitation": 0.0,
            "weather_code": 1,
            "cloud_cover": 20.0,
            "surface_pressure": 1010.2,
            "wind_speed_10m": 8.5,
            "wind_direction_10m": 120.0,
            "is_day": 1,
        },
    }
    snapshot = normalize_current_weather(raw)
    assert snapshot.temperature == 33.5
    assert snapshot.apparent_temperature == 35.1
    assert snapshot.coordinates.latitude == 23.0225
    assert snapshot.coordinates.longitude == 72.5714
    assert snapshot.provider == "open-meteo"
    assert snapshot.timezone == "Asia/Kolkata"
    assert snapshot.units["temperature"] == "celsius"
    assert snapshot.units["wind_speed"] == "km/h"


def test_normalize_current_weather_missing_variables():
    """Missing required variables like temperature_2m raises UpstreamDataError."""
    raw_missing_temp = {
        "latitude": 23.0225,
        "longitude": 72.5714,
        "current": {
            "time": "2026-10-18T10:00",
            # temperature_2m missing!
        },
    }
    with pytest.raises(UpstreamDataError) as exc_info:
        normalize_current_weather(raw_missing_temp)
    assert "Missing required current weather variables" in str(exc_info.value)


def test_normalize_forecast_daily_and_hourly():
    """Verify forecast normalization produces both DailyForecast and ForecastPoint lists."""
    raw = {
        "latitude": 23.0225,
        "longitude": 72.5714,
        "elevation": 53.0,
        "timezone": "Asia/Kolkata",
        "daily_units": {"temperature_2m_max": "°C", "precipitation_sum": "mm"},
        "hourly_units": {"temperature_2m": "°C", "wind_speed_10m": "km/h"},
        "daily": {
            "time": ["2026-10-18", "2026-10-19"],
            "temperature_2m_max": [35.0, 36.0],
            "temperature_2m_min": [24.0, 25.0],
            "apparent_temperature_max": [37.0, 38.0],
            "apparent_temperature_min": [25.0, 26.0],
            "precipitation_sum": [0.0, 1.2],
            "precipitation_probability_max": [10.0, 40.0],
            "weather_code": [1, 2],
            "wind_speed_10m_max": [12.0, 15.0],
            "wind_direction_10m_dominant": [180.0, 200.0],
            "uv_index_max": [8.0, 7.5],
        },
        "hourly": {
            "time": ["2026-10-18T00:00", "2026-10-18T01:00"],
            "temperature_2m": [26.0, 25.5],
            "apparent_temperature": [27.0, 26.5],
            "precipitation_probability": [0.0, 0.0],
            "precipitation": [0.0, 0.0],
            "weather_code": [0, 0],
            "wind_speed_10m": [5.0, 4.8],
            "wind_direction_10m": [150.0, 160.0],
        },
    }
    forecast_data = normalize_forecast(raw)
    assert len(forecast_data.daily) == 2
    assert len(forecast_data.hourly) == 2

    assert forecast_data.daily[0].date == "2026-10-18"
    assert forecast_data.daily[0].temperature_max == 35.0
    assert forecast_data.daily[0].temperature_min == 24.0
    assert forecast_data.daily[0].coordinates.latitude == 23.0225

    assert forecast_data.hourly[0].temperature == 26.0
    assert forecast_data.hourly[0].wind_speed == 5.0


def test_normalize_historical_weather_success():
    """Verify historical weather normalization creates HistoricalRecord instances with reanalysis type."""
    raw = {
        "latitude": 23.0225,
        "longitude": 72.5714,
        "elevation": 53.0,
        "timezone": "Asia/Kolkata",
        "hourly_units": {"temperature_2m": "°C", "precipitation": "mm"},
        "hourly": {
            "time": ["2026-10-01T00:00", "2026-10-01T01:00"],
            "temperature_2m": [28.2, 27.9],
            "apparent_temperature": [30.1, 29.5],
            "precipitation": [0.0, 0.0],
            "relative_humidity_2m": [65.0, 68.0],
            "wind_speed_10m": [7.2, 6.5],
            "surface_pressure": [1008.0, 1007.8],
            "weather_code": [1, 1],
        },
    }
    records = normalize_historical_weather(raw)
    assert len(records) == 2
    assert records[0].dataset_type == "reanalysis"
    assert records[0].temperature == 28.2
    assert records[0].coordinates.latitude == 23.0225
    assert records[0].units["temperature"] == "celsius"


def test_normalize_air_quality_success():
    """Verify air quality normalization populates metrics and AQI."""
    raw = {
        "latitude": 23.0225,
        "longitude": 72.5714,
        "elevation": 53.0,
        "timezone": "Asia/Kolkata",
        "current_units": {"pm2_5": "μg/m³", "pm10": "μg/m³", "us_aqi": ""},
        "current": {
            "time": "2026-10-18T10:00",
            "pm10": 45.2,
            "pm2_5": 22.8,
            "carbon_monoxide": 310.0,
            "nitrogen_dioxide": 18.5,
            "sulphur_dioxide": 6.2,
            "ozone": 52.0,
            "uv_index": 7.4,
            "us_aqi": 72.0,
        },
    }
    aqi = normalize_air_quality(raw)
    assert aqi.pm2_5 == 22.8
    assert aqi.pm10 == 45.2
    assert aqi.aqi == 72.0
    assert aqi.uv_index == 7.4
    assert aqi.coordinates.latitude == 23.0225
    assert aqi.units["pm2_5"] == "μg/m³"
