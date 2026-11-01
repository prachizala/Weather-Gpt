"""Unit tests for location disambiguation vs explicitly selected location handling."""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timezone

from backend.app.api.deps import get_chat_orchestrator
from backend.app.main import app
from backend.app.schemas.base import Coordinates
from backend.app.schemas.location import Location
from backend.app.services.chat_orchestrator import ChatOrchestrator
from backend.app.services.llm_provider import MockLLMProvider, ToolCall
from backend.app.services.providers import WeatherProvider
from backend.app.services.session_store import SessionStore
from tests.test_api_endpoints import MockWeatherProvider


class MultiCandidateWeatherProvider(MockWeatherProvider):
    """Mock weather provider that returns multiple candidates for ambiguous city names."""

    async def geocode(self, query: str, limit: int = 10) -> list[Location]:
        if "springfield" in query.lower():
            # Return multiple candidates across different states
            return [
                Location(
                    name="Springfield",
                    country="United States",
                    country_code="US",
                    admin1="Illinois",
                    coordinates=Coordinates(latitude=39.7817, longitude=-89.6501),
                    provider="open-meteo",
                    retrieved_at=self.now,
                    timezone="America/Chicago",
                    units={},
                ),
                Location(
                    name="Springfield",
                    country="United States",
                    country_code="US",
                    admin1="Massachusetts",
                    coordinates=Coordinates(latitude=42.1015, longitude=-72.5898),
                    provider="open-meteo",
                    retrieved_at=self.now,
                    timezone="America/New_York",
                    units={},
                ),
                Location(
                    name="Springfield",
                    country="United States",
                    country_code="US",
                    admin1="Missouri",
                    coordinates=Coordinates(latitude=37.2090, longitude=-93.2923),
                    provider="open-meteo",
                    retrieved_at=self.now,
                    timezone="America/Chicago",
                    units={},
                ),
            ]
        return await super().geocode(query, limit)


@pytest.fixture
def multi_orchestrator():
    weather_prov = MultiCandidateWeatherProvider()
    llm_prov = MockLLMProvider()
    sessions = SessionStore()
    return ChatOrchestrator(weather_provider=weather_prov, llm_provider=llm_prov, sessions=sessions)


@pytest.fixture
def client(multi_orchestrator):
    app.dependency_overrides[get_chat_orchestrator] = lambda: multi_orchestrator
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_free_text_ambiguous_name_adds_limitation(client, multi_orchestrator):
    """When a query resolves an ambiguous name from free text with multiple candidates,

    the 'Multiple locations matched' limitation MUST be present.
    """
    # Configure mock LLM to route to get_current with location 'Springfield'
    multi_orchestrator.llm_provider.canned_tool_call = ToolCall(
        name="get_current",
        arguments={"location": "Springfield"},
    )

    res = client.post(
        "/api/chat",
        json={"message": "What is the weather in Springfield?"},
    )
    assert res.status_code == 200
    data = res.json()

    # The ambiguous geocode result must trigger the limitation
    has_ambiguity_limitation = any("Multiple locations matched" in lim for lim in data["limitations"])
    assert has_ambiguity_limitation, f"Expected 'Multiple locations matched' in limitations, got: {data['limitations']}"


def test_explicitly_selected_location_skips_disambiguation(client, multi_orchestrator):
    """When frontend passes an explicitly selected location (with coordinates/location_id),

    name disambiguation is skipped and 'Multiple locations matched' limitation MUST NOT be added.
    """
    selected_loc = {
        "name": "Springfield",
        "country": "United States",
        "country_code": "US",
        "admin1": "Illinois",
        "coordinates": {"latitude": 39.7817, "longitude": -89.6501},
        "timezone": "America/Chicago",
        "provider": "open-meteo",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "units": {"temperature": "°C"},
    }

    # Even if tool arguments have location="Springfield"
    multi_orchestrator.llm_provider.canned_tool_call = ToolCall(
        name="get_current",
        arguments={"location": "Springfield"},
    )

    res = client.post(
        "/api/chat",
        json={
            "message": "What is the weather in Springfield?",
            "location": selected_loc,
            "session_id": "test-selected-loc-session",
        },
    )
    assert res.status_code == 200
    data = res.json()

    # Ambiguity limitation must NOT be present
    has_ambiguity_limitation = any("Multiple locations matched" in lim for lim in data["limitations"])
    assert not has_ambiguity_limitation, f"Did NOT expect 'Multiple locations matched' when location was explicitly provided, got: {data['limitations']}"
    assert data["location"]["name"] == "Springfield"
    assert data["location"]["admin1"] == "Illinois"
