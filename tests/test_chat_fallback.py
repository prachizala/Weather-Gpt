"""Tests for fallback handling, ambiguous locations, unsupported dates, and session context."""

from fastapi.testclient import TestClient
import pytest

from backend.app.api.deps import get_chat_orchestrator, get_weather_provider
from backend.app.main import app
from backend.app.schemas.base import Coordinates
from backend.app.schemas.location import Location
from backend.app.services.chat_orchestrator import ChatOrchestrator
from backend.app.services.llm_provider import MockLLMProvider
from backend.app.services.session_store import SessionStore
from tests.test_api_endpoints import MockWeatherProvider


@pytest.fixture
def mock_orchestrator():
    weather_prov = MockWeatherProvider()
    llm_prov = MockLLMProvider()
    sessions = SessionStore()
    return ChatOrchestrator(weather_provider=weather_prov, llm_provider=llm_prov, sessions=sessions)


@pytest.fixture
def client(mock_orchestrator):
    app.dependency_overrides[get_chat_orchestrator] = lambda: mock_orchestrator
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_non_weather_question_fallback(client):
    """Non-weather query returns graceful explanation without invoking tools."""
    res = client.post("/api/chat", json={"message": "Can you share a recipe for pasta?"})
    assert res.status_code == 200

    data = res.json()
    assert data["intent"] == "non_weather"
    assert data["weather_data"] is None
    assert "WeatherGPT" in data["answer"]
    assert "meteorological" in data["answer"].lower() or "weather" in data["answer"].lower()


def test_missing_or_ambiguous_location_fallback(client):
    """Query with unknown location yields graceful not_found response with limitations."""
    res = client.post("/api/chat", json={"message": "What is the weather in NonExistentCity999XYZ?"})
    assert res.status_code == 200

    data = res.json()
    assert data["intent"] in ("not_found", "ambiguous_location")
    assert len(data["limitations"]) > 0


def test_unsupported_date_range_fallback(client, mock_orchestrator):
    """Forecast query beyond the 16-day horizon yields graceful unsupported_date response."""
    # Instruct mock to request 30 days ahead
    from backend.app.services.llm_provider import ToolCall
    mock_orchestrator.llm_provider.canned_tool_call = ToolCall(
        name="get_forecast",
        arguments={"location": "Ahmedabad", "start": "2026-12-30"},
    )

    res = client.post("/api/chat", json={"message": "Weather in Ahmedabad in 60 days?"})
    assert res.status_code == 200

    data = res.json()
    assert data["intent"] == "unsupported_date"
    assert "16 days" in data["limitations"][0]


def test_session_context_remembers_location_and_clears(client):
    """Multi-turn conversation remembers location across turns and clears on request."""
    session_id = "test-session-123"

    # Turn 1: Mention Ahmedabad explicitly
    res1 = client.post(
        "/api/chat",
        json={"message": "What is the current weather in Ahmedabad?", "session_id": session_id},
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["location"]["name"] == "Ahmedabad"

    # Turn 2: Follow-up question without mentioning location ("Will it rain tomorrow?")
    res2 = client.post(
        "/api/chat",
        json={"message": "Will it rain tomorrow?", "session_id": session_id},
    )
    assert res2.status_code == 200
    data2 = res2.json()
    # Location was remembered from previous turn!
    assert data2["location"] is not None
    assert data2["location"]["name"] == "Ahmedabad"

    # Turn 3: Clear session
    clear_res = client.post(f"/api/chat/session/clear?session_id={session_id}")
    assert clear_res.status_code == 200
    assert "cleared" in clear_res.json()["message"]


def test_verifier_triggers_regeneration_and_fallback_on_bad_numbers(mock_orchestrator):
    """When LLM hallucinates numbers, verifier regenerates once and then falls back to deterministic template."""
    # Configure mock LLM to inject bad hallucinated numbers
    mock_orchestrator.llm_provider = MockLLMProvider(injected_bad_numbers=True)
    app.dependency_overrides[get_chat_orchestrator] = lambda: mock_orchestrator

    client = TestClient(app)
    res = client.post("/api/chat", json={"message": "Will it rain in Ahmedabad tomorrow?"})
    app.dependency_overrides.clear()

    assert res.status_code == 200
    data = res.json()
    # Hallucinated numbers (999.0, 12345.0, 888.0) must NOT be present in final answer!
    assert "999.0" not in data["answer"]
    assert "12345.0" not in data["answer"]
    assert "888.0" not in data["answer"]

    # Must contain the deterministic template safety limitation note
    assert any("Deterministic template" in lim for lim in data["limitations"])
