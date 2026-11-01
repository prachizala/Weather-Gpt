"""Unit tests for REST API endpoints with mocked weather provider."""

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from backend.app.api.deps import get_weather_provider
from backend.app.main import app
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
from backend.app.services.exceptions import (
    UpstreamDataError,
    UpstreamServiceError,
    UpstreamTimeoutError,
)
from backend.app.services.providers import WeatherProvider


class MockWeatherProvider(WeatherProvider):
    """Mock provider returning structured data without network activity."""

    def __init__(self, should_fail: str | None = None) -> None:
        self.should_fail = should_fail
        self.now = datetime.now(timezone.utc)
        self.ahmedabad_coords = Coordinates(latitude=23.0225, longitude=72.5714, elevation=53.0)

    async def geocode(self, query: str, limit: int = 10) -> list[Location]:
        if self.should_fail == "timeout":
            raise UpstreamTimeoutError("Geocoding timed out")
        if self.should_fail == "500":
            raise UpstreamServiceError("Geocoding upstream failed")
        if self.should_fail == "malformed":
            raise UpstreamDataError("Malformed geocoding data")

        if "ahmedabad" in query.lower():
            return [
                Location(
                    name="Ahmedabad",
                    country="India",
                    country_code="IN",
                    admin1="Gujarat",
                    coordinates=self.ahmedabad_coords,
                    provider="open-meteo",
                    retrieved_at=self.now,
                    timezone="Asia/Kolkata",
                    units={},
                )
            ]
        return []

    async def get_current_weather(
        self, location: Location, units: str = "celsius"
    ) -> WeatherSnapshot:
        if self.should_fail == "timeout":
            raise UpstreamTimeoutError("Weather provider timed out")
        if self.should_fail == "500":
            raise UpstreamServiceError("Upstream server error")
        if self.should_fail == "malformed":
            raise UpstreamDataError("Corrupted weather payload")

        temp = 86.0 if "fahrenheit" in units else 30.0
        return WeatherSnapshot(
            timestamp=self.now,
            temperature=temp,
            apparent_temperature=temp + 2.0,
            relative_humidity=45.0,
            precipitation=0.0,
            weather_code=1,
            cloud_cover=20.0,
            surface_pressure=1012.0,
            wind_speed=8.0,
            wind_direction=140.0,
            is_day=1,
            coordinates=location.coordinates,
            provider="open-meteo",
            retrieved_at=self.now,
            timezone="Asia/Kolkata",
            units={"temperature": units, "wind_speed": "km/h"},
        )

    async def get_forecast(
        self, location: Location, days: int = 7, units: str = "celsius"
    ) -> ForecastData:
        if self.should_fail == "timeout":
            raise UpstreamTimeoutError("Forecast timed out")

        daily_list = [
            DailyForecast(
                date=f"2026-10-{18 + i:02d}",
                temperature_max=35.0,
                temperature_min=24.0,
                precipitation_sum=0.0,
                precipitation_probability_max=10.0,
                weather_code=1,
                wind_speed_max=12.0,
                uv_index_max=8.0,
                coordinates=location.coordinates,
                provider="open-meteo",
                retrieved_at=self.now,
                timezone="Asia/Kolkata",
                units={"temperature": units},
            )
            for i in range(days)
        ]
        hourly_list = [
            ForecastPoint(
                timestamp=self.now,
                temperature=30.0,
                apparent_temperature=32.0,
                precipitation_probability=0.0,
                precipitation=0.0,
                weather_code=1,
                wind_speed=7.0,
                coordinates=location.coordinates,
                provider="open-meteo",
                retrieved_at=self.now,
                timezone="Asia/Kolkata",
                units={"temperature": units},
            )
        ]
        return ForecastData(daily=daily_list, hourly=hourly_list)

    async def get_historical_weather(
        self, location: Location, start_date, end_date, units: str = "celsius"
    ) -> list[HistoricalRecord]:
        if self.should_fail == "timeout":
            raise UpstreamTimeoutError("Historical query timed out")

        return [
            HistoricalRecord(
                dataset_type="reanalysis",
                timestamp=self.now,
                temperature=28.0,
                coordinates=location.coordinates,
                provider="open-meteo",
                retrieved_at=self.now,
                timezone="Asia/Kolkata",
                units={"temperature": units},
            )
        ]

    async def get_air_quality(self, location: Location) -> AirQuality:
        if self.should_fail == "timeout":
            raise UpstreamTimeoutError("Air quality timed out")

        return AirQuality(
            timestamp=self.now,
            aqi=65.0,
            pm2_5=18.4,
            pm10=38.2,
            coordinates=location.coordinates,
            provider="open-meteo",
            retrieved_at=self.now,
            timezone="Asia/Kolkata",
            units={"pm2_5": "μg/m³", "pm10": "μg/m³"},
        )


@pytest.fixture
def client_with_mock_provider():
    mock_prov = MockWeatherProvider()
    app.dependency_overrides[get_weather_provider] = lambda: mock_prov
    yield TestClient(app)
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Test: Locations Search
# ---------------------------------------------------------------------------

def test_search_locations_success(client_with_mock_provider):
    """Verify GET /api/locations/search returns enveloped locations and India alert."""
    response = client_with_mock_provider.get("/api/locations/search?q=Ahmedabad")
    assert response.status_code == 200

    body = response.json()
    assert "data" in body
    assert "source" in body
    assert "retrieved_at" in body
    assert "units" in body
    assert "timezone" in body
    assert len(body["data"]) == 1
    assert body["data"][0]["name"] == "Ahmedabad"
    # Static India warning check
    assert body["alerts"] is not None
    assert "Official alerts: check IMD" in body["alerts"]
    assert "https://mausam.imd.gov.in/" in body["alerts"]


def test_search_locations_empty_query(client_with_mock_provider):
    """Empty query string returns HTTP 400."""
    response = client_with_mock_provider.get("/api/locations/search?q=   ")
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Test: Current Weather
# ---------------------------------------------------------------------------

def test_get_current_weather_success(client_with_mock_provider):
    """Verify GET /api/weather/current returns WeatherSnapshot envelope with IMD notice."""
    response = client_with_mock_provider.get("/api/weather/current?latitude=23.0225&longitude=72.5714")
    assert response.status_code == 200

    body = response.json()
    assert body["data"]["temperature"] == 30.0
    assert body["data"]["coordinates"]["latitude"] == 23.0225
    assert "Official alerts: check IMD" in body["alerts"]
    assert body["source"]["provider"] == "open-meteo"


def test_get_current_weather_fahrenheit(client_with_mock_provider):
    """Verify units=fahrenheit is passed through."""
    response = client_with_mock_provider.get(
        "/api/weather/current?latitude=23.0225&longitude=72.5714&units=fahrenheit"
    )
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["temperature"] == 86.0
    assert body["units"]["temperature"] == "fahrenheit"


def test_get_current_weather_invalid_coordinates(client_with_mock_provider):
    """Out-of-bound latitude returns HTTP 422 validation error."""
    response = client_with_mock_provider.get("/api/weather/current?latitude=999.0&longitude=0")
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Test: Forecast (Daily + Hourly)
# ---------------------------------------------------------------------------

def test_get_forecast_success(client_with_mock_provider):
    """Verify GET /api/weather/forecast returns daily summaries and hourly points."""
    response = client_with_mock_provider.get(
        "/api/weather/forecast?latitude=23.0225&longitude=72.5714&days=7"
    )
    assert response.status_code == 200

    body = response.json()
    forecast = body["data"]
    assert len(forecast["daily"]) == 7
    assert len(forecast["hourly"]) >= 1
    assert "Official alerts: check IMD" in body["alerts"]


# ---------------------------------------------------------------------------
# Test: Historical Weather
# ---------------------------------------------------------------------------

def test_get_historical_weather_success(client_with_mock_provider):
    """Verify GET /api/weather/history returns historical records."""
    response = client_with_mock_provider.get(
        "/api/weather/history?latitude=23.0225&longitude=72.5714&start=2026-10-01&end=2026-10-05"
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["data"]) == 1
    assert body["data"][0]["dataset_type"] == "reanalysis"


def test_get_historical_weather_start_after_end(client_with_mock_provider):
    """Start date after end date returns HTTP 400."""
    response = client_with_mock_provider.get(
        "/api/weather/history?latitude=23.0225&longitude=72.5714&start=2026-10-10&end=2026-10-01"
    )
    assert response.status_code == 400
    assert "cannot be after end date" in response.json()["detail"]


# ---------------------------------------------------------------------------
# Test: Air Quality
# ---------------------------------------------------------------------------

def test_get_air_quality_success(client_with_mock_provider):
    """Verify GET /api/air-quality returns AQI and particulate data."""
    response = client_with_mock_provider.get("/api/air-quality?latitude=23.0225&longitude=72.5714")
    assert response.status_code == 200

    body = response.json()
    assert body["data"]["aqi"] == 65.0
    assert body["data"]["pm2_5"] == 18.4
    assert "Official alerts: check IMD" in body["alerts"]


# ---------------------------------------------------------------------------
# Test: Upstream Errors (Timeout, 500, Malformed) Mapped to Clean ErrorResponse
# ---------------------------------------------------------------------------

def test_upstream_timeout_mapped_to_504():
    """Upstream timeout yields HTTP 504 and ErrorResponse schema."""
    timeout_provider = MockWeatherProvider(should_fail="timeout")
    app.dependency_overrides[get_weather_provider] = lambda: timeout_provider

    client = TestClient(app)
    response = client.get("/api/weather/current?latitude=23.0225&longitude=72.5714")
    app.dependency_overrides.clear()

    assert response.status_code == 504
    body = response.json()
    assert body["code"] == "UPSTREAM_TIMEOUT"
    assert "retrieved_at" in body
    assert "provider" in body


def test_upstream_500_mapped_to_502():
    """Upstream 500 server error yields HTTP 502 and ErrorResponse schema."""
    failing_provider = MockWeatherProvider(should_fail="500")
    app.dependency_overrides[get_weather_provider] = lambda: failing_provider

    client = TestClient(app)
    response = client.get("/api/weather/current?latitude=23.0225&longitude=72.5714")
    app.dependency_overrides.clear()

    assert response.status_code == 502
    body = response.json()
    assert body["code"] == "UPSTREAM_SERVICE_ERROR"


def test_upstream_malformed_json_mapped_to_502():
    """Malformed provider data yields HTTP 502 and UPSTREAM_DATA_ERROR."""
    malformed_provider = MockWeatherProvider(should_fail="malformed")
    app.dependency_overrides[get_weather_provider] = lambda: malformed_provider

    client = TestClient(app)
    response = client.get("/api/weather/current?latitude=23.0225&longitude=72.5714")
    app.dependency_overrides.clear()

    assert response.status_code == 502
    body = response.json()
    assert body["code"] == "UPSTREAM_DATA_ERROR"
