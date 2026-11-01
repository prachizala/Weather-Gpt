"""Tests for Phase 7: Historical comparison, deterministic math, rule-based advisories, and verifier."""

import pytest
from datetime import date, datetime, timezone, timedelta
from unittest.mock import AsyncMock

from backend.app.schemas.base import Coordinates
from backend.app.schemas.comparison import HistoricalComparisonResult, YearComparisonRow
from backend.app.schemas.location import Location
from backend.app.schemas.weather import AirQuality, DailyForecast, ForecastData, HistoricalRecord, WeatherSnapshot
from backend.app.services.advisories import AdvisoryEngine, advisory_engine
from backend.app.services.historical_comparison import (
    PeriodMisalignmentError,
    build_equivalent_date_ranges,
    compute_period_statistics,
    execute_historical_comparison,
)
from backend.app.services.number_verifier import (
    build_deterministic_answer,
    extract_numbers_from_text,
    extract_payload_numbers,
    verify_numbers,
)
from backend.app.services.providers import WeatherProvider


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


# ---------------------------------------------------------------------------
# 1. Totals Reproduce on Fixed Fixture Data (Deterministic Math)
# ---------------------------------------------------------------------------
def test_totals_reproduce_on_fixed_fixture_data():
    coords = Coordinates(latitude=23.0225, longitude=72.5714)
    now = datetime(2026, 10, 18, 12, 0, tzinfo=timezone.utc)
    units = {"precipitation": "mm", "temperature": "celsius"}

    # Fixed 3-day fixture:
    # 2026-10-01: 3 hours with 4.0, 5.0, 3.5 mm -> total 12.5 mm, rainy
    # 2026-10-02: 2 hours with 0.0, 0.0 mm -> total 0.0 mm, not rainy
    # 2026-10-03: 1 hour with 5.5 mm -> total 5.5 mm, rainy
    records = [
        HistoricalRecord(
            dataset_type="reanalysis",
            timestamp=datetime(2026, 10, 1, 8, 0, tzinfo=timezone.utc),
            temperature=28.0,
            precipitation=4.0,
            coordinates=coords,
            provider="open-meteo",
            retrieved_at=now,
            timezone="Asia/Kolkata",
            units=units,
        ),
        HistoricalRecord(
            dataset_type="reanalysis",
            timestamp=datetime(2026, 10, 1, 14, 0, tzinfo=timezone.utc),
            temperature=32.0,
            precipitation=5.0,
            coordinates=coords,
            provider="open-meteo",
            retrieved_at=now,
            timezone="Asia/Kolkata",
            units=units,
        ),
        HistoricalRecord(
            dataset_type="reanalysis",
            timestamp=datetime(2026, 10, 1, 20, 0, tzinfo=timezone.utc),
            temperature=29.0,
            precipitation=3.5,
            coordinates=coords,
            provider="open-meteo",
            retrieved_at=now,
            timezone="Asia/Kolkata",
            units=units,
        ),
        HistoricalRecord(
            dataset_type="reanalysis",
            timestamp=datetime(2026, 10, 2, 10, 0, tzinfo=timezone.utc),
            temperature=30.0,
            precipitation=0.0,
            coordinates=coords,
            provider="open-meteo",
            retrieved_at=now,
            timezone="Asia/Kolkata",
            units=units,
        ),
        HistoricalRecord(
            dataset_type="reanalysis",
            timestamp=datetime(2026, 10, 3, 12, 0, tzinfo=timezone.utc),
            temperature=31.0,
            precipitation=5.5,
            coordinates=coords,
            provider="open-meteo",
            retrieved_at=now,
            timezone="Asia/Kolkata",
            units=units,
        ),
    ]

    row = compute_period_statistics(
        year=2026,
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 3),
        records=records,
    )

    # 12.5 + 0.0 + 5.5 = 18.0
    assert row.total_precipitation == 18.0
    # 18.0 / 3 days = 6.0 mm/day
    assert row.mean_daily_precipitation == 6.0
    # Day 1 had 12.5 mm
    assert row.max_daily_precipitation == 12.5
    # Days with precip >= 0.1 mm: Day 1 (12.5) and Day 3 (5.5) -> 2 days
    assert row.rainy_days == 2
    assert row.expected_days == 3
    assert row.actual_days == 3
    assert row.missing_days == 0
    assert row.coverage_pct == 100.0
    assert row.gaps == []
    assert row.dataset_type == "reanalysis"


# ---------------------------------------------------------------------------
# 2. Missing-Day Handling & Gap Reporting
# ---------------------------------------------------------------------------
def test_missing_day_handling():
    coords = Coordinates(latitude=23.0225, longitude=72.5714)
    now = datetime(2026, 10, 18, 12, 0, tzinfo=timezone.utc)
    units = {"precipitation": "mm", "temperature": "celsius"}

    # Period of 5 days: Oct 1 to Oct 5
    # Provide data for only Oct 1, Oct 2, Oct 5 (Oct 3 and Oct 4 missing)
    records = [
        HistoricalRecord(
            dataset_type="reanalysis",
            timestamp=datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc),
            temperature=30.0,
            precipitation=2.0,
            coordinates=coords,
            provider="open-meteo",
            retrieved_at=now,
            timezone="Asia/Kolkata",
            units=units,
        ),
        HistoricalRecord(
            dataset_type="reanalysis",
            timestamp=datetime(2026, 10, 2, 12, 0, tzinfo=timezone.utc),
            temperature=29.0,
            precipitation=3.0,
            coordinates=coords,
            provider="open-meteo",
            retrieved_at=now,
            timezone="Asia/Kolkata",
            units=units,
        ),
        HistoricalRecord(
            dataset_type="reanalysis",
            timestamp=datetime(2026, 10, 5, 12, 0, tzinfo=timezone.utc),
            temperature=31.0,
            precipitation=1.0,
            coordinates=coords,
            provider="open-meteo",
            retrieved_at=now,
            timezone="Asia/Kolkata",
            units=units,
        ),
    ]

    row = compute_period_statistics(
        year=2026,
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 5),
        records=records,
    )

    assert row.expected_days == 5
    assert row.actual_days == 3
    assert row.missing_days == 2
    assert row.coverage_pct == 60.0
    assert row.gaps == ["2026-10-03", "2026-10-04"]


# ---------------------------------------------------------------------------
# 3. Period Misalignment Rejected
# ---------------------------------------------------------------------------
def test_period_misalignment_rejected():
    # Start date after end date
    with pytest.raises(PeriodMisalignmentError, match="cannot be after end date"):
        build_equivalent_date_ranges(
            start_date=date(2026, 10, 20),
            end_date=date(2026, 10, 10),
            years_back=5,
        )


# ---------------------------------------------------------------------------
# 4. Advisory Rules Triggers and Thresholds
# ---------------------------------------------------------------------------
def test_umbrella_rule_triggers_and_thresholds():
    engine = AdvisoryEngine()

    # Case 1: precipitation_probability >= 40 triggers umbrella
    fc_rainy = ForecastData(
        daily=[
            DailyForecast(
                date="2026-10-18",
                temperature_max=32.0,
                temperature_min=22.0,
                precipitation_sum=0.0,
                precipitation_probability_max=65.0,  # >= 40%
                coordinates=Coordinates(latitude=23.0, longitude=72.0),
                provider="test",
                retrieved_at=datetime.now(timezone.utc),
                timezone="Asia/Kolkata",
                units={},
            )
        ]
    )
    report = engine.evaluate(forecast=fc_rainy)
    umbrella = next((a for a in report.advisories if a.rule_id == "umbrella_rain"), None)
    assert umbrella is not None
    assert umbrella.triggered_by["field"] == "precipitation_probability_max"
    assert umbrella.triggered_by["value"] == 65.0

    # Case 2: precipitation_probability < 40 and precipitation = 0 does NOT trigger umbrella
    fc_dry = ForecastData(
        daily=[
            DailyForecast(
                date="2026-10-18",
                temperature_max=32.0,
                temperature_min=22.0,
                precipitation_sum=0.0,
                precipitation_probability_max=20.0,  # below 40%
                weather_code=0,
                coordinates=Coordinates(latitude=23.0, longitude=72.0),
                provider="test",
                retrieved_at=datetime.now(timezone.utc),
                timezone="Asia/Kolkata",
                units={},
            )
        ]
    )
    snap_dry = WeatherSnapshot(
        timestamp=datetime.now(timezone.utc),
        temperature=30.0,
        precipitation=0.0,
        weather_code=0,
        coordinates=Coordinates(latitude=23.0, longitude=72.0),
        provider="test",
        retrieved_at=datetime.now(timezone.utc),
        timezone="Asia/Kolkata",
        units={},
    )
    report_dry = engine.evaluate(current=snap_dry, forecast=fc_dry)
    umbrella_dry = next((a for a in report_dry.advisories if a.rule_id == "umbrella_rain"), None)
    assert umbrella_dry is None


def test_heat_rule_triggers_and_thresholds():
    engine = AdvisoryEngine()
    coords = Coordinates(latitude=23.0, longitude=72.0)
    now = datetime.now(timezone.utc)

    # Apparent temp 42.5 >= 40.0 triggers
    hot_snap = WeatherSnapshot(
        timestamp=now,
        temperature=38.0,
        apparent_temperature=42.5,
        coordinates=coords,
        provider="test",
        retrieved_at=now,
        timezone="Asia/Kolkata",
        units={},
    )
    report_hot = engine.evaluate(current=hot_snap)
    heat_adv = next((a for a in report_hot.advisories if a.rule_id == "heat_caution"), None)
    assert heat_adv is not None
    assert heat_adv.severity == "warning"

    # Mild temp 28.0 does not trigger
    mild_snap = WeatherSnapshot(
        timestamp=now,
        temperature=28.0,
        apparent_temperature=29.0,
        coordinates=coords,
        provider="test",
        retrieved_at=now,
        timezone="Asia/Kolkata",
        units={},
    )
    report_mild = engine.evaluate(current=mild_snap)
    assert not any(a.rule_id == "heat_caution" for a in report_mild.advisories)


def test_wind_rule_triggers_and_thresholds():
    engine = AdvisoryEngine()
    coords = Coordinates(latitude=23.0, longitude=72.0)
    now = datetime.now(timezone.utc)

    windy_snap = WeatherSnapshot(
        timestamp=now,
        temperature=25.0,
        wind_speed=42.0,  # >= 35.0 km/h
        coordinates=coords,
        provider="test",
        retrieved_at=now,
        timezone="Asia/Kolkata",
        units={},
    )
    report = engine.evaluate(current=windy_snap)
    wind_adv = next((a for a in report.advisories if a.rule_id == "strong_wind"), None)
    assert wind_adv is not None

    calm_snap = WeatherSnapshot(
        timestamp=now,
        temperature=25.0,
        wind_speed=12.0,
        coordinates=coords,
        provider="test",
        retrieved_at=now,
        timezone="Asia/Kolkata",
        units={},
    )
    report_calm = engine.evaluate(current=calm_snap)
    assert not any(a.rule_id == "strong_wind" for a in report_calm.advisories)


def test_air_quality_rule_triggers_and_missing_handling():
    engine = AdvisoryEngine()
    coords = Coordinates(latitude=23.0, longitude=72.0)
    now = datetime.now(timezone.utc)

    # 1. Unhealthy AQI (145 >= 101) triggers
    polluted_aqi = AirQuality(
        timestamp=now,
        aqi=145.0,
        pm2_5=42.0,
        coordinates=coords,
        provider="test",
        retrieved_at=now,
        timezone="Asia/Kolkata",
        units={},
    )
    report_polluted = engine.evaluate(air_quality=polluted_aqi)
    aq_adv = next((a for a in report_polluted.advisories if a.rule_id == "poor_air_quality"), None)
    assert aq_adv is not None

    # 2. Good AQI (42 < 101, PM2.5 10 < 35.5) does not trigger
    clean_aqi = AirQuality(
        timestamp=now,
        aqi=42.0,
        pm2_5=10.0,
        coordinates=coords,
        provider="test",
        retrieved_at=now,
        timezone="Asia/Kolkata",
        units={},
    )
    report_clean = engine.evaluate(air_quality=clean_aqi)
    assert not any(a.rule_id == "poor_air_quality" for a in report_clean.advisories)

    # 3. Missing variables: When air quality is None, rule is skipped with note, never guessed!
    report_missing = engine.evaluate(
        current=WeatherSnapshot(
            timestamp=now,
            temperature=25.0,
            coordinates=coords,
            provider="test",
            retrieved_at=now,
            timezone="Asia/Kolkata",
            units={},
        ),
        air_quality=None,
    )
    assert not any(a.rule_id == "poor_air_quality" for a in report_missing.advisories)
    skipped = next((s for s in report_missing.skipped_rules if s.rule_id == "poor_air_quality"), None)
    assert skipped is not None
    assert "Missing required" in skipped.reason


# ---------------------------------------------------------------------------
# 5. Number Verifier Works on Comparison Answers
# ---------------------------------------------------------------------------
def test_number_verifier_on_comparison_payload():
    loc = _dummy_location()
    table = [
        YearComparisonRow(
            year=2021,
            period_start="2021-10-01",
            period_end="2021-10-18",
            total_precipitation=12.4,
            mean_daily_precipitation=0.69,
            max_daily_precipitation=8.0,
            rainy_days=2,
            expected_days=18,
            actual_days=18,
            missing_days=0,
            coverage_pct=100.0,
            dataset_type="reanalysis",
        ),
        YearComparisonRow(
            year=2026,
            period_start="2026-10-01",
            period_end="2026-10-18",
            total_precipitation=4.2,
            mean_daily_precipitation=0.23,
            max_daily_precipitation=3.1,
            rainy_days=1,
            expected_days=18,
            actual_days=18,
            missing_days=0,
            coverage_pct=100.0,
            dataset_type="reanalysis",
        ),
    ]

    comp_result = HistoricalComparisonResult(
        location=loc,
        target_period_description="October 1 – 18 (2021–2026)",
        variable="precipitation_sum",
        years_compared=2,
        baseline_years=[2021],
        baseline_mean_total=12.4,
        table=table,
        chart_data=[],
        method_text="Deterministic Python aggregation",
        limitations=["Small sample size cannot infer climate trends."],
    )

    # 1. Valid answer referencing payload numbers
    valid_text = (
        "In Ahmedabad, rainfall for October 1 to 18 in 2026 reached 4.2 mm, while 2021 recorded 12.4 mm. "
        "The baseline average was 12.4 mm with 100% data coverage."
    )
    is_valid, mismatches = verify_numbers(valid_text, comp_result)
    assert is_valid
    assert mismatches == []

    # 2. Injected wrong number (e.g. 98.7 mm)
    invalid_text = (
        "In Ahmedabad, rainfall for October 1 to 18 in 2026 reached 98.7 mm, which exceeds 12.4 mm."
    )
    is_valid_inv, mismatches_inv = verify_numbers(invalid_text, comp_result)
    assert not is_valid_inv
    assert any(abs(m - 98.7) < 0.1 for m in mismatches_inv)

    # 3. Deterministic template fallback
    det_ans = build_deterministic_answer("get_history_comparison", loc, comp_result, language="en")
    assert "4.2 mm" in det_ans
    assert "12.4 mm" in det_ans
    assert "Ahmedabad" in det_ans
    assert "Statistical limitations" in det_ans


# ---------------------------------------------------------------------------
# 6. Acceptance Test: October Comparison Returns Reproducible Table & Chart
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_acceptance_october_comparison():
    loc = _dummy_location()
    mock_provider = AsyncMock(spec=WeatherProvider)

    # Mock historical weather: return fixed rain records per year
    def fake_historical(location, start_date, end_date, units="celsius"):
        y = start_date.year
        coords = location.coordinates
        now = datetime.now(timezone.utc)
        # 2021: 10.0 mm, 2022: 20.0 mm, 2023: 15.0 mm, 2024: 5.0 mm, 2025: 0.0 mm, 2026: 8.0 mm
        val_map = {2021: 10.0, 2022: 20.0, 2023: 15.0, 2024: 5.0, 2025: 0.0, 2026: 8.0}
        rain_val = val_map.get(y, 5.0)

        records = [
            HistoricalRecord(
                dataset_type="reanalysis",
                timestamp=datetime(y, 10, 5, 12, 0, tzinfo=timezone.utc),
                temperature=30.0,
                precipitation=rain_val,
                coordinates=coords,
                provider="open-meteo",
                retrieved_at=now,
                timezone="Asia/Kolkata",
                units={"precipitation": "mm", "temperature": "celsius"},
            )
        ]
        return records

    mock_provider.get_historical_weather = AsyncMock(side_effect=fake_historical)

    result = await execute_historical_comparison(
        weather_provider=mock_provider,
        location=loc,
        start_date="2026-10-01",
        end_date="2026-10-18",
        years_back=5,
    )

    # Check years compared: 2021, 2022, 2023, 2024, 2025, 2026 -> 6 years
    assert result.years_compared == 6
    assert len(result.table) == 6
    assert len(result.chart_data) == 6

    # Verify baseline average: (10 + 20 + 15 + 5 + 0) / 5 = 10.0 mm
    assert result.baseline_mean_total == 10.0

    # 2026 row
    row_2026 = next(r for r in result.table if r.year == 2026)
    assert row_2026.total_precipitation == 8.0
    assert row_2026.dataset_type == "reanalysis"

    # 2026 chart point anomaly: 8.0 - 10.0 = -2.0 mm
    chart_2026 = next(c for c in result.chart_data if c.year == 2026)
    assert chart_2026.anomaly == -2.0
    assert chart_2026.label == "2026 (Target)"

    # Verify honest limitations note
    assert any("Small sample size" in lim for lim in result.limitations)
    assert any("ERA5" in lim or "reanalysis" in lim.lower() for lim in result.limitations)
    assert "Deterministic Python aggregation" in result.method_text


# ---------------------------------------------------------------------------
# 7. Endpoint Tests: /api/advisories and /api/weather/compare
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_api_advisories_endpoint():
    from httpx import ASGITransport, AsyncClient
    from backend.app.main import create_app

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/advisories", params={"latitude": 23.0225, "longitude": 72.5714})
        assert resp.status_code == 200
        body = resp.json()
        assert "data" in body
        data = body["data"]
        assert "disclaimer" in data
        assert data["disclaimer"] == "App suggestion, not an official warning"
        assert "advisories" in data
        assert "skipped_rules" in data
        assert "official_alerts_link" in data
        assert "https://mausam.imd.gov.in" in data["official_alerts_link"]


@pytest.mark.asyncio
async def test_api_weather_compare_endpoint():
    from httpx import ASGITransport, AsyncClient
    from backend.app.main import create_app

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Invalid start date after end date should return 400
        bad_resp = await ac.get(
            "/api/weather/compare",
            params={
                "latitude": 23.0225,
                "longitude": 72.5714,
                "start_date": "2026-10-20",
                "end_date": "2026-10-10",
            },
        )
        assert bad_resp.status_code == 400
