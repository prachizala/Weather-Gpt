"""Data normalization converting raw Open-Meteo provider JSON into validated Pydantic models."""

from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Optional
from backend.app.schemas.base import Coordinates
from backend.app.schemas.location import Location
from backend.app.schemas.weather import (
    AirQuality,
    DailyForecast,
    ForecastData,
    ForecastPoint,
    HistoricalRecord,
    WeatherSnapshot,
)
from backend.app.services.exceptions import UpstreamDataError


def _parse_timestamp(ts_str: str, tz_name: str = "UTC") -> datetime:
    """Parse an ISO 8601 string from Open-Meteo into a timezone-aware UTC datetime."""
    try:
        dt = datetime.fromisoformat(ts_str)
        if dt.tzinfo is None:
            # Open-Meteo returns times in requested timezone; assume UTC for domain consistency
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception as e:
        raise UpstreamDataError(f"Malformed timestamp string '{ts_str}': {e}") from e


def _normalize_units(raw_units: Optional[dict[str, Any]]) -> dict[str, str]:
    """Normalize Open-Meteo unit labels into standard schema unit identifiers."""
    if not raw_units:
        return {}

    normalized: dict[str, str] = {}
    unit_mapping = {
        "temperature_2m": ("temperature", lambda u: "fahrenheit" if "f" in u.lower() else "celsius"),
        "temperature_2m_max": ("temperature", lambda u: "fahrenheit" if "f" in u.lower() else "celsius"),
        "temperature_2m_min": ("temperature", lambda u: "fahrenheit" if "f" in u.lower() else "celsius"),
        "apparent_temperature": ("apparent_temperature", lambda u: "fahrenheit" if "f" in u.lower() else "celsius"),
        "apparent_temperature_max": ("apparent_temperature", lambda u: "fahrenheit" if "f" in u.lower() else "celsius"),
        "apparent_temperature_min": ("apparent_temperature", lambda u: "fahrenheit" if "f" in u.lower() else "celsius"),
        "wind_speed_10m": ("wind_speed", lambda u: "mph" if "mph" in u.lower() else ("m/s" if "m/s" in u.lower() else "km/h")),
        "wind_speed_10m_max": ("wind_speed", lambda u: "mph" if "mph" in u.lower() else ("m/s" if "m/s" in u.lower() else "km/h")),
        "precipitation": ("precipitation", lambda u: "inch" if "inch" in u.lower() else "mm"),
        "precipitation_sum": ("precipitation", lambda u: "inch" if "inch" in u.lower() else "mm"),
        "relative_humidity_2m": ("relative_humidity", lambda _: "%"),
        "cloud_cover": ("cloud_cover", lambda _: "%"),
        "surface_pressure": ("surface_pressure", lambda _: "hpa"),
        "pm2_5": ("pm2_5", lambda _: "μg/m³"),
        "pm10": ("pm10", lambda _: "μg/m³"),
        "carbon_monoxide": ("carbon_monoxide", lambda _: "μg/m³"),
        "nitrogen_dioxide": ("nitrogen_dioxide", lambda _: "μg/m³"),
        "sulphur_dioxide": ("sulphur_dioxide", lambda _: "μg/m³"),
        "ozone": ("ozone", lambda _: "μg/m³"),
        "uv_index": ("uv_index", lambda _: "index"),
        "uv_index_max": ("uv_index", lambda _: "index"),
        "us_aqi": ("aqi", lambda _: "us_aqi"),
        "european_aqi": ("aqi", lambda _: "eu_aqi"),
    }

    for raw_var, raw_unit in raw_units.items():
        if raw_var in unit_mapping:
            canonical_var, mapper = unit_mapping[raw_var]
            try:
                normalized[canonical_var] = mapper(str(raw_unit))
            except Exception:
                normalized[canonical_var] = str(raw_unit)

    return normalized


def normalize_locations(raw_json: dict[str, Any]) -> list[Location]:
    """Parse Open-Meteo geocoding search response into list of Location models."""
    if not isinstance(raw_json, dict):
        raise UpstreamDataError("Malformed geocoding response: expected JSON object")

    results = raw_json.get("results")
    if not results:
        return []

    if not isinstance(results, list):
        raise UpstreamDataError("Malformed geocoding response: 'results' is not a list")

    now = datetime.now(timezone.utc)
    locations: list[Location] = []

    for item in results:
        if not isinstance(item, dict):
            continue
        try:
            name = item.get("name")
            lat = item.get("latitude")
            lon = item.get("longitude")
            if not name or lat is None or lon is None:
                continue

            loc = Location(
                name=name,
                country=item.get("country"),
                country_code=item.get("country_code"),
                admin1=item.get("admin1"),
                admin2=item.get("admin2"),
                elevation=item.get("elevation"),
                population=item.get("population"),
                coordinates=Coordinates(
                    latitude=float(lat),
                    longitude=float(lon),
                    elevation=item.get("elevation"),
                ),
                provider="open-meteo",
                retrieved_at=now,
                timezone=item.get("timezone", "UTC") or "UTC",
                units={},
            )
            locations.append(loc)
        except Exception as e:
            # Ignore individual malformed entries, continue parsing
            continue

    return locations


def normalize_current_weather(raw_json: dict[str, Any]) -> WeatherSnapshot:
    """Parse Open-Meteo current weather payload into WeatherSnapshot model."""
    if not isinstance(raw_json, dict):
        raise UpstreamDataError("Malformed weather payload: expected JSON object")

    current = raw_json.get("current")
    if not current or not isinstance(current, dict):
        raise UpstreamDataError("Missing 'current' object in Open-Meteo response")

    lat = raw_json.get("latitude")
    lon = raw_json.get("longitude")
    if lat is None or lon is None:
        raise UpstreamDataError("Missing coordinates in Open-Meteo response")

    tz_name = raw_json.get("timezone", "UTC") or "UTC"
    elevation = raw_json.get("elevation")

    time_str = current.get("time")
    temp = current.get("temperature_2m")
    if not time_str or temp is None:
        raise UpstreamDataError("Missing required current weather variables ('time' or 'temperature_2m')")

    timestamp = _parse_timestamp(time_str, tz_name)
    now = datetime.now(timezone.utc)
    units = _normalize_units(raw_json.get("current_units"))
    if "temperature" not in units:
        units["temperature"] = "celsius"

    return WeatherSnapshot(
        timestamp=timestamp,
        temperature=float(temp),
        apparent_temperature=current.get("apparent_temperature"),
        relative_humidity=current.get("relative_humidity_2m"),
        precipitation=current.get("precipitation"),
        weather_code=current.get("weather_code"),
        cloud_cover=current.get("cloud_cover"),
        surface_pressure=current.get("surface_pressure"),
        wind_speed=current.get("wind_speed_10m"),
        wind_direction=current.get("wind_direction_10m"),
        is_day=current.get("is_day"),
        coordinates=Coordinates(latitude=float(lat), longitude=float(lon), elevation=elevation),
        provider="open-meteo",
        retrieved_at=now,
        timezone=tz_name,
        units=units,
    )


def normalize_forecast(raw_json: dict[str, Any]) -> ForecastData:
    """Parse Open-Meteo forecast payload into ForecastData containing daily and hourly forecasts."""
    if not isinstance(raw_json, dict):
        raise UpstreamDataError("Malformed forecast payload: expected JSON object")

    lat = raw_json.get("latitude")
    lon = raw_json.get("longitude")
    if lat is None or lon is None:
        raise UpstreamDataError("Missing coordinates in Open-Meteo forecast response")

    tz_name = raw_json.get("timezone", "UTC") or "UTC"
    elevation = raw_json.get("elevation")
    now = datetime.now(timezone.utc)
    coords = Coordinates(latitude=float(lat), longitude=float(lon), elevation=elevation)

    daily_units = _normalize_units(raw_json.get("daily_units"))
    hourly_units = _normalize_units(raw_json.get("hourly_units"))
    if "temperature" not in daily_units:
        daily_units["temperature"] = "celsius"
    if "temperature" not in hourly_units:
        hourly_units["temperature"] = "celsius"

    # 1. Parse Daily Summaries
    daily_raw = raw_json.get("daily") or {}
    daily_times = daily_raw.get("time", [])
    daily_points: list[DailyForecast] = []

    if daily_times and isinstance(daily_times, list):
        max_temps = daily_raw.get("temperature_2m_max", [])
        min_temps = daily_raw.get("temperature_2m_min", [])
        app_max = daily_raw.get("apparent_temperature_max", [])
        app_min = daily_raw.get("apparent_temperature_min", [])
        precip_sums = daily_raw.get("precipitation_sum", [])
        precip_probs = daily_raw.get("precipitation_probability_max", [])
        weather_codes = daily_raw.get("weather_code", [])
        wind_speeds = daily_raw.get("wind_speed_10m_max", [])
        wind_dirs = daily_raw.get("wind_direction_10m_dominant", [])
        uv_indices = daily_raw.get("uv_index_max", [])

        for i, date_str in enumerate(daily_times):
            t_max = max_temps[i] if i < len(max_temps) else None
            t_min = min_temps[i] if i < len(min_temps) else None
            if t_max is None or t_min is None:
                continue

            daily_points.append(
                DailyForecast(
                    date=str(date_str),
                    temperature_max=float(t_max),
                    temperature_min=float(t_min),
                    apparent_temperature_max=app_max[i] if i < len(app_max) else None,
                    apparent_temperature_min=app_min[i] if i < len(app_min) else None,
                    precipitation_sum=precip_sums[i] if i < len(precip_sums) else None,
                    precipitation_probability_max=precip_probs[i] if i < len(precip_probs) else None,
                    weather_code=weather_codes[i] if i < len(weather_codes) else None,
                    wind_speed_max=wind_speeds[i] if i < len(wind_speeds) else None,
                    wind_direction_dominant=wind_dirs[i] if i < len(wind_dirs) else None,
                    uv_index_max=uv_indices[i] if i < len(uv_indices) else None,
                    coordinates=coords,
                    provider="open-meteo",
                    retrieved_at=now,
                    timezone=tz_name,
                    units=daily_units,
                )
            )

    # 2. Parse Hourly Points
    hourly_raw = raw_json.get("hourly") or {}
    hourly_times = hourly_raw.get("time", [])
    hourly_points: list[ForecastPoint] = []

    if hourly_times and isinstance(hourly_times, list):
        hourly_temps = hourly_raw.get("temperature_2m", [])
        hourly_app = hourly_raw.get("apparent_temperature", [])
        hourly_precip_prob = hourly_raw.get("precipitation_probability", [])
        hourly_precip = hourly_raw.get("precipitation", [])
        hourly_codes = hourly_raw.get("weather_code", [])
        hourly_winds = hourly_raw.get("wind_speed_10m", [])
        hourly_wind_dirs = hourly_raw.get("wind_direction_10m", [])

        for i, time_str in enumerate(hourly_times):
            temp = hourly_temps[i] if i < len(hourly_temps) else None
            if temp is None:
                continue

            ts = _parse_timestamp(str(time_str), tz_name)
            hourly_points.append(
                ForecastPoint(
                    timestamp=ts,
                    temperature=float(temp),
                    apparent_temperature=hourly_app[i] if i < len(hourly_app) else None,
                    precipitation_probability=hourly_precip_prob[i] if i < len(hourly_precip_prob) else None,
                    precipitation=hourly_precip[i] if i < len(hourly_precip) else None,
                    weather_code=hourly_codes[i] if i < len(hourly_codes) else None,
                    wind_speed=hourly_winds[i] if i < len(hourly_winds) else None,
                    wind_direction=hourly_wind_dirs[i] if i < len(hourly_wind_dirs) else None,
                    coordinates=coords,
                    provider="open-meteo",
                    retrieved_at=now,
                    timezone=tz_name,
                    units=hourly_units,
                )
            )

    if not daily_points and not hourly_points:
        raise UpstreamDataError("Open-Meteo returned neither valid daily nor hourly forecast points")

    return ForecastData(daily=daily_points, hourly=hourly_points)


def normalize_historical_weather(raw_json: dict[str, Any]) -> list[HistoricalRecord]:
    """Parse Open-Meteo historical archive payload into list of HistoricalRecord models."""
    if not isinstance(raw_json, dict):
        raise UpstreamDataError("Malformed historical payload: expected JSON object")

    lat = raw_json.get("latitude")
    lon = raw_json.get("longitude")
    if lat is None or lon is None:
        raise UpstreamDataError("Missing coordinates in Open-Meteo historical response")

    tz_name = raw_json.get("timezone", "UTC") or "UTC"
    elevation = raw_json.get("elevation")
    now = datetime.now(timezone.utc)
    coords = Coordinates(latitude=float(lat), longitude=float(lon), elevation=elevation)
    units = _normalize_units(raw_json.get("hourly_units"))
    if "temperature" not in units:
        units["temperature"] = "celsius"

    hourly = raw_json.get("hourly")
    if not hourly or not isinstance(hourly, dict):
        raise UpstreamDataError("Missing 'hourly' data block in historical weather response")

    times = hourly.get("time", [])
    temps = hourly.get("temperature_2m", [])
    if not times or not temps:
        raise UpstreamDataError("Missing 'time' or 'temperature_2m' arrays in historical response")

    app_temps = hourly.get("apparent_temperature", [])
    precip = hourly.get("precipitation", [])
    humidity = hourly.get("relative_humidity_2m", [])
    wind_speeds = hourly.get("wind_speed_10m", [])
    pressure = hourly.get("surface_pressure", [])
    codes = hourly.get("weather_code", [])

    records: list[HistoricalRecord] = []
    for i, time_str in enumerate(times):
        temp = temps[i] if i < len(temps) else None
        if temp is None:
            continue

        ts = _parse_timestamp(str(time_str), tz_name)
        records.append(
            HistoricalRecord(
                dataset_type="reanalysis",
                timestamp=ts,
                temperature=float(temp),
                apparent_temperature=app_temps[i] if i < len(app_temps) else None,
                precipitation=precip[i] if i < len(precip) else None,
                relative_humidity=humidity[i] if i < len(humidity) else None,
                wind_speed=wind_speeds[i] if i < len(wind_speeds) else None,
                surface_pressure=pressure[i] if i < len(pressure) else None,
                weather_code=codes[i] if i < len(codes) else None,
                coordinates=coords,
                provider="open-meteo",
                retrieved_at=now,
                timezone=tz_name,
                units=units,
            )
        )

    return records


def normalize_air_quality(raw_json: dict[str, Any]) -> AirQuality:
    """Parse Open-Meteo air quality payload into AirQuality model."""
    if not isinstance(raw_json, dict):
        raise UpstreamDataError("Malformed air quality payload: expected JSON object")

    lat = raw_json.get("latitude")
    lon = raw_json.get("longitude")
    if lat is None or lon is None:
        raise UpstreamDataError("Missing coordinates in Open-Meteo air quality response")

    tz_name = raw_json.get("timezone", "UTC") or "UTC"
    elevation = raw_json.get("elevation")
    now = datetime.now(timezone.utc)
    coords = Coordinates(latitude=float(lat), longitude=float(lon), elevation=elevation)

    current = raw_json.get("current")
    if not current or not isinstance(current, dict):
        raise UpstreamDataError("Missing 'current' air quality data block in response")

    time_str = current.get("time")
    if not time_str:
        raise UpstreamDataError("Missing 'time' in air quality response")

    timestamp = _parse_timestamp(str(time_str), tz_name)
    units = _normalize_units(raw_json.get("current_units"))

    # Air quality index: prefer US AQI, fallback to European AQI
    aqi_val = current.get("us_aqi")
    if aqi_val is None:
        aqi_val = current.get("european_aqi")

    return AirQuality(
        timestamp=timestamp,
        aqi=float(aqi_val) if aqi_val is not None else None,
        pm2_5=float(current["pm2_5"]) if current.get("pm2_5") is not None else None,
        pm10=float(current["pm10"]) if current.get("pm10") is not None else None,
        carbon_monoxide=float(current["carbon_monoxide"]) if current.get("carbon_monoxide") is not None else None,
        nitrogen_dioxide=float(current["nitrogen_dioxide"]) if current.get("nitrogen_dioxide") is not None else None,
        sulphur_dioxide=float(current["sulphur_dioxide"]) if current.get("sulphur_dioxide") is not None else None,
        ozone=float(current["ozone"]) if current.get("ozone") is not None else None,
        uv_index=float(current["uv_index"]) if current.get("uv_index") is not None else None,
        coordinates=coords,
        provider="open-meteo",
        retrieved_at=now,
        timezone=tz_name,
        units=units,
    )
