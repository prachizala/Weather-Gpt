"""Schemas for historical period comparisons and climatological benchmarking."""

from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field

from backend.app.schemas.location import Location
from backend.app.schemas.weather import DatasetType


class YearComparisonRow(BaseModel):
    """Deterministic statistics for one specific year over the equivalent date window."""
    year: int = Field(..., description="Calendar year evaluated")
    period_start: str = Field(..., description="Start date of equivalent period (YYYY-MM-DD)")
    period_end: str = Field(..., description="End date of equivalent period (YYYY-MM-DD)")
    total_precipitation: float = Field(..., description="Total accumulated precipitation for the period")
    mean_daily_precipitation: float = Field(..., description="Average daily precipitation amount")
    max_daily_precipitation: float = Field(..., description="Single highest daily precipitation amount recorded")
    rainy_days: int = Field(..., description="Count of days with measurable precipitation (>= 0.1 mm)")
    mean_temperature: Optional[float] = Field(default=None, description="Average temperature across the period if requested")
    expected_days: int = Field(..., description="Total calendar days expected in this period")
    actual_days: int = Field(..., description="Actual calendar days with data")
    missing_days: int = Field(..., description="Count of missing or unrecorded days")
    coverage_pct: float = Field(..., description="Data completeness percentage (0.0 to 100.0%)")
    dataset_type: DatasetType = Field(
        default="reanalysis",
        description="Dataset provenance: observation, reanalysis, or forecast"
    )
    gaps: list[str] = Field(default_factory=list, description="List of missing dates if any gaps exist")


class ComparisonChartPoint(BaseModel):
    """Structured data point formatted for Recharts bar/line comparisons."""
    year: int = Field(..., description="Calendar year")
    label: str = Field(..., description="Chart display label (e.g. '2021', '2026 (Target)')")
    total_precipitation: float = Field(..., description="Total precipitation for this year's window")
    mean_daily_precipitation: float = Field(..., description="Mean daily precipitation")
    baseline_mean_total: float = Field(..., description="Multi-year historical baseline mean total")
    anomaly: float = Field(..., description="Difference from baseline mean (total - baseline_mean)")
    coverage_pct: float = Field(..., description="Coverage percentage")


class HistoricalComparisonResult(BaseModel):
    """Comprehensive historical weather comparison package with deterministic statistics."""
    location: Location = Field(..., description="Geographical location for the comparison")
    target_period_description: str = Field(..., description="Human-readable description of the equivalent date window")
    variable: str = Field(default="precipitation_sum", description="Primary meteorological variable compared")
    units: dict[str, str] = Field(default_factory=dict, description="Units dictionary (e.g. precipitation=mm, temperature=celsius)")
    years_compared: int = Field(..., description="Total number of years analyzed")
    baseline_years: list[int] = Field(..., description="Historical baseline years used for computing averages")
    baseline_mean_total: float = Field(..., description="Average total across baseline years computed in deterministic Python")
    table: list[YearComparisonRow] = Field(default_factory=list, description="Tabular rows per year")
    chart_data: list[ComparisonChartPoint] = Field(default_factory=list, description="Recharts-ready array of points")
    method_text: str = Field(..., description="Explicit description of methodology, aggregation formulas, and sources")
    limitations: list[str] = Field(default_factory=list, description="Scientific limitations and statistical warnings")
    dataset_disclosures: list[str] = Field(
        default_factory=list,
        description="Dataset type and provenance disclosures (ERA5 reanalysis vs. ground observations)"
    )
    retrieved_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp when the comparison was computed"
    )
