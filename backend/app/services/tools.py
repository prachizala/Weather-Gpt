"""Strict JSON schemas and execution handlers for meteorological tools."""

from __future__ import annotations
import calendar
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional
from pydantic import BaseModel, Field

from backend.app.schemas.chat import SourceRef
from backend.app.schemas.location import Location
from backend.app.services.historical_comparison import execute_historical_comparison, parse_date_input
from backend.app.services.india_alerts import get_regional_alerts_notice
from backend.app.services.providers import WeatherProvider
from backend.app.utils.date_resolver import resolve_relative_dates

# ---------------------------------------------------------------------------
# Strict JSON Tool Schemas (Compliant with Gemini / OpenAI function declaration)
# ---------------------------------------------------------------------------

WEATHER_TOOLS = [
    {
        "name": "get_current",
        "description": "Fetch real-time current weather conditions (temperature, humidity, wind, pressure, weather code) for a city or geographical location.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "City or geographical location name (e.g. 'Ahmedabad', 'London', 'Tokyo').",
                }
            },
            "required": ["location"],
        },
    },
    {
        "name": "get_forecast",
        "description": "Fetch daily summaries and hourly weather forecasts for a city or location up to 16 days ahead.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "City or geographical location name.",
                },
                "start": {
                    "type": "string",
                    "description": "Target date or relative date expression (e.g., 'tomorrow', 'this weekend', '2026-10-19').",
                },
                "end": {
                    "type": "string",
                    "description": "End date expression for multi-day ranges (optional).",
                },
            },
            "required": ["location"],
        },
    },
    {
        "name": "get_history",
        "description": "Fetch historical weather archive reanalysis records for a city or location across a past date window.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "City or geographical location name.",
                },
                "start": {
                    "type": "string",
                    "description": "Archive start date in YYYY-MM-DD format (or relative expression like 'yesterday').",
                },
                "end": {
                    "type": "string",
                    "description": "Archive end date in YYYY-MM-DD format.",
                },
            },
            "required": ["location", "start", "end"],
        },
    },
    {
        "name": "get_air_quality",
        "description": "Fetch current atmospheric air quality metrics including PM2.5, PM10, ozone, and AQI for a city or location.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "City or geographical location name.",
                }
            },
            "required": ["location"],
        },
    },
    {
        "name": "get_history_comparison",
        "description": "Compare rainfall or weather variables for equivalent calendar periods across multiple previous years (e.g., 'compare rainfall this October with previous 5 Octobers'). Returns deterministic totals, baseline averages, anomalies, table rows, and statistical limitations. All calculations are pre-computed in Python; the model only explains.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "City or geographical location name.",
                },
                "start": {
                    "type": "string",
                    "description": "Start date or expression (e.g. 'October 1', '10-01', or 'this October').",
                },
                "end": {
                    "type": "string",
                    "description": "End date or expression (e.g. 'October 18', '10-18', or end of month).",
                },
                "years_back": {
                    "type": "integer",
                    "description": "Number of previous years to compare against (default 5).",
                },
                "variable": {
                    "type": "string",
                    "description": "Variable to compare: 'precipitation_sum' or 'temperature' (default: 'precipitation_sum').",
                },
            },
            "required": ["location"],
        },
    },
    {
        "name": "search_knowledge",
        "description": "Search the meteorological knowledge base for explanatory concepts, scientific definitions, indices, and dynamics (e.g. weather vs climate, heat index, monsoons, dew point, drought, etc.). Never use for live weather values.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Scientific or explanatory meteorological question/search term.",
                }
            },
            "required": ["query"],
        },
    },
]


class ToolExecutionResult(BaseModel):
    """Encapsulates the validated outcome of a meteorological tool execution."""
    tool_name: str
    location: Optional[Location] = None
    payload: Optional[Any] = None
    valid_period: Optional[dict[str, Any]] = None
    sources: list[SourceRef] = Field(default_factory=list)
    knowledge_citations: list[SourceRef] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    error_message: Optional[str] = None
    untrusted_context_block: Optional[str] = None
    status: str = "success"  # "success", "ambiguous_location", "not_found", "unsupported_date", "insufficient_evidence", "error"


async def execute_weather_tool(
    tool_name: str,
    args: dict[str, Any],
    weather_provider: WeatherProvider,
    session_location: Optional[Location] = None,
    reference_time: Optional[datetime] = None,
    units: str = "celsius",
) -> ToolExecutionResult:
    """Execute a weather or meteorological knowledge tool."""
    now_utc = reference_time or datetime.now(timezone.utc)

    # Handle knowledge retrieval tool directly (does not require geographic location)
    if tool_name == "search_knowledge":
        query_str = str(args.get("query", "")).strip()
        from backend.app.rag.retriever import retriever

        res = retriever.search(query=query_str)
        if not res.sufficient_evidence:
            return ToolExecutionResult(
                tool_name=tool_name,
                status="insufficient_evidence",
                error_message="The knowledge base does not have enough evidence to answer this question.",
                limitations=["Insufficient evidence found in meteorological knowledge base."],
            )

        return ToolExecutionResult(
            tool_name=tool_name,
            location=None,
            payload={"query": query_str, "chunks": res.chunks},
            valid_period=None,
            sources=[],
            knowledge_citations=res.citations,
            untrusted_context_block=res.untrusted_context_block,
            limitations=["Information sourced from WeatherGPT meteorological knowledge corpus."],
            status="success",
        )

    raw_location_str = args.get("location", "").strip()

    # 1. Resolve Location
    resolved_loc: Optional[Location] = None
    limitations: list[str] = []

    # Check if session_location was already explicitly established with coordinates/location_id
    # and matches the query location name (or no raw location was provided in args)
    is_session_match = False
    if session_location is not None and session_location.coordinates:
        if not raw_location_str:
            is_session_match = True
        else:
            s_name = session_location.name.strip().lower()
            r_name = raw_location_str.strip().lower()
            if s_name == r_name or s_name in r_name or r_name in s_name:
                is_session_match = True

    if is_session_match and session_location is not None:
        resolved_loc = session_location
        # Skip name disambiguation and do NOT add the "Multiple locations matched" limitation.
    elif raw_location_str:
        geocoded = await weather_provider.geocode(raw_location_str, limit=5)
        if not geocoded:
            return ToolExecutionResult(
                tool_name=tool_name,
                status="not_found",
                error_message=f"Location '{raw_location_str}' could not be resolved by geocoding.",
                limitations=[f"No geographical match found for '{raw_location_str}'. Check city spelling."],
            )

        resolved_loc = geocoded[0]
        # Only add "Multiple locations matched" when resolved from free text and several candidates existed
        if len(geocoded) > 1:
            limitations.append(
                f"Multiple locations matched '{raw_location_str}'. Resolved to {resolved_loc.name}, {resolved_loc.admin1 or ''} {resolved_loc.country or ''}."
            )
    elif session_location is not None:
        resolved_loc = session_location
    else:
        return ToolExecutionResult(
            tool_name=tool_name,
            status="ambiguous_location",
            error_message="No location was specified in the query or existing session.",
            limitations=["Please specify a city or geographic location."],
        )

    # Check for regional authority alerts (e.g., IMD for India)
    alert_notice = get_regional_alerts_notice(
        resolved_loc.coordinates.latitude,
        resolved_loc.coordinates.longitude,
        resolved_loc.country_code,
        resolved_loc.country,
    )
    if alert_notice:
        limitations.append(alert_notice)

    now_utc = reference_time or datetime.now(timezone.utc)
    tz_name = resolved_loc.timezone or "UTC"

    # 2. Execute Specific Tool
    try:
        if tool_name == "get_current":
            snapshot = await weather_provider.get_current_weather(resolved_loc, units=units)
            source = SourceRef(
                title="Open-Meteo Current Weather",
                uri="https://api.open-meteo.com/v1/forecast",
                summary="Current surface observation.",
                provider="open-meteo",
                retrieved_at=now_utc,
                coordinates=resolved_loc.coordinates,
                timezone=tz_name,
                units=snapshot.units,
            )
            return ToolExecutionResult(
                tool_name=tool_name,
                location=resolved_loc,
                payload=snapshot,
                valid_period={"start": snapshot.timestamp.isoformat(), "end": snapshot.timestamp.isoformat()},
                sources=[source],
                limitations=limitations,
                status="success",
            )

        elif tool_name == "get_forecast":
            start_expr = str(args.get("start", "")).strip()
            date_range = resolve_relative_dates(start_expr or "tomorrow", tz_name=tz_name, reference_time=now_utc)

            # Determine forecast horizon (clamped 1 to 16 days)
            days_ahead = (date_range.end_date - date.today()).days + 1
            if days_ahead > 16:
                return ToolExecutionResult(
                    tool_name=tool_name,
                    location=resolved_loc,
                    status="unsupported_date",
                    error_message=f"Forecast requested beyond the 16-day numerical horizon ({days_ahead} days).",
                    limitations=["Forecasts are limited to a maximum horizon of 16 days."],
                )

            forecast_data = await weather_provider.get_forecast(
                resolved_loc, days=max(7, min(days_ahead + 1, 16)), units=units
            )
            source = SourceRef(
                title="Open-Meteo Weather Forecast",
                uri="https://api.open-meteo.com/v1/forecast",
                summary="7-16 day high-resolution forecast models.",
                provider="open-meteo",
                retrieved_at=now_utc,
                coordinates=resolved_loc.coordinates,
                timezone=tz_name,
                units=forecast_data.daily[0].units if forecast_data.daily else {},
            )
            return ToolExecutionResult(
                tool_name=tool_name,
                location=resolved_loc,
                payload=forecast_data,
                valid_period={
                    "start": date_range.start_date.isoformat(),
                    "end": date_range.end_date.isoformat(),
                    "description": date_range.description,
                },
                sources=[source],
                limitations=limitations,
                status="success",
            )

        elif tool_name == "get_history":
            start_expr = str(args.get("start", "")).strip()
            end_expr = str(args.get("end", "")).strip()
            start_resolved = resolve_relative_dates(start_expr or "yesterday", tz_name=tz_name, reference_time=now_utc)
            end_resolved = resolve_relative_dates(end_expr or start_expr or "yesterday", tz_name=tz_name, reference_time=now_utc)

            s_date = start_resolved.start_date
            e_date = end_resolved.end_date
            if s_date > e_date:
                s_date, e_date = e_date, s_date

            today_date = now_utc.astimezone(resolved_loc.timezone if resolved_loc.timezone else timezone.utc).date()
            if s_date > today_date:
                return ToolExecutionResult(
                    tool_name=tool_name,
                    location=resolved_loc,
                    status="unsupported_date",
                    error_message=f"Historical record cannot be in the future: start_date={s_date}.",
                    limitations=["Historical archive requests cannot query future dates."],
                )

            records = await weather_provider.get_historical_weather(
                resolved_loc, start_date=s_date, end_date=e_date, units=units
            )
            source = SourceRef(
                title="Open-Meteo Historical Archive",
                uri="https://archive-api.open-meteo.com/v1/archive",
                summary="ERA5/CERRA reanalysis datasets.",
                provider="open-meteo",
                retrieved_at=now_utc,
                coordinates=resolved_loc.coordinates,
                timezone=tz_name,
                units=records[0].units if records else {},
            )
            return ToolExecutionResult(
                tool_name=tool_name,
                location=resolved_loc,
                payload=records,
                valid_period={"start": s_date.isoformat(), "end": e_date.isoformat()},
                sources=[source],
                limitations=limitations,
                status="success",
            )

        elif tool_name == "get_air_quality":
            aqi = await weather_provider.get_air_quality(resolved_loc)
            source = SourceRef(
                title="Open-Meteo Air Quality",
                uri="https://air-quality-api.open-meteo.com/v1/air-quality",
                summary="Atmospheric pollution and European/US AQI indices.",
                provider="open-meteo",
                retrieved_at=now_utc,
                coordinates=resolved_loc.coordinates,
                timezone=tz_name,
                units=aqi.units,
            )
            return ToolExecutionResult(
                tool_name=tool_name,
                location=resolved_loc,
                payload=aqi,
                valid_period={"start": aqi.timestamp.isoformat(), "end": aqi.timestamp.isoformat()},
                sources=[source],
                limitations=limitations,
                status="success",
            )

        elif tool_name == "get_history_comparison":
            raw_start = str(args.get("start") or "").strip()
            raw_end = str(args.get("end") or "").strip()
            years_back = int(args.get("years_back") or 5)
            variable = str(args.get("variable") or "precipitation_sum").strip()

            # Resolve start and end if relative or month names
            now_loc = now_utc.astimezone(loc_tz)
            cur_year = now_loc.year
            cur_month = now_loc.month

            s_date = None
            e_date = None

            # Handle explicit month names (e.g. "October", "this October")
            lower_msg = f"{raw_start} {raw_end}".lower()
            months = {
                "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
                "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
            }
            matched_month = None
            for m_name, m_num in months.items():
                if m_name in lower_msg:
                    matched_month = m_num
                    break

            if matched_month:
                target_month = matched_month
                s_date = date(cur_year, target_month, 1)
                if target_month == cur_month:
                    e_date = now_loc.date()
                else:
                    max_d = calendar.monthrange(cur_year, target_month)[1]
                    e_date = date(cur_year, target_month, max_d)
            else:
                if raw_start:
                    resolved_range = resolve_relative_dates(raw_start, raw_end, tz_name, reference_time=now_utc)
                    if resolved_range.is_relative and resolved_range.resolved_start:
                        s_date = resolved_range.resolved_start.date()
                        e_date = resolved_range.resolved_end.date() if resolved_range.resolved_end else s_date
                    else:
                        try:
                            s_date = parse_date_input(raw_start)
                            e_date = parse_date_input(raw_end) if raw_end else s_date
                        except Exception:
                            s_date = date(cur_year, cur_month, 1)
                            e_date = now_loc.date()
                else:
                    s_date = date(cur_year, cur_month, 1)
                    e_date = now_loc.date()

            comp_result = await execute_historical_comparison(
                weather_provider=weather_provider,
                location=resolved_loc,
                start_date=s_date,
                end_date=e_date,
                years_back=years_back,
                variable=variable,
                units=units,
            )

            source = SourceRef(
                title="Open-Meteo Historical Archive",
                uri="https://archive-api.open-meteo.com/v1/archive",
                summary=f"Multi-year ERA5 reanalysis comparison ({comp_result.years_compared} years).",
                provider="open-meteo",
                retrieved_at=now_utc,
                coordinates=resolved_loc.coordinates,
                timezone=tz_name,
                units=comp_result.units,
            )
            v_start = comp_result.table[0].period_start if comp_result.table else s_date.isoformat()
            v_end = comp_result.table[-1].period_end if comp_result.table else e_date.isoformat()
            return ToolExecutionResult(
                tool_name=tool_name,
                location=resolved_loc,
                payload=comp_result,
                valid_period={"start": v_start, "end": v_end},
                sources=[source],
                limitations=limitations + comp_result.limitations,
                status="success",
            )

        else:
            return ToolExecutionResult(
                tool_name=tool_name,
                status="error",
                error_message=f"Unrecognized tool '{tool_name}'.",
                limitations=[f"Tool '{tool_name}' is not supported."],
            )

    except Exception as e:
        return ToolExecutionResult(
            tool_name=tool_name,
            location=resolved_loc,
            status="error",
            error_message=f"Provider error while executing '{tool_name}': {e}",
            limitations=[f"Upstream provider failure: {e}"],
        )
