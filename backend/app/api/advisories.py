"""Rule-based meteorological and environmental advisories endpoint."""

from __future__ import annotations
from datetime import datetime, timezone
from typing import Literal, Optional
from fastapi import APIRouter, Depends, Query

from backend.app.api.deps import get_weather_provider
from backend.app.schemas.advisories import AdvisoriesReport
from backend.app.schemas.api import APIResponseEnvelope
from backend.app.schemas.base import Coordinates
from backend.app.schemas.chat import SourceRef
from backend.app.schemas.location import Location
from backend.app.services.advisories import advisory_engine
from backend.app.services.india_alerts import get_regional_alerts_notice
from backend.app.services.providers import WeatherProvider

router = APIRouter(prefix="/advisories", tags=["Advisories"])

UnitsType = Literal["celsius", "fahrenheit", "metric", "imperial"]


@router.get("", response_model=APIResponseEnvelope[AdvisoriesReport])
@router.get("/", response_model=APIResponseEnvelope[AdvisoriesReport], include_in_schema=False)
async def get_advisories(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees (-90 to 90)"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees (-180 to 180)"),
    units: UnitsType = Query("celsius", description="Temperature unit system: celsius | fahrenheit"),
    city_name: Optional[str] = Query(None, description="Optional human-readable city name"),
    provider: WeatherProvider = Depends(get_weather_provider),
) -> APIResponseEnvelope[AdvisoriesReport]:
    """Evaluate rule-based weather and air quality advisories for specified coordinates.
    
    All advisories are deterministic suggestions based on configurable thresholds.
    Clearly labelled with: 'App suggestion, not an official warning'.
    Missing variables are explicitly skipped with a note; never guessed.
    """
    now = datetime.now(timezone.utc)
    name = city_name or f"Lat {latitude:.4f}, Lon {longitude:.4f}"
    loc = Location(
        name=name,
        coordinates=Coordinates(latitude=latitude, longitude=longitude),
        provider="system",
        retrieved_at=now,
        timezone="UTC",
        units={},
    )

    # 1. Fetch current weather snapshot
    try:
        current = await provider.get_current_weather(location=loc, units=units)
        tz_name = current.timezone
    except Exception:
        current = None
        tz_name = "UTC"

    # 2. Fetch forecast data
    try:
        forecast = await provider.get_forecast(location=loc, days=1, units=units)
    except Exception:
        forecast = None

    # 3. Fetch air quality data
    try:
        air_quality = await provider.get_air_quality(location=loc)
    except Exception:
        air_quality = None

    # 4. Evaluate rules deterministically
    report = advisory_engine.evaluate(
        current=current,
        forecast=forecast,
        air_quality=air_quality,
        location=loc,
    )

    alerts = get_regional_alerts_notice(latitude, longitude)
    source_ref = SourceRef(
        title="WeatherGPT Advisory Engine",
        uri="https://api.open-meteo.com",
        summary="Deterministic rule evaluation over live Open-Meteo observations and air quality metrics.",
        provider="system",
        retrieved_at=now,
        coordinates=Coordinates(latitude=latitude, longitude=longitude),
        timezone=tz_name,
        units={"rules": "yaml"},
    )

    return APIResponseEnvelope[AdvisoriesReport](
        data=report,
        source=source_ref,
        retrieved_at=now,
        units={},
        timezone=tz_name,
        alerts=alerts,
    )
