"""Weather, forecast, and historical weather archive endpoints."""

from datetime import date, datetime, timezone
from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.app.api.deps import get_weather_provider
from backend.app.schemas.api import APIResponseEnvelope
from backend.app.schemas.base import Coordinates
from backend.app.schemas.chat import SourceRef
from backend.app.schemas.comparison import HistoricalComparisonResult
from backend.app.schemas.location import Location
from backend.app.schemas.weather import (
    ForecastData,
    HistoricalRecord,
    WeatherSnapshot,
)
from backend.app.services.historical_comparison import (
    PeriodMisalignmentError,
    execute_historical_comparison,
    parse_date_input,
)
from backend.app.services.india_alerts import get_regional_alerts_notice
from backend.app.services.providers import WeatherProvider

router = APIRouter(prefix="/weather", tags=["Weather"])

UnitsType = Literal["celsius", "fahrenheit", "metric", "imperial"]


def _make_dummy_location(lat: float, lon: float) -> Location:
    """Instantiate a temporary Location wrapper to query coordinate-based endpoints."""
    now = datetime.now(timezone.utc)
    return Location(
        name=f"Lat {lat:.4f}, Lon {lon:.4f}",
        coordinates=Coordinates(latitude=lat, longitude=lon),
        provider="system",
        retrieved_at=now,
        timezone="UTC",
        units={},
    )


# ---------------------------------------------------------------------------
# 1. Current Weather Endpoint
# ---------------------------------------------------------------------------
@router.get("/current", response_model=APIResponseEnvelope[WeatherSnapshot])
async def get_current_weather(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees (-90 to 90)"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees (-180 to 180)"),
    units: UnitsType = Query("celsius", description="Temperature and metric unit system: celsius | fahrenheit"),
    provider: WeatherProvider = Depends(get_weather_provider),
) -> APIResponseEnvelope[WeatherSnapshot]:
    """Retrieve current weather observation for specified coordinates."""
    loc = _make_dummy_location(latitude, longitude)
    snapshot = await provider.get_current_weather(location=loc, units=units)

    now = datetime.now(timezone.utc)
    alerts = get_regional_alerts_notice(latitude, longitude)
    source_ref = SourceRef(
        title="Open-Meteo Weather Forecast API",
        uri="https://api.open-meteo.com/v1/forecast",
        summary="Real-time atmospheric conditions and surface observations.",
        provider="open-meteo",
        retrieved_at=snapshot.retrieved_at,
        coordinates=snapshot.coordinates,
        timezone=snapshot.timezone,
        units=snapshot.units,
    )

    return APIResponseEnvelope[WeatherSnapshot](
        data=snapshot,
        source=source_ref,
        retrieved_at=now,
        units=snapshot.units,
        timezone=snapshot.timezone,
        alerts=alerts,
    )


# ---------------------------------------------------------------------------
# 2. Forecast Endpoint (Daily + Hourly)
# ---------------------------------------------------------------------------
@router.get("/forecast", response_model=APIResponseEnvelope[ForecastData])
async def get_forecast(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees (-90 to 90)"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees (-180 to 180)"),
    days: int = Query(7, ge=1, le=16, description="Number of forecast days (1 to 16)"),
    units: UnitsType = Query("celsius", description="Temperature and metric unit system: celsius | fahrenheit"),
    provider: WeatherProvider = Depends(get_weather_provider),
) -> APIResponseEnvelope[ForecastData]:
    """Retrieve daily summaries and granular hourly forecast points."""
    loc = _make_dummy_location(latitude, longitude)
    forecast = await provider.get_forecast(location=loc, days=days, units=units)

    now = datetime.now(timezone.utc)
    alerts = get_regional_alerts_notice(latitude, longitude)
    tz_resolved = forecast.daily[0].timezone if forecast.daily else (forecast.hourly[0].timezone if forecast.hourly else "UTC")
    units_resolved = forecast.daily[0].units if forecast.daily else (forecast.hourly[0].units if forecast.hourly else {})

    source_ref = SourceRef(
        title="Open-Meteo 7-16 Day Weather Forecast API",
        uri="https://api.open-meteo.com/v1/forecast",
        summary="Numerical weather prediction model outputs (GFS, ECMWF, ICON).",
        provider="open-meteo",
        retrieved_at=now,
        coordinates=Coordinates(latitude=latitude, longitude=longitude),
        timezone=tz_resolved,
        units=units_resolved,
    )

    return APIResponseEnvelope[ForecastData](
        data=forecast,
        source=source_ref,
        retrieved_at=now,
        units=units_resolved,
        timezone=tz_resolved,
        alerts=alerts,
    )


# ---------------------------------------------------------------------------
# 3. Historical Weather Archive Endpoint
# ---------------------------------------------------------------------------
@router.get("/history", response_model=APIResponseEnvelope[list[HistoricalRecord]])
async def get_historical_weather(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees (-90 to 90)"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees (-180 to 180)"),
    start: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
    end: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
    start_date: Optional[str] = Query(None, description="Alias for start date"),
    end_date: Optional[str] = Query(None, description="Alias for end date"),
    units: UnitsType = Query("celsius", description="Temperature and metric unit system: celsius | fahrenheit"),
    provider: WeatherProvider = Depends(get_weather_provider),
) -> APIResponseEnvelope[list[HistoricalRecord]]:
    """Retrieve historical meteorological records from global reanalysis datasets (ERA5)."""
    s_date_str = start or start_date
    e_date_str = end or end_date

    if not s_date_str or not e_date_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both 'start' (or 'start_date') and 'end' (or 'end_date') are required parameters.",
        )

    try:
        s_date = date.fromisoformat(s_date_str)
        e_date = date.fromisoformat(e_date_str)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date format for historical query (expected YYYY-MM-DD): {e}",
        ) from e

    if s_date > e_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"start date ({s_date}) cannot be after end date ({e_date}).",
        )

    loc = _make_dummy_location(latitude, longitude)
    records = await provider.get_historical_weather(
        location=loc, start_date=s_date, end_date=e_date, units=units
    )

    now = datetime.now(timezone.utc)
    alerts = get_regional_alerts_notice(latitude, longitude)
    tz_resolved = records[0].timezone if records else "UTC"
    units_resolved = records[0].units if records else {}

    source_ref = SourceRef(
        title="Open-Meteo Historical Weather Archive API",
        uri="https://archive-api.open-meteo.com/v1/archive",
        summary="Seamless global meteorological reanalysis from 1940 to near real-time.",
        provider="open-meteo",
        retrieved_at=now,
        coordinates=Coordinates(latitude=latitude, longitude=longitude),
        timezone=tz_resolved,
        units=units_resolved,
    )

    return APIResponseEnvelope[list[HistoricalRecord]](
        data=records,
        source=source_ref,
        retrieved_at=now,
        units=units_resolved,
        timezone=tz_resolved,
        alerts=alerts,
    )


# ---------------------------------------------------------------------------
# 4. Historical Period Comparison Endpoint
# ---------------------------------------------------------------------------
@router.get("/compare", response_model=APIResponseEnvelope[HistoricalComparisonResult])
async def get_weather_comparison(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees (-90 to 90)"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees (-180 to 180)"),
    start_date: str = Query(..., description="Start date of equivalent period (YYYY-MM-DD or MM-DD)"),
    end_date: str = Query(..., description="End date of equivalent period (YYYY-MM-DD or MM-DD)"),
    years_back: int = Query(5, ge=1, le=20, description="Number of previous years to compare against"),
    variable: str = Query("precipitation_sum", description="Primary comparison variable: precipitation_sum | temperature"),
    units: UnitsType = Query("celsius", description="Temperature and metric unit system: celsius | fahrenheit"),
    city_name: Optional[str] = Query(None, description="Optional city name for display"),
    provider: WeatherProvider = Depends(get_weather_provider),
) -> APIResponseEnvelope[HistoricalComparisonResult]:
    """Compare weather variable across equivalent calendar periods for multiple years.
    
    Computes deterministic daily and multi-year totals, baseline averages, anomalies,
    data coverage percentages, and transparent limitations in pure Python.
    """
    try:
        s_date = parse_date_input(start_date)
        e_date = parse_date_input(end_date)
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date format: {ve}",
        )

    if s_date > e_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Start date ({s_date}) cannot be after end date ({e_date}).",
        )

    name = city_name or f"Lat {latitude:.4f}, Lon {longitude:.4f}"
    loc = Location(
        name=name,
        coordinates=Coordinates(latitude=latitude, longitude=longitude),
        provider="system",
        retrieved_at=datetime.now(timezone.utc),
        timezone="UTC",
        units={},
    )

    try:
        comparison = await execute_historical_comparison(
            weather_provider=provider,
            location=loc,
            start_date=s_date,
            end_date=e_date,
            years_back=years_back,
            variable=variable,
            units=units,
        )
    except PeriodMisalignmentError as pme:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(pme),
        )

    now = datetime.now(timezone.utc)
    alerts = get_regional_alerts_notice(latitude, longitude)
    source_ref = SourceRef(
        title="Open-Meteo Historical Archive API",
        uri="https://archive-api.open-meteo.com/v1/archive",
        summary=f"Multi-year equivalent period comparison ({comparison.years_compared} years).",
        provider="open-meteo",
        retrieved_at=now,
        coordinates=Coordinates(latitude=latitude, longitude=longitude),
        timezone=loc.timezone,
        units=comparison.units,
    )

    return APIResponseEnvelope[HistoricalComparisonResult](
        data=comparison,
        source=source_ref,
        retrieved_at=now,
        units=comparison.units,
        timezone=loc.timezone,
        alerts=alerts,
    )

