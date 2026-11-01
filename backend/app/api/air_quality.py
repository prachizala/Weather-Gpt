"""Air quality and atmospheric pollution endpoints."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query

from backend.app.api.deps import get_weather_provider
from backend.app.schemas.api import APIResponseEnvelope
from backend.app.schemas.base import Coordinates
from backend.app.schemas.chat import SourceRef
from backend.app.schemas.location import Location
from backend.app.schemas.weather import AirQuality
from backend.app.services.india_alerts import get_regional_alerts_notice
from backend.app.services.providers import WeatherProvider

router = APIRouter(tags=["Air Quality"])


def _make_dummy_location(lat: float, lon: float) -> Location:
    now = datetime.now(timezone.utc)
    return Location(
        name=f"Lat {lat:.4f}, Lon {lon:.4f}",
        coordinates=Coordinates(latitude=lat, longitude=lon),
        provider="system",
        retrieved_at=now,
        timezone="UTC",
        units={},
    )


@router.get("/air-quality", response_model=APIResponseEnvelope[AirQuality])
async def get_air_quality(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees (-90 to 90)"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees (-180 to 180)"),
    provider: WeatherProvider = Depends(get_weather_provider),
) -> APIResponseEnvelope[AirQuality]:
    """Retrieve atmospheric air quality indices and particulate concentrations (PM2.5, PM10, AQI)."""
    loc = _make_dummy_location(latitude, longitude)
    air_quality = await provider.get_air_quality(location=loc)

    now = datetime.now(timezone.utc)
    alerts = get_regional_alerts_notice(latitude, longitude)

    source_ref = SourceRef(
        title="Open-Meteo Air Quality API",
        uri="https://air-quality-api.open-meteo.com/v1/air-quality",
        summary="CAMS European and NOAA atmospheric composition forecasts.",
        provider="open-meteo",
        retrieved_at=air_quality.retrieved_at,
        coordinates=air_quality.coordinates,
        timezone=air_quality.timezone,
        units=air_quality.units,
    )

    return APIResponseEnvelope[AirQuality](
        data=air_quality,
        source=source_ref,
        retrieved_at=now,
        units=air_quality.units,
        timezone=air_quality.timezone,
        alerts=alerts,
    )
