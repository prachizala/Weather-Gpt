"""WeatherGPT domain and API schemas."""

from backend.app.schemas.advisories import AdvisoryItem, AdvisoriesReport, SkippedRule
from backend.app.schemas.api import APIResponseEnvelope
from backend.app.schemas.base import ALLOWED_UNITS, BaseMetadataModel, Coordinates
from backend.app.schemas.chat import ChatRequest, ChatResponse, SourceRef
from backend.app.schemas.comparison import (
    ComparisonChartPoint,
    HistoricalComparisonResult,
    YearComparisonRow,
)
from backend.app.schemas.error import ErrorResponse
from backend.app.schemas.location import Location
from backend.app.schemas.weather import (
    AirQuality,
    DailyForecast,
    DatasetType,
    ForecastData,
    ForecastPoint,
    HistoricalRecord,
    WeatherSnapshot,
)

__all__ = [
    "ALLOWED_UNITS",
    "APIResponseEnvelope",
    "AdvisoriesReport",
    "AdvisoryItem",
    "AirQuality",
    "BaseMetadataModel",
    "ChatRequest",
    "ChatResponse",
    "ComparisonChartPoint",
    "Coordinates",
    "DailyForecast",
    "DatasetType",
    "ErrorResponse",
    "ForecastData",
    "ForecastPoint",
    "HistoricalComparisonResult",
    "HistoricalRecord",
    "Location",
    "SkippedRule",
    "SourceRef",
    "WeatherSnapshot",
    "YearComparisonRow",
]
