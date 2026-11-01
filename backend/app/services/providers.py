"""Abstract provider adapter interfaces for external weather and LLM integrations."""

from __future__ import annotations
from abc import ABC, abstractmethod
from datetime import datetime, date
from typing import Any, Optional, Union
from backend.app.schemas.chat import ChatRequest, ChatResponse
from backend.app.schemas.location import Location
from backend.app.schemas.weather import (
    AirQuality,
    ForecastData,
    ForecastPoint,
    HistoricalRecord,
    WeatherSnapshot,
)


class WeatherProvider(ABC):
    """Abstract interface for weather data providers (e.g. Open-Meteo, Tomorrow.io)."""

    @abstractmethod
    async def get_current_weather(
        self, location: Location, units: str = "celsius"
    ) -> WeatherSnapshot:
        """Fetch current weather snapshot for a location."""
        pass

    @abstractmethod
    async def get_forecast(
        self, location: Location, days: int = 7, units: str = "celsius"
    ) -> ForecastData:
        """Fetch weather forecast (daily summaries and hourly points) for a location."""
        pass

    @abstractmethod
    async def get_historical_weather(
        self,
        location: Location,
        start_date: Union[str, date, datetime],
        end_date: Union[str, date, datetime],
        units: str = "celsius",
    ) -> list[HistoricalRecord]:
        """Fetch historical weather records for a location within a date range."""
        pass

    @abstractmethod
    async def get_air_quality(self, location: Location) -> AirQuality:
        """Fetch current air quality data for a location."""
        pass

    @abstractmethod
    async def geocode(self, query: str, limit: int = 10) -> list[Location]:
        """Search for geographical locations matching a query string."""
        pass


class LLMProvider(ABC):
    """Abstract interface for LLM providers (e.g. OpenRouter, OpenAI, Anthropic)."""

    @abstractmethod
    async def generate_response(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        **kwargs: Any,
    ) -> str:
        """Generate text completion from a prompt."""
        pass

    @abstractmethod
    async def generate_chat(
        self,
        request: ChatRequest,
        **kwargs: Any,
    ) -> ChatResponse:
        """Process a structured chat request and produce a grounded response with citations."""
        pass
