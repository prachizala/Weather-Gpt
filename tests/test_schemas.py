"""Unit tests for WeatherGPT Pydantic schema validation."""

from datetime import datetime, timezone, timedelta
import pytest
from pydantic import ValidationError

from backend.app.schemas import (
    AirQuality,
    Coordinates,
    ChatRequest,
    ChatResponse,
    ErrorResponse,
    ForecastPoint,
    HistoricalRecord,
    Location,
    SourceRef,
    WeatherSnapshot,
)


@pytest.fixture
def valid_coords() -> Coordinates:
    return Coordinates(latitude=51.5074, longitude=-0.1278, elevation=15.0)


@pytest.fixture
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Test: Required Fields & Missing Fields
# ---------------------------------------------------------------------------

def test_missing_fields_coordinates():
    """Latitude and longitude are strictly required in Coordinates."""
    with pytest.raises(ValidationError) as exc_info:
        Coordinates(latitude=45.0)  # missing longitude
    assert "longitude" in str(exc_info.value)

    with pytest.raises(ValidationError) as exc_info:
        Coordinates(longitude=45.0)  # missing latitude
    assert "latitude" in str(exc_info.value)


def test_missing_fields_location(valid_coords, now_utc):
    """Location requires name and coordinates."""
    with pytest.raises(ValidationError) as exc_info:
        Location(
            coordinates=valid_coords,
            provider="open-meteo",
            retrieved_at=now_utc,
            timezone="Europe/London",
        )  # missing name
    assert "name" in str(exc_info.value)

    with pytest.raises(ValidationError) as exc_info:
        Location(
            name="London",
            provider="open-meteo",
            retrieved_at=now_utc,
            timezone="Europe/London",
        )  # missing coordinates
    assert "coordinates" in str(exc_info.value)


def test_missing_fields_weather_snapshot(valid_coords, now_utc):
    """WeatherSnapshot requires temperature, timestamp, coordinates, provider, retrieved_at, timezone."""
    with pytest.raises(ValidationError) as exc_info:
        WeatherSnapshot(
            temperature=18.5,
            coordinates=valid_coords,
            provider="open-meteo",
            timezone="UTC",
            # missing timestamp and retrieved_at
        )
    errors = str(exc_info.value)
    assert "timestamp" in errors
    assert "retrieved_at" in errors


def test_missing_fields_historical_record(valid_coords, now_utc):
    """HistoricalRecord requires dataset_type, timestamp, temperature, coordinates, etc."""
    past_time = now_utc - timedelta(days=10)
    with pytest.raises(ValidationError) as exc_info:
        HistoricalRecord(
            timestamp=past_time,
            temperature=12.0,
            coordinates=valid_coords,
            provider="open-meteo",
            retrieved_at=now_utc,
            timezone="UTC",
            # missing dataset_type
        )
    assert "dataset_type" in str(exc_info.value)


# ---------------------------------------------------------------------------
# Test: Dataset Type for HistoricalRecord
# ---------------------------------------------------------------------------

def test_historical_record_dataset_type_allowed(valid_coords, now_utc):
    """HistoricalRecord accepts observation, reanalysis, or forecast."""
    past_time = now_utc - timedelta(days=5)

    for dtype in ["observation", "reanalysis", "forecast"]:
        record = HistoricalRecord(
            dataset_type=dtype,
            timestamp=past_time,
            temperature=15.0,
            coordinates=valid_coords,
            provider="open-meteo",
            retrieved_at=now_utc,
            timezone="UTC",
            units={"temperature": "celsius"},
        )
        assert record.dataset_type == dtype


def test_historical_record_dataset_type_invalid(valid_coords, now_utc):
    """HistoricalRecord rejects unapproved dataset_type."""
    past_time = now_utc - timedelta(days=5)
    with pytest.raises(ValidationError) as exc_info:
        HistoricalRecord(
            dataset_type="invalid_dataset_source",
            timestamp=past_time,
            temperature=15.0,
            coordinates=valid_coords,
            provider="open-meteo",
            retrieved_at=now_utc,
            timezone="UTC",
            units={"temperature": "celsius"},
        )
    assert "dataset_type" in str(exc_info.value)


# ---------------------------------------------------------------------------
# Test: Wrong Units Validation
# ---------------------------------------------------------------------------

def test_wrong_units_validation(valid_coords, now_utc):
    """Unit validation rejects incompatible units for recognized meteorological metrics."""
    # Temperature with an invalid unit (e.g., 'lightyears' or 'km/h')
    with pytest.raises(ValidationError) as exc_info:
        WeatherSnapshot(
            temperature=20.0,
            timestamp=now_utc,
            coordinates=valid_coords,
            provider="open-meteo",
            retrieved_at=now_utc,
            timezone="UTC",
            units={"temperature": "km/h"},  # wrong unit!
        )
    assert "Invalid unit 'km/h' for variable 'temperature'" in str(exc_info.value)

    # Wind speed with invalid unit (e.g., 'celsius')
    with pytest.raises(ValidationError) as exc_info:
        WeatherSnapshot(
            temperature=20.0,
            timestamp=now_utc,
            coordinates=valid_coords,
            provider="open-meteo",
            retrieved_at=now_utc,
            timezone="UTC",
            units={"temperature": "celsius", "wind_speed": "celsius"},  # wrong unit!
        )
    assert "Invalid unit 'celsius' for variable 'wind_speed'" in str(exc_info.value)

    # Precipitation with invalid unit
    with pytest.raises(ValidationError) as exc_info:
        ForecastPoint(
            temperature=15.0,
            timestamp=now_utc + timedelta(hours=2),
            coordinates=valid_coords,
            provider="open-meteo",
            retrieved_at=now_utc,
            timezone="UTC",
            units={"precipitation": "seconds"},  # wrong unit!
        )
    assert "Invalid unit 'seconds' for variable 'precipitation'" in str(exc_info.value)


def test_valid_units_accepted(valid_coords, now_utc):
    """Legitimate units are validated and preserved."""
    snapshot = WeatherSnapshot(
        temperature=22.5,
        timestamp=now_utc,
        coordinates=valid_coords,
        provider="open-meteo",
        retrieved_at=now_utc,
        timezone="UTC",
        units={
            "temperature": "celsius",
            "wind_speed": "km/h",
            "precipitation": "mm",
            "pressure": "hpa",
            "relative_humidity": "%",
        },
    )
    assert snapshot.units["temperature"] == "celsius"
    assert snapshot.units["wind_speed"] == "km/h"


# ---------------------------------------------------------------------------
# Test: Invalid Dates & Timestamps
# ---------------------------------------------------------------------------

def test_invalid_date_format(valid_coords):
    """Pydantic rejects non-date or malformed date strings."""
    with pytest.raises(ValidationError):
        WeatherSnapshot(
            temperature=20.0,
            timestamp="not-a-valid-date",
            coordinates=valid_coords,
            provider="open-meteo",
            retrieved_at="2026-02-30T12:00:00Z",  # February 30 does not exist
            timezone="UTC",
        )


def test_retrieved_at_in_distant_future(valid_coords):
    """retrieved_at cannot be set to a distant future date."""
    far_future = datetime.now(timezone.utc) + timedelta(days=30)
    with pytest.raises(ValidationError) as exc_info:
        WeatherSnapshot(
            temperature=20.0,
            timestamp=datetime.now(timezone.utc),
            coordinates=valid_coords,
            provider="open-meteo",
            retrieved_at=far_future,
            timezone="UTC",
        )
    assert "retrieved_at timestamp cannot be in the future" in str(exc_info.value)


def test_historical_observation_date_cannot_be_in_future(valid_coords, now_utc):
    """Historical observation or reanalysis timestamp cannot be in the future."""
    future_time = now_utc + timedelta(days=10)
    with pytest.raises(ValidationError) as exc_info:
        HistoricalRecord(
            dataset_type="observation",
            timestamp=future_time,
            temperature=15.0,
            coordinates=valid_coords,
            provider="open-meteo",
            retrieved_at=now_utc,
            timezone="UTC",
            units={"temperature": "celsius"},
        )
    assert "Historical 'observation' timestamp cannot be in the future" in str(exc_info.value)


# ---------------------------------------------------------------------------
# Test: Coordinates Boundaries
# ---------------------------------------------------------------------------

def test_coordinates_boundaries():
    """Latitude must be between -90 and 90, Longitude between -180 and 180."""
    with pytest.raises(ValidationError):
        Coordinates(latitude=95.0, longitude=0.0)

    with pytest.raises(ValidationError):
        Coordinates(latitude=-91.0, longitude=0.0)

    with pytest.raises(ValidationError):
        Coordinates(latitude=0.0, longitude=185.0)

    with pytest.raises(ValidationError):
        Coordinates(latitude=0.0, longitude=-185.0)


# ---------------------------------------------------------------------------
# Test: All Models Store Units, Provider, Retrieved_at, Coordinates, Timezone
# ---------------------------------------------------------------------------

def test_all_models_store_core_fields(valid_coords, now_utc):
    """Verify that every domain model has units, provider, retrieved_at, coordinates, timezone."""
    models_to_test = [
        Location(
            name="Paris",
            country="France",
            coordinates=valid_coords,
            provider="open-meteo",
            retrieved_at=now_utc,
            timezone="Europe/Paris",
            units={},
        ),
        WeatherSnapshot(
            temperature=19.0,
            timestamp=now_utc,
            coordinates=valid_coords,
            provider="open-meteo",
            retrieved_at=now_utc,
            timezone="Europe/Paris",
            units={"temperature": "celsius"},
        ),
        ForecastPoint(
            temperature=21.0,
            timestamp=now_utc + timedelta(hours=3),
            coordinates=valid_coords,
            provider="open-meteo",
            retrieved_at=now_utc,
            timezone="Europe/Paris",
            units={"temperature": "celsius"},
        ),
        HistoricalRecord(
            dataset_type="reanalysis",
            timestamp=now_utc - timedelta(days=30),
            temperature=14.0,
            coordinates=valid_coords,
            provider="open-meteo",
            retrieved_at=now_utc,
            timezone="Europe/Paris",
            units={"temperature": "celsius"},
        ),
        AirQuality(
            timestamp=now_utc,
            pm2_5=8.4,
            pm10=15.2,
            coordinates=valid_coords,
            provider="open-meteo",
            retrieved_at=now_utc,
            timezone="Europe/Paris",
            units={"pm2_5": "μg/m³", "pm10": "μg/m³"},
        ),
        ChatRequest(
            message="What is the weather forecast for tomorrow?",
            provider="user",
            retrieved_at=now_utc,
            coordinates=valid_coords,
            timezone="Europe/Paris",
            units={"temperature": "celsius"},
        ),
        ChatResponse(
            response="The forecast for Paris tomorrow is mild with clear skies.",
            provider="weather-gpt",
            retrieved_at=now_utc,
            coordinates=valid_coords,
            timezone="Europe/Paris",
            units={"temperature": "celsius"},
        ),
        SourceRef(
            title="Open-Meteo Weather Forecast API",
            uri="https://api.open-meteo.com/v1/forecast",
            provider="open-meteo",
            retrieved_at=now_utc,
            coordinates=valid_coords,
            timezone="Europe/Paris",
            units={},
        ),
        ErrorResponse(
            error="NotFound",
            detail="Location could not be geocoded",
            code="NOT_FOUND",
            status_code=404,
            provider="weather-gpt",
            retrieved_at=now_utc,
            coordinates=valid_coords,
            timezone="Europe/Paris",
            units={},
        ),
    ]

    for model_instance in models_to_test:
        fields = model_instance.model_dump()
        assert "units" in fields, f"{type(model_instance).__name__} is missing 'units'"
        assert "provider" in fields, f"{type(model_instance).__name__} is missing 'provider'"
        assert "retrieved_at" in fields, f"{type(model_instance).__name__} is missing 'retrieved_at'"
        assert "coordinates" in fields, f"{type(model_instance).__name__} is missing 'coordinates'"
        assert "timezone" in fields, f"{type(model_instance).__name__} is missing 'timezone'"
