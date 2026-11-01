"""Deterministic relative-date resolution in the location's specific timezone."""

from __future__ import annotations
import re
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo
from pydantic import BaseModel


class ResolvedDateRange(BaseModel):
    """Normalized date range with target temporal context."""
    start_date: date
    end_date: date
    period_type: str  # 'today', 'tomorrow', 'yesterday', 'weekend', 'specific_date', 'current'
    timezone: str
    description: str


def resolve_relative_dates(
    query: str,
    tz_name: str = "UTC",
    reference_time: Optional[datetime] = None,
) -> ResolvedDateRange:
    """Deterministically resolve relative dates in the target location's timezone.

    Supports:
      - 'today', 'tonight', 'current'
      - 'tomorrow', 'tmrw'
      - 'day after tomorrow'
      - 'yesterday'
      - 'this weekend', 'the weekend', 'upcoming weekend'
      - 'next weekend'
      - Explicit ISO dates (YYYY-MM-DD)
    """
    try:
        loc_tz = ZoneInfo(tz_name)
    except Exception:
        loc_tz = ZoneInfo("UTC")
        tz_name = "UTC"

    ref_utc = reference_time if reference_time is not None else datetime.now(timezone.utc)
    if ref_utc.tzinfo is None:
        ref_utc = ref_utc.replace(tzinfo=timezone.utc)

    # Project reference time into the target location's local timezone
    loc_now = ref_utc.astimezone(loc_tz)
    today = loc_now.date()

    q_lower = query.lower().strip()

    # 1. Day after tomorrow
    if re.search(r"\b(day after tomorrow)\b", q_lower):
        target = today + timedelta(days=2)
        return ResolvedDateRange(
            start_date=target,
            end_date=target,
            period_type="day_after_tomorrow",
            timezone=tz_name,
            description=f"Day after tomorrow ({target.isoformat()})",
        )

    # 2. Tomorrow
    if re.search(r"\b(tomorrow|tmrw)\b", q_lower):
        target = today + timedelta(days=1)
        return ResolvedDateRange(
            start_date=target,
            end_date=target,
            period_type="tomorrow",
            timezone=tz_name,
            description=f"Tomorrow ({target.isoformat()})",
        )

    # 3. Yesterday
    if re.search(r"\b(yesterday)\b", q_lower):
        target = today - timedelta(days=1)
        return ResolvedDateRange(
            start_date=target,
            end_date=target,
            period_type="yesterday",
            timezone=tz_name,
            description=f"Yesterday ({target.isoformat()})",
        )

    # 4. Next weekend
    if re.search(r"\b(next weekend)\b", q_lower):
        days_to_sat = (5 - today.weekday()) % 7
        if days_to_sat == 0:
            days_to_sat = 7
        sat = today + timedelta(days=days_to_sat + 7)
        sun = sat + timedelta(days=1)
        return ResolvedDateRange(
            start_date=sat,
            end_date=sun,
            period_type="next_weekend",
            timezone=tz_name,
            description=f"Next weekend ({sat.isoformat()} to {sun.isoformat()})",
        )

    # 5. This weekend / The weekend / Upcoming weekend
    if re.search(r"\b(this weekend|the weekend|upcoming weekend|weekend)\b", q_lower):
        # Python weekday: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
        if today.weekday() == 5:  # Saturday
            sat = today
            sun = today + timedelta(days=1)
        elif today.weekday() == 6:  # Sunday
            sat = today - timedelta(days=1)
            sun = today
        else:
            days_to_sat = 5 - today.weekday()
            sat = today + timedelta(days=days_to_sat)
            sun = sat + timedelta(days=1)

        return ResolvedDateRange(
            start_date=sat,
            end_date=sun,
            period_type="weekend",
            timezone=tz_name,
            description=f"Weekend ({sat.isoformat()} to {sun.isoformat()})",
        )

    # 6. Explicit ISO date patterns YYYY-MM-DD
    iso_matches = re.findall(r"\b\d{4}-\d{2}-\d{2}\b", q_lower)
    if len(iso_matches) == 1:
        d = date.fromisoformat(iso_matches[0])
        return ResolvedDateRange(
            start_date=d,
            end_date=d,
            period_type="specific_date",
            timezone=tz_name,
            description=f"Date ({d.isoformat()})",
        )
    elif len(iso_matches) >= 2:
        d1 = date.fromisoformat(iso_matches[0])
        d2 = date.fromisoformat(iso_matches[1])
        s, e = (d1, d2) if d1 <= d2 else (d2, d1)
        return ResolvedDateRange(
            start_date=s,
            end_date=e,
            period_type="specific_range",
            timezone=tz_name,
            description=f"Range ({s.isoformat()} to {e.isoformat()})",
        )

    # 7. Today / Tonight / Right now / Default
    return ResolvedDateRange(
        start_date=today,
        end_date=today,
        period_type="today" if re.search(r"\b(today|tonight)\b", q_lower) else "current",
        timezone=tz_name,
        description=f"Today ({today.isoformat()})",
    )
