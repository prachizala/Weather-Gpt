"""Location search and geocoding endpoints."""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.app.api.deps import get_weather_provider
from backend.app.schemas.api import APIResponseEnvelope
from backend.app.schemas.chat import SourceRef
from backend.app.schemas.location import Location
from backend.app.services.india_alerts import get_regional_alerts_notice
from backend.app.services.providers import WeatherProvider

router = APIRouter(prefix="/locations", tags=["Locations"])


@router.get("/search", response_model=APIResponseEnvelope[list[Location]])
async def search_locations(
    q: Optional[str] = Query(None, description="Location name or search query (e.g. 'Ahmedabad', 'London')"),
    query: Optional[str] = Query(None, description="Alias for search query"),
    count: int = Query(10, ge=1, le=50, description="Maximum number of search results to return"),
    provider: WeatherProvider = Depends(get_weather_provider),
) -> APIResponseEnvelope[list[Location]]:
    """Search for cities and administrative geographic entities."""
    search_str = (q or query or "").strip()
    if not search_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query ('q' or 'query') cannot be empty or whitespace.",
        )

    locations = await provider.geocode(query=search_str, limit=count)
    now = datetime.now(timezone.utc)

    # Check for regional alert if results include India
    alerts: Optional[str] = None
    for loc in locations:
        alert_notice = get_regional_alerts_notice(
            loc.coordinates.latitude,
            loc.coordinates.longitude,
            loc.country_code,
            loc.country,
        )
        if alert_notice:
            alerts = alert_notice
            break

    source_ref = SourceRef(
        title="Open-Meteo Geocoding API",
        uri="https://geocoding-api.open-meteo.com/v1/search",
        summary="Search results provided by Open-Meteo geocoding database.",
        provider="open-meteo",
        retrieved_at=now,
        timezone="UTC",
        units={},
    )

    return APIResponseEnvelope[list[Location]](
        data=locations,
        source=source_ref,
        retrieved_at=now,
        units={},
        timezone=locations[0].timezone if locations else "UTC",
        alerts=alerts,
    )
