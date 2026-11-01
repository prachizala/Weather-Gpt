"""Tests for the Number Verifier comparing LLM answer numbers against payloads."""

from datetime import datetime, timezone
import pytest

from backend.app.schemas.base import Coordinates
from backend.app.schemas.location import Location
from backend.app.schemas.weather import DailyForecast, ForecastData, WeatherSnapshot
from backend.app.services.number_verifier import (
    build_deterministic_answer,
    extract_numbers_from_text,
    extract_payload_numbers,
    verify_numbers,
)


@pytest.fixture
def sample_snapshot() -> WeatherSnapshot:
    now = datetime(2026, 10, 18, 10, 0, 0, tzinfo=timezone.utc)
    return WeatherSnapshot(
        timestamp=now,
        temperature=34.3,
        apparent_temperature=36.2,
        relative_humidity=34.0,
        precipitation=0.0,
        weather_code=3,
        cloud_cover=100.0,
        surface_pressure=1008.5,
        wind_speed=3.0,
        wind_direction=147.0,
        is_day=1,
        coordinates=Coordinates(latitude=23.0225, longitude=72.5714, elevation=53.0),
        provider="open-meteo",
        retrieved_at=now,
        timezone="Asia/Kolkata",
        units={"temperature": "celsius", "wind_speed": "km/h"},
    )


def test_extract_numbers_from_text():
    """Verify numeric extraction from conversational natural language strings."""
    text = "The temperature is 34.3°C with wind of 3 km/h and humidity around 34%. Next 7 days."
    nums = extract_numbers_from_text(text)
    assert 34.3 in nums
    assert 3.0 in nums
    assert 34.0 in nums
    assert 7.0 in nums


def test_verifier_accepts_valid_numbers_and_rounding(sample_snapshot):
    """Numbers matching payload values or valid roundings/conversions are verified."""
    # 34.3 rounded to 34, 36.2 rounded to 36
    answer = (
        "Currently in Ahmedabad, it is 34°C with a feels-like temperature of 36°C. "
        "Relative humidity is 34% and surface pressure is 1008.5 hPa."
    )
    is_valid, unmatched = verify_numbers(answer, sample_snapshot)
    assert is_valid is True
    assert unmatched == []


def test_verifier_accepts_unit_conversions(sample_snapshot):
    """Verify Fahrenheit conversion of 34.3°C (approx 93.7°F) is accepted."""
    # 34.3 * 9/5 + 32 = 93.74
    answer = "The current temperature is approximately 93.7°F."
    is_valid, unmatched = verify_numbers(answer, sample_snapshot)
    assert is_valid is True


def test_verifier_catches_injected_wrong_number(sample_snapshot):
    """Verifier detects an injected hallucinated number not present in the payload."""
    answer_with_hallucination = (
        "The temperature in Ahmedabad is 34.3°C, but tomorrow it will skyrocket to 88.5°C."
    )
    is_valid, unmatched = verify_numbers(answer_with_hallucination, sample_snapshot)
    assert is_valid is False
    assert 88.5 in unmatched


def test_deterministic_template_builder_on_fallback():
    """Verify deterministic template accurately renders facts from the payload."""
    now = datetime(2026, 10, 18, 10, 0, 0, tzinfo=timezone.utc)
    coords = Coordinates(latitude=23.0225, longitude=72.5714, elevation=53.0)
    loc = Location(
        name="Ahmedabad",
        country="India",
        country_code="IN",
        coordinates=coords,
        provider="open-meteo",
        retrieved_at=now,
        timezone="Asia/Kolkata",
        units={},
    )

    daily = DailyForecast(
        date="2026-10-19",
        temperature_max=35.0,
        temperature_min=24.0,
        precipitation_sum=0.0,
        precipitation_probability_max=0.0,
        weather_code=1,
        wind_speed_max=12.0,
        coordinates=coords,
        provider="open-meteo",
        retrieved_at=now,
        timezone="Asia/Kolkata",
        units={"temperature": "celsius"},
    )
    forecast_data = ForecastData(daily=[daily], hourly=[])

    answer = build_deterministic_answer(
        intent="forecast",
        location=loc,
        payload=forecast_data,
        valid_period={"start": "2026-10-19"},
    )

    assert "Ahmedabad" in answer
    assert "2026-10-19" in answer
    assert "35.0°C" in answer
    assert "24.0°C" in answer
    assert "No significant rain is expected" in answer

    # Verify that this deterministic answer passes its own number verifier 100%!
    is_valid, unmatched = verify_numbers(answer, forecast_data, {"start": "2026-10-19"})
    assert is_valid is True
    assert unmatched == []
