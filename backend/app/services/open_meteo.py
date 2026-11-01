"""Open-Meteo API client implementation with async httpx, retry backoff, and TTL caching."""

from __future__ import annotations
import asyncio
import logging
from datetime import date, datetime
from typing import Any, Optional, Union
import httpx

from backend.app.config import settings
from backend.app.schemas.base import Coordinates
from backend.app.schemas.location import Location
from backend.app.schemas.weather import (
    AirQuality,
    ForecastData,
    HistoricalRecord,
    WeatherSnapshot,
)
from backend.app.services.exceptions import (
    LocationNotFoundError,
    UpstreamDataError,
    UpstreamServiceError,
    UpstreamTimeoutError,
)
from backend.app.services.normalizers import (
    normalize_air_quality,
    normalize_current_weather,
    normalize_forecast,
    normalize_historical_weather,
    normalize_locations,
)
from backend.app.services.providers import WeatherProvider
from backend.app.utils.cache import Cache, InMemoryTTLCache

logger = logging.getLogger(__name__)


class OpenMeteoClient(WeatherProvider):
    """Production-grade asynchronous Open-Meteo weather provider adapter."""

    def __init__(
        self,
        cache: Optional[Cache] = None,
        client: Optional[httpx.AsyncClient] = None,
        timeout: float = 10.0,
        max_retries: int = 2,
        base_backoff: float = 0.5,
    ) -> None:
        self.cache: Cache = cache if cache is not None else InMemoryTTLCache()
        self._external_client = client
        self.timeout = timeout
        self.max_retries = max_retries
        self.base_backoff = base_backoff

    async def _get_client(self) -> httpx.AsyncClient:
        if self._external_client is not None:
            return self._external_client
        return httpx.AsyncClient(timeout=self.timeout)

    def _map_units(self, units: str) -> dict[str, str]:
        """Convert requested units string into Open-Meteo query parameter mapping."""
        u = units.lower().strip()
        if u in ("imperial", "fahrenheit", "f", "°f"):
            return {
                "temperature_unit": "fahrenheit",
                "wind_speed_unit": "mph",
                "precipitation_unit": "inch",
            }
        return {
            "temperature_unit": "celsius",
            "wind_speed_unit": "kmh",
            "precipitation_unit": "mm",
        }

    async def _request_with_retry(
        self,
        url: str,
        params: dict[str, Any],
    ) -> dict[str, Any]:
        """Execute HTTP GET with timeout, exponential backoff, and robust error handling."""
        # Inject API key for commercial plan if enabled
        if settings.open_meteo_commercial and settings.open_meteo_api_key:
            params = {**params, "apikey": settings.open_meteo_api_key}

        client = await self._get_client()
        should_close = self._external_client is None

        attempt = 0
        last_exception: Optional[Exception] = None

        try:
            while attempt <= self.max_retries:
                try:
                    logger.debug("Open-Meteo request [%s] attempt %d: params=%s", url, attempt + 1, params)
                    response = await client.get(url, params=params)

                    # Upstream 4xx errors (client faults) - don't retry
                    if 400 <= response.status_code < 500:
                        try:
                            err_payload = response.json()
                            reason = err_payload.get("reason", response.text)
                        except Exception:
                            reason = response.text
                        raise UpstreamServiceError(
                            f"Open-Meteo returned HTTP {response.status_code}: {reason}",
                            code="UPSTREAM_BAD_REQUEST",
                            status_code=response.status_code,
                        )

                    # Upstream 5xx errors (server faults) - retryable
                    if response.status_code >= 500:
                        raise UpstreamServiceError(
                            f"Open-Meteo returned HTTP {response.status_code}: {response.text}",
                            code="UPSTREAM_SERVER_ERROR",
                            status_code=502,
                        )

                    try:
                        data = response.json()
                    except Exception as e:
                        raise UpstreamDataError(f"Malformed JSON returned by Open-Meteo: {e}") from e

                    # Check for Open-Meteo embedded error flag
                    if isinstance(data, dict) and data.get("error"):
                        reason = data.get("reason", "Unknown upstream error")
                        raise UpstreamServiceError(f"Open-Meteo error: {reason}", code="UPSTREAM_ERROR", status_code=502)

                    return data

                except (httpx.TimeoutException, UpstreamTimeoutError) as e:
                    last_exception = UpstreamTimeoutError(f"Open-Meteo timeout after {self.timeout}s: {e}")
                    logger.warning("Timeout connecting to Open-Meteo (attempt %d/%d): %s", attempt + 1, self.max_retries + 1, e)

                except UpstreamServiceError as e:
                    if e.status_code < 500:
                        raise  # Client-side 4xx errors should fail immediately without retry
                    last_exception = e
                    logger.warning("Upstream 5xx error connecting to Open-Meteo (attempt %d/%d): %s", attempt + 1, self.max_retries + 1, e)

                except httpx.NetworkError as e:
                    last_exception = UpstreamServiceError(f"Network error connecting to Open-Meteo: {e}")
                    logger.warning("Network error connecting to Open-Meteo (attempt %d/%d): %s", attempt + 1, self.max_retries + 1, e)

                attempt += 1
                if attempt <= self.max_retries:
                    backoff = self.base_backoff * (2 ** (attempt - 1))
                    await asyncio.sleep(backoff)

            # Max retries exhausted
            if isinstance(last_exception, UpstreamTimeoutError):
                raise last_exception
            raise UpstreamServiceError(f"Open-Meteo request failed after {self.max_retries + 1} attempts: {last_exception}")

        finally:
            if should_close:
                await client.aclose()

    # ------------------------------------------------------------------------
    # 1. Geocoding
    # ------------------------------------------------------------------------
    async def geocode(self, query: str, limit: int = 10) -> list[Location]:
        """Search for locations by name, cached for 24 hours."""
        clean_query = query.strip()
        if not clean_query:
            return []

        cache_key = f"geo:{clean_query.lower()}:{limit}"
        cached = await self.cache.get(cache_key)
        if cached is not None:
            return cached

        url = f"{settings.open_meteo_geocoding_url.rstrip('/')}/v1/search"
        params = {"name": clean_query, "count": limit, "language": "en", "format": "json"}

        raw_data = await self._request_with_retry(url, params)
        locations = normalize_locations(raw_data)

        # Cache geocoding results for 24 hours
        await self.cache.set(cache_key, locations, ttl_seconds=86400)
        return locations

    # ------------------------------------------------------------------------
    # 2. Current Weather
    # ------------------------------------------------------------------------
    async def get_current_weather(
        self, location: Location, units: str = "celsius"
    ) -> WeatherSnapshot:
        """Fetch current weather for location, cached for 10 minutes."""
        lat = location.coordinates.latitude
        lon = location.coordinates.longitude
        unit_params = self._map_units(units)

        cache_key = f"current:{lat:.4f}:{lon:.4f}:{unit_params['temperature_unit']}"
        cached = await self.cache.get(cache_key)
        if cached is not None:
            return cached

        url = f"{settings.open_meteo_base_url.rstrip('/')}/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,is_day",
            "timezone": "auto",
            **unit_params,
        }

        raw_data = await self._request_with_retry(url, params)
        snapshot = normalize_current_weather(raw_data)

        # Cache current weather for 10 minutes
        await self.cache.set(cache_key, snapshot, ttl_seconds=600)
        return snapshot

    # ------------------------------------------------------------------------
    # 3. Forecast (Daily + Hourly)
    # ------------------------------------------------------------------------
    async def get_forecast(
        self, location: Location, days: int = 7, units: str = "celsius"
    ) -> ForecastData:
        """Fetch daily + hourly forecast for location, cached for 15 minutes."""
        lat = location.coordinates.latitude
        lon = location.coordinates.longitude
        clamped_days = max(1, min(days, 16))
        unit_params = self._map_units(units)

        cache_key = f"forecast:{lat:.4f}:{lon:.4f}:{clamped_days}:{unit_params['temperature_unit']}"
        cached = await self.cache.get(cache_key)
        if cached is not None:
            return cached

        url = f"{settings.open_meteo_base_url.rstrip('/')}/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "daily": "temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,weather_code,wind_speed_10m_max,wind_direction_10m_dominant,uv_index_max",
            "hourly": "temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m",
            "forecast_days": clamped_days,
            "timezone": "auto",
            **unit_params,
        }

        raw_data = await self._request_with_retry(url, params)
        forecast = normalize_forecast(raw_data)

        # Cache forecast for 15 minutes (requirement: 10-15 min)
        await self.cache.set(cache_key, forecast, ttl_seconds=900)
        return forecast

    # ------------------------------------------------------------------------
    # 4. Historical Weather Archive
    # ------------------------------------------------------------------------
    async def get_historical_weather(
        self,
        location: Location,
        start_date: Union[str, date, datetime],
        end_date: Union[str, date, datetime],
        units: str = "celsius",
    ) -> list[HistoricalRecord]:
        """Fetch historical archive records for location, cached for 24 hours."""
        lat = location.coordinates.latitude
        lon = location.coordinates.longitude
        s_date = start_date.strftime("%Y-%m-%d") if hasattr(start_date, "strftime") else str(start_date)
        e_date = end_date.strftime("%Y-%m-%d") if hasattr(end_date, "strftime") else str(end_date)
        unit_params = self._map_units(units)

        cache_key = f"hist:{lat:.4f}:{lon:.4f}:{s_date}:{e_date}:{unit_params['temperature_unit']}"
        cached = await self.cache.get(cache_key)
        if cached is not None:
            return cached

        url = f"{settings.open_meteo_archive_url.rstrip('/')}/v1/archive"
        params = {
            "latitude": lat,
            "longitude": lon,
            "start_date": s_date,
            "end_date": e_date,
            "hourly": "temperature_2m,apparent_temperature,precipitation,relative_humidity_2m,wind_speed_10m,surface_pressure,weather_code",
            "timezone": "auto",
            **unit_params,
        }

        raw_data = await self._request_with_retry(url, params)
        records = normalize_historical_weather(raw_data)

        # Cache historical data for 24 hours
        await self.cache.set(cache_key, records, ttl_seconds=86400)
        return records

    # ------------------------------------------------------------------------
    # 5. Air Quality
    # ------------------------------------------------------------------------
    async def get_air_quality(self, location: Location) -> AirQuality:
        """Fetch current air quality metrics for location, cached for 15 minutes."""
        lat = location.coordinates.latitude
        lon = location.coordinates.longitude

        cache_key = f"aqi:{lat:.4f}:{lon:.4f}"
        cached = await self.cache.get(cache_key)
        if cached is not None:
            return cached

        url = f"{settings.open_meteo_air_quality_url.rstrip('/')}/v1/air-quality"
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": "pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,uv_index,european_aqi,us_aqi",
            "timezone": "auto",
        }

        raw_data = await self._request_with_retry(url, params)
        aqi_record = normalize_air_quality(raw_data)

        # Cache air quality for 15 minutes
        await self.cache.set(cache_key, aqi_record, ttl_seconds=900)
        return aqi_record
