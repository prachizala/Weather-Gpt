"""Number verification layer ensuring model-generated text contains only verified payload numbers."""

from __future__ import annotations
import math
import re
from datetime import date, datetime
from typing import Any, Optional, Set
from pydantic import BaseModel

from backend.app.schemas.comparison import HistoricalComparisonResult
from backend.app.schemas.location import Location
from backend.app.schemas.weather import (
    AirQuality,
    DailyForecast,
    ForecastData,
    HistoricalRecord,
    WeatherSnapshot,
)


DEVANAGARI_DIGITS = "०१२३४५६७८९"
GUJARATI_DIGITS = "૦૧૨૩૪૫૬૭૮૯"
ASCII_DIGITS = "0123456789"

_INDIC_DIGIT_MAP = str.maketrans(
    DEVANAGARI_DIGITS + GUJARATI_DIGITS,
    ASCII_DIGITS + ASCII_DIGITS
)


def normalize_indic_digits(text: str) -> str:
    """Normalize Devanagari (Hindi) and Gujarati numerals to standard ASCII digits."""
    if not text:
        return ""
    return text.translate(_INDIC_DIGIT_MAP)


def extract_numbers_from_text(text: str) -> list[float]:
    """Extract all numeric quantities from a text response string, normalizing Indic digits first."""
    normalized = normalize_indic_digits(text)
    # Matches integers and decimals, including negative numbers
    pattern = r"(?<![a-zA-Z0-9_])-?\d+(?:\.\d+)?"
    matches = re.findall(pattern, normalized)
    numbers: list[float] = []
    for m in matches:
        try:
            val = float(m)
            numbers.append(val)
        except ValueError:
            continue
    return numbers


def _generate_unit_conversions(val: float, var_type: Optional[str] = None) -> set[float]:
    """Generate expected unit conversion and rounding variations for a number."""
    variants: set[float] = {
        val,
        float(round(val)),
        float(math.floor(val)),
        float(math.ceil(val)),
        round(val, 1),
        round(val, 2),
    }

    # Temperature conversions (Celsius <-> Fahrenheit)
    # Assume temperatures within reasonable atmospheric ranges (-50 to 60 °C or -58 to 140 °F)
    if var_type == "temp" or (-50 <= val <= 140):
        # Celsius to Fahrenheit
        f_val = (val * 9.0 / 5.0) + 32.0
        variants.update({f_val, float(round(f_val)), round(f_val, 1)})
        # Fahrenheit to Celsius
        c_val = (val - 32.0) * 5.0 / 9.0
        variants.update({c_val, float(round(c_val)), round(c_val, 1)})

    # Wind speed conversions (km/h <-> mph <-> m/s)
    if var_type == "wind" or (0 <= val <= 250):
        # km/h to mph
        mph = val * 0.621371
        variants.update({mph, float(round(mph)), round(mph, 1)})
        # km/h to m/s
        ms = val / 3.6
        variants.update({ms, float(round(ms)), round(ms, 1)})

    # Precipitation conversions (mm <-> inches)
    if var_type == "precip" or (0 <= val <= 500):
        inch = val / 25.4
        variants.update({inch, round(inch, 1), round(inch, 2)})

    return variants


def extract_payload_numbers(payload: Any, valid_period: Optional[dict[str, Any]] = None) -> set[float]:
    """Extract all allowable numbers from the payload, including unit conversions and roundings."""
    allowed: set[float] = set()

    # Always allow numbers derived from valid_period dates
    if valid_period:
        for k in ["start", "end", "description"]:
            v = valid_period.get(k)
            if v and isinstance(v, str):
                for num in extract_numbers_from_text(v):
                    allowed.update(_generate_unit_conversions(num))

    # Allow current year, common forecast counts
    current_year = float(datetime.now().year)
    allowed.update({current_year, 1.0, 7.0, 10.0, 14.0, 16.0, 24.0, 0.0})

    def _walk(obj: Any, key_name: str = ""):
        if isinstance(obj, BaseModel):
            _walk(obj.model_dump(), key_name)
        elif isinstance(obj, dict):
            for k, v in obj.items():
                _walk(v, k)
        elif isinstance(obj, list):
            for item in obj:
                _walk(item, key_name)
        elif isinstance(obj, (int, float)):
            f_val = float(obj)
            var_hint = None
            if "temp" in key_name.lower():
                var_hint = "temp"
            elif "wind" in key_name.lower():
                var_hint = "wind"
            elif "precip" in key_name.lower():
                var_hint = "precip"
            allowed.update(_generate_unit_conversions(f_val, var_hint))
        elif isinstance(obj, (datetime, date)):
            allowed.update({float(obj.year), float(obj.month), float(obj.day)})
            if isinstance(obj, datetime):
                allowed.update({float(obj.hour), float(obj.minute)})
        elif isinstance(obj, str):
            # Parse ISO date strings inside payloads
            if re.match(r"^\d{4}-\d{2}-\d{2}", obj):
                for num in extract_numbers_from_text(obj):
                    allowed.update(_generate_unit_conversions(num))

    if payload is not None:
        _walk(payload)

    return allowed


def verify_numbers(
    answer: str,
    payload: Any,
    valid_period: Optional[dict[str, Any]] = None,
    tolerance: float = 0.6,
) -> tuple[bool, list[float]]:
    """Verify that every number in the answer corresponds to a valid number in the payload."""
    answer_numbers = extract_numbers_from_text(answer)
    if not answer_numbers:
        return True, []

    allowed_numbers = extract_payload_numbers(payload, valid_period)
    unmatched: list[float] = []

    for num in answer_numbers:
        # Check for direct or close match within tolerance (for float rounding)
        matched = False
        for allowed in allowed_numbers:
            if math.isclose(num, allowed, abs_tol=tolerance):
                matched = True
                break
        if not matched:
            unmatched.append(num)

    return (len(unmatched) == 0, unmatched)


def build_deterministic_answer(
    intent: str,
    location: Location,
    payload: Any,
    valid_period: Optional[dict[str, Any]] = None,
    language: str = "en",
) -> str:
    """Build a deterministic, guaranteed fact-accurate explanation directly from the verified payload."""
    loc_name = location.name

    # 1. Forecast Payload
    if isinstance(payload, ForecastData) or intent == "forecast":
        forecast = payload if isinstance(payload, ForecastData) else None
        if forecast and forecast.daily:
            target_str = valid_period.get("start") if valid_period else None
            daily_match = forecast.daily[0]
            if target_str:
                for d in forecast.daily:
                    if d.date == target_str:
                        daily_match = d
                        break

            t_max = daily_match.temperature_max
            t_min = daily_match.temperature_min
            precip = daily_match.precipitation_sum or 0.0
            prob = daily_match.precipitation_probability_max or 0.0
            wind = daily_match.wind_speed_max or 0.0

            if language == "hi":
                rain_text = (
                    f"बारिश की संभावना {prob:.0f}% है और {precip:.1f} मिमी वर्षा अपेक्षित है।"
                    if (precip > 0.5 or prob >= 40.0)
                    else f"बारिश की कोई महत्वपूर्ण संभावना नहीं है ({prob:.0f}% संभावना, {precip:.1f} मिमी)।"
                )
                return (
                    f"{loc_name} में {daily_match.date} के लिए मौसम पूर्वानुमान: "
                    f"अधिकतम तापमान {t_max:.1f}°C और न्यूनतम तापमान {t_min:.1f}°C रहेगा। "
                    f"{rain_text} अधिकतम हवा की गति {wind:.1f} किमी/घंटा तक पहुंचेगी।"
                )
            elif language == "gu":
                rain_text = (
                    f"વરસાદની સંભાવના {prob:.0f}% છે અને {precip:.1f} મીમી વરસાદ અપેક્ષિત છે."
                    if (precip > 0.5 or prob >= 40.0)
                    else f"કોઈ નોંધપાત્ર વરસાદની અપેક્ષા નથી ({prob:.0f}% સંભાવના, {precip:.1f} મીમી)."
                )
                return (
                    f"{loc_name} માટે {daily_match.date} ના રોજ હવામાન આગાહી: "
                    f"મહત્તમ તાપમાન {t_max:.1f}°C અને લઘુત્તમ તાપમાન {t_min:.1f}°C રહેશે. "
                    f"{rain_text} મહત્તમ પવનની ઝડપ {wind:.1f} કિમી/કલાક રહેશે."
                )
            else:
                rain_assessment = (
                    f"Rain is likely with a {prob:.0f}% chance and {precip:.1f} mm expected."
                    if (precip > 0.5 or prob >= 40.0)
                    else f"No significant rain is expected with a {prob:.0f}% chance and {precip:.1f} mm precipitation."
                )
                return (
                    f"Weather forecast for {loc_name} on {daily_match.date}: "
                    f"Maximum temperature of {t_max:.1f}°C and minimum temperature of {t_min:.1f}°C. "
                    f"{rain_assessment} Maximum wind speed will reach {wind:.1f} km/h."
                )
        return f"Forecast data for {loc_name} is available for up to 7 days."

    # 2. Current Weather Payload
    elif isinstance(payload, WeatherSnapshot) or intent == "current_weather":
        snap = payload if isinstance(payload, WeatherSnapshot) else None
        if snap:
            temp = snap.temperature
            app_temp = snap.apparent_temperature or temp
            hum = snap.relative_humidity or 0.0
            wind = snap.wind_speed or 0.0
            press = snap.surface_pressure or 1013.25

            if language == "hi":
                return (
                    f"{loc_name} में वर्तमान मौसम: तापमान {temp:.1f}°C (महसूस {app_temp:.1f}°C) है, "
                    f"सापेक्ष आर्द्रता {hum:.0f}%, हवा की गति {wind:.1f} किमी/घंटा और सतह का दबाव {press:.1f} hPa है।"
                )
            elif language == "gu":
                return (
                    f"{loc_name} માં વર્તમાન હવામાન: તાપમાન {temp:.1f}°C (અનુભવાય છે {app_temp:.1f}°C) છે, "
                    f"સાપેક્ષ ભેજ {hum:.0f}%, પવનની ઝડપ {wind:.1f} કિમી/કલાક અને સપાટીનું દબાણ {press:.1f} hPa છે."
                )
            else:
                return (
                    f"Current weather in {loc_name}: Temperature is {temp:.1f}°C (feels like {app_temp:.1f}°C) "
                    f"with {hum:.0f}% relative humidity, wind speed of {wind:.1f} km/h, and surface pressure of {press:.1f} hPa."
                )
        return f"Current weather observation retrieved for {loc_name}."

    # 3. Air Quality Payload
    elif isinstance(payload, AirQuality) or intent == "air_quality":
        aq = payload if isinstance(payload, AirQuality) else None
        if aq:
            aqi_val = aq.aqi or 0.0
            pm25 = aq.pm2_5 or 0.0
            pm10 = aq.pm10 or 0.0
            uv = aq.uv_index or 0.0

            if language == "hi":
                return (
                    f"{loc_name} में वायु गुणवत्ता: वायु गुणवत्ता सूचकांक (AQI) {aqi_val:.1f} है, "
                    f"PM2.5 {pm25:.1f} μg/m³, PM10 {pm10:.1f} μg/m³ और UV सूचकांक {uv:.1f} है।"
                )
            elif language == "gu":
                return (
                    f"{loc_name} માં હવાની ગુણવત્તા: એર ક્વોલિટી ઇન્ડેક્સ (AQI) {aqi_val:.1f} છે, "
                    f"PM2.5 {pm25:.1f} μg/m³, PM10 {pm10:.1f} μg/m³ અને UV ઇન્ડેક્સ {uv:.1f} છે."
                )
            else:
                return (
                    f"Current air quality in {loc_name}: Air Quality Index (AQI) is {aqi_val:.1f}, "
                    f"with PM2.5 at {pm25:.1f} μg/m³, PM10 at {pm10:.1f} μg/m³, and UV index of {uv:.1f}."
                )
        return f"Air quality data retrieved for {loc_name}."

    # 4. Historical Archive Payload
    elif isinstance(payload, list) and payload and isinstance(payload[0], HistoricalRecord):
        recs = payload
        avg_temp = sum(r.temperature for r in recs) / len(recs)
        total_precip = sum(r.precipitation or 0.0 for r in recs)
        if language == "hi":
            return (
                f"{loc_name} के लिए ऐतिहासिक मौसम रिकॉर्ड ({len(recs)} रिकॉर्ड): "
                f"औसत तापमान {avg_temp:.1f}°C और कुल वर्षा {total_precip:.1f} मिमी दर्ज की गई।"
            )
        elif language == "gu":
            return (
                f"{loc_name} માટે ઐતિહાસિક હવામાન રેકોર્ડ ({len(recs)} રેકોર્ડ): "
                f"સરેરાશ તાપમાન {avg_temp:.1f}°C અને કુલ વરસાદ {total_precip:.1f} મીમી નોંધાયો હતો."
            )
        else:
            return (
                f"Historical archive data for {loc_name} ({len(recs)} records): "
                f"Average recorded temperature was {avg_temp:.1f}°C with {total_precip:.1f} mm total precipitation."
            )

    # 5. Historical Comparison Payload
    elif isinstance(payload, HistoricalComparisonResult) or intent == "get_history_comparison":
        comp = payload if isinstance(payload, HistoricalComparisonResult) else None
        if comp and comp.table:
            last_row = comp.table[-1]
            last_year = last_row.year
            last_total = last_row.total_precipitation
            base_mean = comp.baseline_mean_total
            num_base = len(comp.baseline_years)
            anomaly = comp.chart_data[-1].anomaly if comp.chart_data else (last_total - base_mean)
            limitation_note = comp.limitations[0] if comp.limitations else "Small sample size limits long-term conclusions."

            if language == "hi":
                return (
                    f"{loc_name} के लिए ऐतिहासिक तुलना ({comp.target_period_description}): "
                    f"{last_year} में कुल वर्षा {last_total:.1f} मिमी दर्ज की गई, जबकि पिछले {num_base} वर्षों का आधारभूत औसत {base_mean:.1f} मिमी था "
                    f"(अंतर: {anomaly:+.1f} मिमी)। डेटा कवरेज {last_row.coverage_pct:.0f}% रहा। "
                    f"सीमा: {limitation_note}"
                )
            elif language == "gu":
                return (
                    f"{loc_name} માટે ઐતિહાસિક સરખામણી ({comp.target_period_description}): "
                    f"{last_year} માં કુલ વરસાદ {last_total:.1f} મીમી નોંધાયો હતો, જ્યારે પાછલા {num_base} વર્ષોની સરેરાશ {base_mean:.1f} મીમી હતી "
                    f"(તફાવત: {anomaly:+.1f} મીમી). ડેટા કવરેજ {last_row.coverage_pct:.0f}% રહ્યું. "
                    f"મર્યાદા: {limitation_note}"
                )
            else:
                return (
                    f"Historical rainfall comparison for {loc_name} ({comp.target_period_description}): "
                    f"Total precipitation for {last_year} was {last_total:.1f} mm, compared to a {num_base}-year baseline average of {base_mean:.1f} mm "
                    f"(anomaly: {anomaly:+.1f} mm). Period coverage was {last_row.coverage_pct:.0f}%. "
                    f"Statistical limitations: {limitation_note}"
                )
        return f"Historical comparison successfully computed for {loc_name}."

    return f"Meteorological data successfully retrieved for {loc_name}."
