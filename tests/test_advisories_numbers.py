"""Tests for advisory message numerical accuracy and UV advisory bug fix."""

import re
import pytest
from datetime import datetime, timezone

from backend.app.schemas.base import Coordinates
from backend.app.schemas.location import Location
from backend.app.schemas.weather import AirQuality, DailyForecast, ForecastData, WeatherSnapshot
from backend.app.services.advisories import AdvisoryEngine, advisory_engine


def _dummy_location() -> Location:
    return Location(
        name="Ahmedabad",
        country="India",
        admin1="Gujarat",
        coordinates=Coordinates(latitude=23.0225, longitude=72.5714),
        provider="test",
        retrieved_at=datetime.now(timezone.utc),
        timezone="Asia/Kolkata",
        units={},
    )


def test_uv_advisory_message_uses_triggering_value():
    """Verify bug fix: UV advisory must cite the triggering variable and value,

    not a different variable (e.g. uv_index_max = 6.5 vs uv_index = 0.1).
    """
    coords = Coordinates(latitude=23.0225, longitude=72.5714)
    now = datetime.now(timezone.utc)

    # Context with low instantaneous UV (0.1, e.g. at night or morning)
    # but high forecasted daily max UV (7.5)
    air_quality = AirQuality(
        aqi=45.0,
        pm2_5=12.0,
        uv_index=0.1,
        coordinates=coords,
        timestamp=now,
        provider="test",
        retrieved_at=now,
        timezone="Asia/Kolkata",
        units={},
    )
    forecast = ForecastData(
        daily=[
            DailyForecast(
                date="2026-10-18",
                temperature_max=34.0,
                temperature_min=22.0,
                apparent_temperature_max=36.0,
                apparent_temperature_min=24.0,
                precipitation_sum=0.0,
                precipitation_probability_max=0,
                wind_speed_max=15.0,
                uv_index_max=7.5,
                weather_code=0,
                units={},
                coordinates=coords,
                provider="test",
                retrieved_at=now,
                timezone="Asia/Kolkata",
            )
        ],
        hourly=[],
        coordinates=coords,
        provider="test",
        retrieved_at=now,
        timezone="Asia/Kolkata",
    )

    report = advisory_engine.evaluate(current=None, forecast=forecast, air_quality=air_quality)
    uv_advisory = next((a for a in report.advisories if a.rule_id == "high_uv"), None)
    assert uv_advisory is not None, "Expected high_uv advisory to trigger on uv_index_max=7.5"

    assert uv_advisory.triggered_by["field"] == "uv_index_max"
    assert uv_advisory.triggered_by["value"] == 7.5

    # The explanation must contain 7.5, and NOT 0.1
    assert "7.5" in uv_advisory.explanation
    assert "0.1" not in uv_advisory.explanation


def test_every_number_in_advisory_message_matches_triggering_value_or_threshold():
    """Verify that every number cited in any active advisory explanation

    equals either the triggering value or the rule threshold.
    """
    coords = Coordinates(latitude=23.0225, longitude=72.5714)
    now = datetime.now(timezone.utc)

    current = WeatherSnapshot(
        temperature=42.5,
        apparent_temperature=43.2,
        relative_humidity=50,
        precipitation=5.5,
        wind_speed=38.0,
        weather_code=61,
        coordinates=coords,
        timestamp=now,
        provider="test",
        retrieved_at=now,
        timezone="Asia/Kolkata",
        units={},
    )
    air_quality = AirQuality(
        aqi=145.0,
        pm2_5=45.2,
        uv_index=8.0,
        coordinates=coords,
        timestamp=now,
        provider="test",
        retrieved_at=now,
        timezone="Asia/Kolkata",
        units={},
    )

    report = advisory_engine.evaluate(current=current, forecast=None, air_quality=air_quality)
    assert len(report.advisories) > 0

    for adv in report.advisories:
        t_val = adv.triggered_by["value"]
        t_thresh = adv.triggered_by.get("threshold")

        # Extract all numbers from explanation
        numbers_in_msg = [float(n) for n in re.findall(r"\b\d+(?:\.\d+)?\b", adv.explanation)]
        valid_numbers = [float(t_val)]
        if t_thresh is not None:
            valid_numbers.append(float(t_thresh))

        for num in numbers_in_msg:
            # Check if num is close to trigger value, threshold, or SPF / standard constant in text (e.g. 30 in SPF 30+)
            is_valid = any(abs(num - v) < 0.1 for v in valid_numbers) or num in (30.0,)
            assert is_valid, (
                f"Advisory '{adv.rule_id}' explanation '{adv.explanation}' contains unverified number {num}. "
                f"Triggering value was {t_val}, threshold was {t_thresh}."
            )
