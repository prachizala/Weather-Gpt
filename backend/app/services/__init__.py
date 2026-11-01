"""Services, provider interfaces, and implementations for WeatherGPT."""

from backend.app.services.exceptions import (
    InvalidParameterError,
    LocationNotFoundError,
    UpstreamDataError,
    UpstreamServiceError,
    UpstreamTimeoutError,
    WeatherGPTException,
)
from backend.app.services.india_alerts import (
    IMD_ALERT_LABEL,
    IMD_FULL_NOTICE,
    IMD_OFFICIAL_URL,
    get_regional_alerts_notice,
    is_india_location,
)
from backend.app.services.open_meteo import OpenMeteoClient
from backend.app.services.providers import LLMProvider, WeatherProvider

__all__ = [
    "IMD_ALERT_LABEL",
    "IMD_FULL_NOTICE",
    "IMD_OFFICIAL_URL",
    "InvalidParameterError",
    "LLMProvider",
    "LocationNotFoundError",
    "OpenMeteoClient",
    "UpstreamDataError",
    "UpstreamServiceError",
    "UpstreamTimeoutError",
    "WeatherGPTException",
    "WeatherProvider",
    "get_regional_alerts_notice",
    "is_india_location",
]
