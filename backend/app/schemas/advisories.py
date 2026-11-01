"""Schemas for rule-based meteorological and air quality advisories."""

from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field

from backend.app.schemas.location import Location

AdvisorySeverity = Literal["info", "moderate", "warning", "danger"]


class AdvisoryItem(BaseModel):
    """An individual active advisory triggered by deterministic rule evaluation."""
    rule_id: str = Field(..., description="Unique rule identifier")
    title: str = Field(..., description="Human-readable advisory title")
    severity: AdvisorySeverity = Field(..., description="Severity level: info, moderate, warning, danger")
    category: str = Field(..., description="Category: precipitation, temperature, wind, air_quality, uv")
    triggered_by: dict[str, Any] = Field(
        ...,
        description="Exact values, thresholds, and comparison operator that triggered this advisory"
    )
    explanation: str = Field(..., description="Factual explanation of the conditions prompting the advisory")


class SkippedRule(BaseModel):
    """Rule skipped due to missing variables in input meteorological data."""
    rule_id: str = Field(..., description="Unique rule identifier")
    title: str = Field(..., description="Human-readable advisory title")
    reason: str = Field(..., description="Explanation of why the rule was skipped")
    missing_variables: list[str] = Field(
        default_factory=list,
        description="List of required variables not found in the input payload"
    )


class AdvisoriesReport(BaseModel):
    """Complete advisory evaluation report for a given location and time."""
    advisories: list[AdvisoryItem] = Field(
        default_factory=list,
        description="List of active triggered advisories"
    )
    skipped_rules: list[SkippedRule] = Field(
        default_factory=list,
        description="List of rules skipped due to missing variables (never guessed)"
    )
    disclaimer: str = Field(
        default="App suggestion, not an official warning",
        description="Mandatory disclaimer distinguishing algorithmic suggestions from official government alerts"
    )
    official_alerts_link: str = Field(
        default="https://mausam.imd.gov.in",
        description="Official India Meteorological Department (IMD) warning portal"
    )
    evaluated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC timestamp when advisories were evaluated"
    )
    location: Optional[Location] = Field(default=None, description="Location context for the advisories")
