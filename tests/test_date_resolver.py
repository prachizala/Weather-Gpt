"""Tests for deterministic relative-date resolution across timezones."""

from datetime import date, datetime, timezone
import pytest
from backend.app.utils.date_resolver import resolve_relative_dates


def test_relative_date_resolution_basic():
    """Verify today, tomorrow, yesterday, and day-after-tomorrow resolution."""
    ref_time = datetime(2026, 10, 18, 12, 0, 0, tzinfo=timezone.utc)

    # Today
    today_res = resolve_relative_dates("what is the weather today?", tz_name="UTC", reference_time=ref_time)
    assert today_res.start_date == date(2026, 10, 18)
    assert today_res.end_date == date(2026, 10, 18)
    assert today_res.period_type == "today"

    # Tomorrow
    tmrw_res = resolve_relative_dates("will it rain tomorrow in Paris?", tz_name="UTC", reference_time=ref_time)
    assert tmrw_res.start_date == date(2026, 10, 19)
    assert tmrw_res.end_date == date(2026, 10, 19)
    assert tmrw_res.period_type == "tomorrow"

    # Yesterday
    yest_res = resolve_relative_dates("how was the temperature yesterday?", tz_name="UTC", reference_time=ref_time)
    assert yest_res.start_date == date(2026, 10, 17)
    assert yest_res.end_date == date(2026, 10, 17)
    assert yest_res.period_type == "yesterday"

    # Day after tomorrow
    dat_res = resolve_relative_dates("forecast for day after tomorrow", tz_name="UTC", reference_time=ref_time)
    assert dat_res.start_date == date(2026, 10, 20)
    assert dat_res.end_date == date(2026, 10, 20)
    assert dat_res.period_type == "day_after_tomorrow"


def test_relative_dates_across_different_timezones():
    """Verify that when it is late night UTC, the local calendar day differs across timezones."""
    # 2026-10-18 at 20:00:00 UTC (8:00 PM UTC)
    ref_utc = datetime(2026, 10, 18, 20, 0, 0, tzinfo=timezone.utc)

    # In Asia/Kolkata (UTC+5:30), it is 2026-10-19 at 01:30 AM
    kolkata_res = resolve_relative_dates("today", tz_name="Asia/Kolkata", reference_time=ref_utc)
    assert kolkata_res.start_date == date(2026, 10, 19)

    kolkata_tmrw = resolve_relative_dates("tomorrow", tz_name="Asia/Kolkata", reference_time=ref_utc)
    assert kolkata_tmrw.start_date == date(2026, 10, 20)

    # In America/New_York (UTC-4 EDT), it is 2026-10-18 at 16:00 (4:00 PM)
    ny_res = resolve_relative_dates("today", tz_name="America/New_York", reference_time=ref_utc)
    assert ny_res.start_date == date(2026, 10, 18)

    ny_tmrw = resolve_relative_dates("tomorrow", tz_name="America/New_York", reference_time=ref_utc)
    assert ny_tmrw.start_date == date(2026, 10, 19)


def test_weekend_resolution():
    """Verify that 'this weekend' correctly resolves to Saturday and Sunday."""
    # Reference: Wednesday, October 14, 2026
    ref_wed = datetime(2026, 10, 14, 12, 0, 0, tzinfo=timezone.utc)
    res = resolve_relative_dates("plans for this weekend", tz_name="UTC", reference_time=ref_wed)

    # Saturday: Oct 17, Sunday: Oct 18
    assert res.start_date == date(2026, 10, 17)
    assert res.end_date == date(2026, 10, 18)
    assert res.period_type == "weekend"


def test_explicit_iso_date_resolution():
    """Verify explicit YYYY-MM-DD date in query is parsed accurately."""
    res = resolve_relative_dates("historical check for 2026-07-04", tz_name="UTC")
    assert res.start_date == date(2026, 7, 4)
    assert res.end_date == date(2026, 7, 4)
    assert res.period_type == "specific_date"
