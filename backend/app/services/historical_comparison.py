"""Deterministic historical weather comparison module.

Calculates multi-year equivalent period statistics, coverage, missing days,
baselines, and anomalies in pure Python.
Enforces strict period comparability and transparent dataset/limitations disclosure.
The LLM only explains; all mathematics and aggregations are computed here.
"""

from __future__ import annotations
import calendar
from datetime import date, datetime, timedelta, timezone
import logging
from typing import Optional, Union

from backend.app.schemas.base import Coordinates
from backend.app.schemas.comparison import (
    ComparisonChartPoint,
    HistoricalComparisonResult,
    YearComparisonRow,
)
from backend.app.schemas.location import Location
from backend.app.schemas.weather import HistoricalRecord
from backend.app.services.exceptions import UpstreamDataError
from backend.app.services.providers import WeatherProvider

logger = logging.getLogger(__name__)


class PeriodMisalignmentError(ValueError):
    """Raised when date periods cannot be compared fairly or have mismatched duration."""
    pass


def parse_date_input(val: Union[str, date, datetime]) -> date:
    """Parse flexible date input into a datetime.date instance."""
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    s = str(val).strip()
    # Support YYYY-MM-DD
    if len(s) == 10 and s[4] == "-" and s[7] == "-":
        return date.fromisoformat(s)
    # Support MM-DD with current year
    if len(s) == 5 and s[2] == "-":
        return date(datetime.now().year, int(s[:2]), int(s[3:]))
    raise ValueError(f"Invalid date format '{val}'. Expected YYYY-MM-DD or MM-DD.")


def build_equivalent_date_ranges(
    start_date: Union[str, date, datetime],
    end_date: Union[str, date, datetime],
    years_back: int = 5,
    target_year: Optional[int] = None,
) -> list[tuple[int, date, date]]:
    """Construct strictly comparable equivalent date ranges across historical years.
    
    Returns list of (year, period_start, period_end) sorted chronologically.
    Raises PeriodMisalignmentError if start_date > end_date or period alignment is invalid.
    """
    s_date = parse_date_input(start_date)
    e_date = parse_date_input(end_date)

    if s_date > e_date:
        raise PeriodMisalignmentError(
            f"Start date ({s_date}) cannot be after end date ({e_date})."
        )

    t_year = target_year or s_date.year
    ref_duration = (e_date - s_date).days + 1

    ranges: list[tuple[int, date, date]] = []
    start_year = t_year - years_back

    for y in range(start_year, t_year + 1):
        # Determine equivalent month/day for start and end
        s_m, s_d = s_date.month, s_date.day
        e_m, e_d = e_date.month, e_date.day

        # Handle leap year adjustments
        s_max_days = calendar.monthrange(y, s_m)[1]
        e_max_days = calendar.monthrange(y, e_m)[1]

        adj_s_d = min(s_d, s_max_days)
        adj_e_d = min(e_d, e_max_days)

        year_start = date(y, s_m, adj_s_d)
        year_end = date(y, e_m, adj_e_d)

        # Enforce comparable duration
        cur_duration = (year_end - year_start).days + 1
        if cur_duration != ref_duration:
            # If minor leap-day shift on Feb, adjust year_end to preserve duration
            year_end = year_start + timedelta(days=ref_duration - 1)

        ranges.append((y, year_start, year_end))

    return ranges


def compute_period_statistics(
    year: int,
    start_date: date,
    end_date: date,
    records: list[HistoricalRecord],
) -> YearComparisonRow:
    """Aggregate hourly historical records into deterministic daily and period totals."""
    expected_days_count = (end_date - start_date).days + 1
    expected_dates = {start_date + timedelta(days=i) for i in range(expected_days_count)}

    # Group records by calendar date
    day_precip: dict[date, float] = {}
    day_temps: dict[date, list[float]] = {}

    for rec in records:
        rec_date = rec.timestamp.date()
        if start_date <= rec_date <= end_date:
            # Sum precipitation for the day
            day_precip[rec_date] = day_precip.get(rec_date, 0.0) + (rec_recip := rec.precipitation or 0.0)
            if rec.temperature is not None:
                day_temps.setdefault(rec_date, []).append(rec.temperature)

    actual_dates = set(day_precip.keys())
    missing_dates = sorted(list(expected_dates - actual_dates))

    actual_days_count = len(actual_dates)
    missing_days_count = len(missing_dates)
    coverage_pct = (
        round((actual_days_count / expected_days_count) * 100.0, 1)
        if expected_days_count > 0
        else 0.0
    )

    total_precipitation = round(sum(day_precip.values()), 2)
    mean_daily_precip = (
        round(total_precipitation / actual_days_count, 2)
        if actual_days_count > 0
        else 0.0
    )
    max_daily_precip = (
        round(max(day_precip.values()), 2)
        if day_precip
        else 0.0
    )
    rainy_days = sum(1 for p in day_precip.values() if p >= 0.1)

    all_temps = [t for temps in day_temps.values() for t in temps]
    mean_temperature = (
        round(sum(all_temps) / len(all_temps), 1)
        if all_temps
        else None
    )

    return YearComparisonRow(
        year=year,
        period_start=start_date.isoformat(),
        period_end=end_date.isoformat(),
        total_precipitation=total_precipitation,
        mean_daily_precipitation=mean_daily_precip,
        max_daily_precipitation=max_daily_precip,
        rainy_days=rainy_days,
        mean_temperature=mean_temperature,
        expected_days=expected_days_count,
        actual_days=actual_days_count,
        missing_days=missing_days_count,
        coverage_pct=coverage_pct,
        dataset_type="reanalysis",
        gaps=[d.isoformat() for d in missing_dates],
    )


async def execute_historical_comparison(
    weather_provider: WeatherProvider,
    location: Location,
    start_date: Union[str, date, datetime],
    end_date: Union[str, date, datetime],
    years_back: int = 5,
    variable: str = "precipitation_sum",
    units: str = "celsius",
) -> HistoricalComparisonResult:
    """Execute end-to-end historical comparison across equivalent yearly date windows."""
    s_date = parse_date_input(start_date)
    e_date = parse_date_input(end_date)
    target_year = e_date.year

    # 1. Build strictly comparable date windows
    yearly_ranges = build_equivalent_date_ranges(
        start_date=s_date,
        end_date=e_date,
        years_back=years_back,
        target_year=target_year,
    )

    table_rows: list[YearComparisonRow] = []

    # 2. Fetch and calculate statistics for each year
    for year, y_start, y_end in yearly_ranges:
        try:
            records = await weather_provider.get_historical_weather(
                location=location,
                start_date=y_start,
                end_date=y_end,
                units=units,
            )
        except Exception as e:
            logger.warning("Failed to retrieve historical weather for %s (%s to %s): %s", year, y_start, y_end, e)
            records = []

        row = compute_period_statistics(
            year=year,
            start_date=y_start,
            end_date=y_end,
            records=records,
        )
        table_rows.append(row)

    # 3. Compute baseline statistics over previous baseline years (excluding target year)
    baseline_years = [r.year for r in table_rows if r.year < target_year]
    baseline_rows = [r for r in table_rows if r.year in baseline_years]

    if baseline_rows:
        baseline_totals = [r.total_precipitation for r in baseline_rows]
        baseline_mean_total = round(sum(baseline_totals) / len(baseline_totals), 2)
    else:
        baseline_mean_total = 0.0

    # 4. Generate structured chart data points
    chart_data: list[ComparisonChartPoint] = []
    for r in table_rows:
        is_target = (r.year == target_year)
        label = f"{r.year} (Target)" if is_target else str(r.year)
        anomaly = round(r.total_precipitation - baseline_mean_total, 2)
        chart_data.append(
            ComparisonChartPoint(
                year=r.year,
                label=label,
                total_precipitation=r.total_precipitation,
                mean_daily_precipitation=r.mean_daily_precipitation,
                baseline_mean_total=baseline_mean_total,
                anomaly=anomaly,
                coverage_pct=r.coverage_pct,
            )
        )

    # 5. Method Description
    month_name = s_date.strftime("%B")
    period_desc = f"{month_name} {s_date.day} – {e_date.day} ({yearly_ranges[0][0]}–{target_year})"
    method_text = (
        f"Deterministic Python aggregation: Calculated accumulated daily precipitation and statistics across equivalent "
        f"calendar dates ({s_date.strftime('%m-%d')} to {e_date.strftime('%m-%d')}) for {len(table_rows)} consecutive years. "
        f"The {len(baseline_years)}-year baseline mean ({baseline_mean_total:.1f} mm) represents the arithmetic average of "
        f"baseline years ({min(baseline_years) if baseline_years else 0}–{max(baseline_years) if baseline_years else 0}). "
        f"Rainy days are defined as calendar days with measurable precipitation >= 0.1 mm."
    )

    # 6. Disclosures & Limitations
    limitations = [
        f"Small sample size ({len(table_rows)} years) is statistically insufficient to infer long-term climate trends or attribute anthropogenic climate changes.",
        "Official climatological normals require 30-year reference periods defined by the World Meteorological Organization (WMO).",
        "Open-Meteo historical records are derived from ECMWF ERA5 atmospheric reanalysis rather than local rain gauge stations, which may show localized variance.",
    ]

    # Report coverage gaps if any exist
    gap_years = [r for r in table_rows if r.missing_days > 0]
    if gap_years:
        for gy in gap_years:
            limitations.append(
                f"Data gap in {gy.year}: {gy.missing_days} missing day(s) ({gy.coverage_pct}% coverage). Gaps: {', '.join(gy.gaps[:5])}"
            )

    dataset_disclosures = [
        "Dataset Type: Atmospheric Reanalysis (ECMWF ERA5 / ERA5-Land)",
        f"Coverage: {sum(r.actual_days for r in table_rows)}/{sum(r.expected_days for r in table_rows)} total calendar days evaluated",
        f"Provider: Open-Meteo Historical Archive API (Non-commercial open-access tier)",
    ]

    units_dict = {
        "precipitation": "inch" if "fahrenheit" in units.lower() or "imperial" in units.lower() else "mm",
        "temperature": "fahrenheit" if "fahrenheit" in units.lower() or "imperial" in units.lower() else "celsius",
    }

    return HistoricalComparisonResult(
        location=location,
        target_period_description=period_desc,
        variable=variable,
        units=units_dict,
        years_compared=len(table_rows),
        baseline_years=baseline_years,
        baseline_mean_total=baseline_mean_total,
        table=table_rows,
        chart_data=chart_data,
        method_text=method_text,
        limitations=limitations,
        dataset_disclosures=dataset_disclosures,
        retrieved_at=datetime.now(timezone.utc),
    )
