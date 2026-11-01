"""Tests for OpenMeteoClient focusing on retries, timeouts, caching, and error handling."""

from datetime import datetime, timezone
from typing import Any
import httpx
import pytest

from backend.app.schemas.base import Coordinates
from backend.app.schemas.location import Location
from backend.app.services.exceptions import (
    UpstreamDataError,
    UpstreamServiceError,
    UpstreamTimeoutError,
)
from backend.app.services.open_meteo import OpenMeteoClient
from backend.app.utils.cache import InMemoryTTLCache


@pytest.fixture
def test_location() -> Location:
    now = datetime.now(timezone.utc)
    return Location(
        name="Ahmedabad",
        country="India",
        country_code="IN",
        coordinates=Coordinates(latitude=23.0225, longitude=72.5714, elevation=53.0),
        provider="open-meteo",
        retrieved_at=now,
        timezone="Asia/Kolkata",
        units={},
    )


class MockTransport(httpx.AsyncBaseTransport):
    """Configurable mock transport for testing retries, status codes, and timeouts."""

    def __init__(
        self,
        handler,
    ) -> None:
        self.handler = handler
        self.call_count = 0

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        self.call_count += 1
        return await self.handler(request, self.call_count)


# ---------------------------------------------------------------------------
# Test: Timeout with Max 2 Retries (3 Total Attempts)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_client_timeout_retries_and_raises(test_location):
    """Verify that timeout triggers up to 2 retries (3 total attempts) before raising UpstreamTimeoutError."""
    call_attempts = 0

    async def timeout_handler(request: httpx.Request, attempt: int) -> httpx.Response:
        nonlocal call_attempts
        call_attempts = attempt
        raise httpx.ReadTimeout("Socket read timed out", request=request)

    transport = MockTransport(timeout_handler)
    async with httpx.AsyncClient(transport=transport) as mock_http:
        client = OpenMeteoClient(
            cache=InMemoryTTLCache(),
            client=mock_http,
            timeout=1.0,
            max_retries=2,
            base_backoff=0.01,  # Fast backoff for tests
        )

        with pytest.raises(UpstreamTimeoutError):
            await client.get_current_weather(test_location)

    # Initial attempt + 2 retries = 3 attempts
    assert call_attempts == 3


# ---------------------------------------------------------------------------
# Test: 500 Server Error Retries
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_client_500_server_error_retries_and_raises(test_location):
    """Verify 5xx errors trigger retries and raise UpstreamServiceError."""
    call_attempts = 0

    async def server_error_handler(request: httpx.Request, attempt: int) -> httpx.Response:
        nonlocal call_attempts
        call_attempts = attempt
        return httpx.Response(500, text="Internal Server Error", request=request)

    transport = MockTransport(server_error_handler)
    async with httpx.AsyncClient(transport=transport) as mock_http:
        client = OpenMeteoClient(
            cache=InMemoryTTLCache(),
            client=mock_http,
            timeout=1.0,
            max_retries=2,
            base_backoff=0.01,
        )

        with pytest.raises(UpstreamServiceError):
            await client.get_current_weather(test_location)

    assert call_attempts == 3


# ---------------------------------------------------------------------------
# Test: 400 Bad Request Does NOT Retry
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_client_400_bad_request_no_retry(test_location):
    """Verify 4xx client errors fail immediately without retry."""
    call_attempts = 0

    async def bad_request_handler(request: httpx.Request, attempt: int) -> httpx.Response:
        nonlocal call_attempts
        call_attempts = attempt
        return httpx.Response(400, json={"error": True, "reason": "Invalid parameter"}, request=request)

    transport = MockTransport(bad_request_handler)
    async with httpx.AsyncClient(transport=transport) as mock_http:
        client = OpenMeteoClient(
            cache=InMemoryTTLCache(),
            client=mock_http,
            max_retries=2,
            base_backoff=0.01,
        )

        with pytest.raises(UpstreamServiceError):
            await client.get_current_weather(test_location)

    # Failed on the very first attempt without retrying
    assert call_attempts == 1


# ---------------------------------------------------------------------------
# Test: Malformed JSON Handling
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_client_malformed_json_raises_upstream_data_error(test_location):
    """Non-JSON response text raises UpstreamDataError."""
    async def malformed_handler(request: httpx.Request, attempt: int) -> httpx.Response:
        return httpx.Response(200, text="<html><body>Gateway Error</body></html>", request=request)

    transport = MockTransport(malformed_handler)
    async with httpx.AsyncClient(transport=transport) as mock_http:
        client = OpenMeteoClient(
            cache=InMemoryTTLCache(),
            client=mock_http,
            max_retries=0,
        )

        with pytest.raises(UpstreamDataError):
            await client.get_current_weather(test_location)


# ---------------------------------------------------------------------------
# Test: TTL Caching Prevents Redundant HTTP Calls
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_client_caching_behavior(test_location):
    """Verify repeated calls for same location and units return cached response without extra HTTP calls."""
    mock_payload = {
        "latitude": 23.0225,
        "longitude": 72.5714,
        "timezone": "Asia/Kolkata",
        "current_units": {"temperature_2m": "°C"},
        "current": {
            "time": "2026-10-18T10:00",
            "temperature_2m": 31.0,
            "wind_speed_10m": 5.0,
        },
    }

    call_count = 0

    async def success_handler(request: httpx.Request, attempt: int) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        return httpx.Response(200, json=mock_payload, request=request)

    transport = MockTransport(success_handler)
    cache = InMemoryTTLCache()

    async with httpx.AsyncClient(transport=transport) as mock_http:
        client = OpenMeteoClient(cache=cache, client=mock_http)

        # 1st call -> Cache miss, executes HTTP request
        res1 = await client.get_current_weather(test_location, units="celsius")
        assert res1.temperature == 31.0
        assert call_count == 1

        # 2nd call -> Cache hit, does NOT execute HTTP request
        res2 = await client.get_current_weather(test_location, units="celsius")
        assert res2.temperature == 31.0
        assert call_count == 1  # Still 1!


# ---------------------------------------------------------------------------
# Test: Units Parameter Mapping (Celsius vs Fahrenheit)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_client_units_param_mapping(test_location):
    """Verify units parameter sets temperature_unit and wind_speed_unit in Open-Meteo query."""
    captured_params = {}

    async def inspect_handler(request: httpx.Request, attempt: int) -> httpx.Response:
        nonlocal captured_params
        captured_params = dict(request.url.params)
        return httpx.Response(
            200,
            json={
                "latitude": 23.0225,
                "longitude": 72.5714,
                "timezone": "Asia/Kolkata",
                "current_units": {"temperature_2m": "°F"},
                "current": {"time": "2026-10-18T10:00", "temperature_2m": 88.0},
            },
            request=request,
        )

    transport = MockTransport(inspect_handler)
    async with httpx.AsyncClient(transport=transport) as mock_http:
        client = OpenMeteoClient(cache=InMemoryTTLCache(), client=mock_http)
        await client.get_current_weather(test_location, units="fahrenheit")

    assert captured_params.get("temperature_unit") == "fahrenheit"
    assert captured_params.get("wind_speed_unit") == "mph"
    assert captured_params.get("precipitation_unit") == "inch"
