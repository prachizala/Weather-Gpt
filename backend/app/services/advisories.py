"""Deterministic, rule-based meteorological advisory engine.

All advisory decisions are strictly driven by configurable rules (YAML/JSON).
Missing variables are skipped with an explicit note, NEVER guessed or fabricated.
All advisories are clearly distinguished from official government warnings.
"""

from __future__ import annotations
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
import yaml

from backend.app.schemas.advisories import AdvisoriesReport, AdvisoryItem, SkippedRule
from backend.app.schemas.location import Location
from backend.app.schemas.weather import AirQuality, ForecastData, WeatherSnapshot

logger = logging.getLogger(__name__)

DEFAULT_RULES_PATH = Path(__file__).resolve().parent.parent / "data" / "advisory_rules.yaml"


class AdvisoryEngine:
    """Configurable rule evaluator for weather and air-quality safety suggestions."""

    def __init__(self, rules_path: Optional[Path | str] = None) -> None:
        self.rules_path = Path(rules_path) if rules_path else DEFAULT_RULES_PATH
        self.rules: list[dict[str, Any]] = self._load_rules()

    def _load_rules(self) -> list[dict[str, Any]]:
        """Load rules from YAML configuration file."""
        if not self.rules_path.exists():
            logger.warning("Advisory rules file not found at %s. Using built-in fallback rules.", self.rules_path)
            return self._builtin_fallback_rules()

        try:
            with open(self.rules_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
                return data.get("rules", []) if isinstance(data, dict) else []
        except Exception as e:
            logger.error("Failed to load advisory rules from %s: %s", self.rules_path, e)
            return self._builtin_fallback_rules()

    def _builtin_fallback_rules(self) -> list[dict[str, Any]]:
        return [
            {
                "id": "umbrella_rain",
                "title": "Carry an Umbrella",
                "severity": "moderate",
                "category": "precipitation",
                "required_variables": ["precipitation_probability_max", "precipitation", "precipitation_sum", "weather_code"],
                "conditions": {
                    "any_of": [
                        {"field": "precipitation_probability_max", "operator": ">=", "threshold": 40.0, "units": "%"},
                        {"field": "precipitation", "operator": ">=", "threshold": 1.0, "units": "mm"},
                        {"field": "precipitation_sum", "operator": ">=", "threshold": 1.0, "units": "mm"},
                        {"field": "weather_code", "operator": "in", "values": [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99]},
                    ]
                },
                "template": "Precipitation risk detected: {trigger_field} is {trigger_value}. Rain gear or an umbrella is advised.",
            },
            {
                "id": "heat_caution",
                "title": "Extreme Heat Caution",
                "severity": "warning",
                "category": "temperature",
                "required_variables": ["apparent_temperature", "apparent_temperature_max", "temperature"],
                "conditions": {
                    "any_of": [
                        {"field": "apparent_temperature", "operator": ">=", "threshold": 40.0, "units": "°C"},
                        {"field": "apparent_temperature_max", "operator": ">=", "threshold": 40.0, "units": "°C"},
                        {"field": "temperature", "operator": ">=", "threshold": 40.0, "units": "°C"},
                    ]
                },
                "template": "Heat threshold exceeded: {trigger_field} reaches {trigger_value}°C. Stay hydrated and minimize direct sun exposure.",
            },
            {
                "id": "strong_wind",
                "title": "High Wind Advisory",
                "severity": "moderate",
                "category": "wind",
                "required_variables": ["wind_speed", "wind_speed_max"],
                "conditions": {
                    "any_of": [
                        {"field": "wind_speed", "operator": ">=", "threshold": 35.0, "units": "km/h"},
                        {"field": "wind_speed_max", "operator": ">=", "threshold": 35.0, "units": "km/h"},
                    ]
                },
                "template": "Elevated winds: {trigger_field} reaches {trigger_value} km/h. Secure loose outdoor objects and exercise caution.",
            },
            {
                "id": "poor_air_quality",
                "title": "Unhealthy Air Quality Advisory",
                "severity": "warning",
                "category": "air_quality",
                "required_variables": ["aqi", "pm2_5"],
                "conditions": {
                    "any_of": [
                        {"field": "aqi", "operator": ">=", "threshold": 101.0, "units": "AQI"},
                        {"field": "pm2_5", "operator": ">=", "threshold": 35.5, "units": "µg/m³"},
                    ]
                },
                "template": "Air quality concern: {trigger_field} is {trigger_value}. Sensitive individuals should limit outdoor exertion.",
            },
        ]

    def _extract_context(
        self,
        current: Optional[WeatherSnapshot],
        forecast: Optional[ForecastData],
        air_quality: Optional[AirQuality],
    ) -> dict[str, Any]:
        """Aggregate available meteorological variables into an evaluation lookup dictionary."""
        ctx: dict[str, Any] = {}

        if current:
            ctx["temperature"] = current.temperature
            ctx["apparent_temperature"] = current.apparent_temperature
            ctx["precipitation"] = current.precipitation
            ctx["relative_humidity"] = current.relative_humidity
            ctx["wind_speed"] = current.wind_speed
            ctx["weather_code"] = current.weather_code
            ctx["surface_pressure"] = current.surface_pressure

        if forecast and forecast.daily:
            today_daily = forecast.daily[0]
            ctx["temperature_max"] = today_daily.temperature_max
            ctx["temperature_min"] = today_daily.temperature_min
            ctx["apparent_temperature_max"] = today_daily.apparent_temperature_max
            ctx["apparent_temperature_min"] = today_daily.apparent_temperature_min
            ctx["precipitation_sum"] = today_daily.precipitation_sum
            ctx["precipitation_probability_max"] = today_daily.precipitation_probability_max
            ctx["wind_speed_max"] = today_daily.wind_speed_max
            ctx["uv_index_max"] = today_daily.uv_index_max
            if "weather_code" not in ctx or ctx["weather_code"] is None:
                ctx["weather_code"] = today_daily.weather_code

        if air_quality:
            ctx["aqi"] = air_quality.aqi
            ctx["pm2_5"] = air_quality.pm2_5
            ctx["pm10"] = air_quality.pm10
            ctx["ozone"] = air_quality.ozone
            ctx["uv_index"] = air_quality.uv_index
            ctx["nitrogen_dioxide"] = air_quality.nitrogen_dioxide
            ctx["sulphur_dioxide"] = air_quality.sulphur_dioxide

        return ctx

    def evaluate(
        self,
        current: Optional[WeatherSnapshot] = None,
        forecast: Optional[ForecastData] = None,
        air_quality: Optional[AirQuality] = None,
        location: Optional[Location] = None,
    ) -> AdvisoriesReport:
        """Evaluate all configured rules against input data.
        
        Rules with missing required variables are safely skipped with an explanation note.
        """
        context = self._extract_context(current, forecast, air_quality)
        active_advisories: list[AdvisoryItem] = []
        skipped_rules: list[SkippedRule] = []

        for rule in self.rules:
            rule_id = rule.get("id", "unknown_rule")
            title = rule.get("title", "Weather Advisory")
            severity = rule.get("severity", "info")
            category = rule.get("category", "general")
            template = rule.get("template", "{title}: Active advisory.")
            required_vars = rule.get("required_variables", [])

            # Check if ANY of the required variables exist with a non-None value
            present_vars = [var for var in required_vars if context.get(var) is not None]

            if not present_vars:
                # Strictly skip rule when variables are missing; NEVER guess or hallucinate
                missing_vars = [v for v in required_vars if context.get(v) is None]
                skipped_rules.append(
                    SkippedRule(
                        rule_id=rule_id,
                        title=title,
                        reason=f"Missing required meteorological variable(s): {', '.join(missing_vars)}",
                        missing_variables=missing_vars,
                    )
                )
                continue

            # Evaluate conditions
            conditions_block = rule.get("conditions", {})
            any_of = conditions_block.get("any_of", [])

            matched_trigger: Optional[dict[str, Any]] = None

            for cond in any_of:
                field = cond.get("field")
                op = cond.get("operator")
                val = context.get(field)

                if val is None:
                    continue

                is_triggered = False
                if op == ">=":
                    threshold = cond.get("threshold", 0.0)
                    if val >= threshold:
                        is_triggered = True
                elif op == ">":
                    threshold = cond.get("threshold", 0.0)
                    if val > threshold:
                        is_triggered = True
                elif op == "<=":
                    threshold = cond.get("threshold", 0.0)
                    if val <= threshold:
                        is_triggered = True
                elif op == "<":
                    threshold = cond.get("threshold", 0.0)
                    if val < threshold:
                        is_triggered = True
                elif op == "in":
                    allowed_values = cond.get("values", [])
                    if val in allowed_values:
                        is_triggered = True

                if is_triggered:
                    matched_trigger = {
                        "field": field,
                        "value": val,
                        "threshold": cond.get("threshold"),
                        "values": cond.get("values"),
                        "operator": op,
                        "units": cond.get("units", ""),
                    }
                    break

            if matched_trigger:
                t_field = matched_trigger["field"]
                t_val = matched_trigger["value"]
                formatted_val = f"{t_val:.1f}" if isinstance(t_val, float) else str(t_val)

                # Format explanation safely using triggering variable and value
                format_ctx = {
                    "title": title,
                    "rule_id": rule_id,
                    "trigger_field": t_field,
                    "trigger_value": formatted_val,
                    # Ensure the triggered field key is populated with the triggering value
                    t_field: formatted_val,
                }
                # Also supply other context keys only if referenced, but default to trigger_value if missing
                for k, v in context.items():
                    if k not in format_ctx and v is not None:
                        format_ctx[k] = f"{v:.1f}" if isinstance(v, float) else str(v)

                try:
                    explanation = template.format(**format_ctx)
                except KeyError:
                    unit_str = f" {matched_trigger['units']}" if matched_trigger.get("units") else ""
                    explanation = f"{title}: Condition met on {t_field} = {formatted_val}{unit_str}."

                active_advisories.append(
                    AdvisoryItem(
                        rule_id=rule_id,
                        title=title,
                        severity=severity,
                        category=category,
                        triggered_by=matched_trigger,
                        explanation=explanation,
                    )
                )

        return AdvisoriesReport(
            advisories=active_advisories,
            skipped_rules=skipped_rules,
            disclaimer="App suggestion, not an official warning",
            official_alerts_link="https://mausam.imd.gov.in",
            evaluated_at=datetime.now(timezone.utc),
            location=location,
        )


# Global default instance
advisory_engine = AdvisoryEngine()
