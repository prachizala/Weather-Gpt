"""India Meteorological Department (IMD) alerts advisory and detection."""

from __future__ import annotations
from typing import Optional

IMD_OFFICIAL_URL = "https://mausam.imd.gov.in/"
IMD_ALERT_LABEL = "Official alerts: check IMD"
IMD_FULL_NOTICE = f"{IMD_ALERT_LABEL} ({IMD_OFFICIAL_URL})"


def is_india_location(
    latitude: float,
    longitude: float,
    country_code: Optional[str] = None,
    country_name: Optional[str] = None,
) -> bool:
    """Detect whether given coordinates or metadata reside within the Republic of India."""
    if country_code and country_code.upper() in ("IN", "IND"):
        return True
    if country_name and "india" in country_name.strip().lower():
        return True
    # Geographical bounding box of India: 6.5° N - 37.5° N, 68.0° E - 97.5° E
    return 6.5 <= latitude <= 37.5 and 68.0 <= longitude <= 97.5


def get_regional_alerts_notice(
    latitude: float,
    longitude: float,
    country_code: Optional[str] = None,
    country_name: Optional[str] = None,
) -> Optional[str]:
    """Provide static official authority notice for India."""
    if is_india_location(latitude, longitude, country_code, country_name):
        return IMD_FULL_NOTICE
    return None
