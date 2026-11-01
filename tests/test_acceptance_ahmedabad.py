"""Acceptance test verifying the primary Phase 3 goal:
'Will it rain in Ahmedabad tomorrow?' returns a grounded answer whose numbers match the payload exactly.
"""

from fastapi.testclient import TestClient
import pytest

from backend.app.api.deps import get_chat_orchestrator
from backend.app.main import app
from backend.app.services.chat_orchestrator import ChatOrchestrator
from backend.app.services.llm_provider import MockLLMProvider
from backend.app.services.number_verifier import verify_numbers
from backend.app.services.session_store import SessionStore
from tests.test_api_endpoints import MockWeatherProvider


def test_acceptance_ahmedabad_rain_tomorrow_grounded():
    """Verify acceptance criteria for: 'Will it rain in Ahmedabad tomorrow?'"""
    weather_prov = MockWeatherProvider()
    llm_prov = MockLLMProvider()
    orchestrator = ChatOrchestrator(
        weather_provider=weather_prov,
        llm_provider=llm_prov,
        sessions=SessionStore(),
    )
    app.dependency_overrides[get_chat_orchestrator] = lambda: orchestrator

    client = TestClient(app)
    response = client.post("/api/chat", json={"message": "Will it rain in Ahmedabad tomorrow?"})
    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()

    # 1. Full Contract Verification
    for required_key in [
        "answer",
        "intent",
        "location",
        "valid_period",
        "weather_data",
        "sources",
        "limitations",
    ]:
        assert required_key in data, f"Missing contract key '{required_key}' in /api/chat response"

    # 2. Location & Intent
    assert data["intent"] == "get_forecast"
    assert data["location"]["name"] == "Ahmedabad"
    assert data["location"]["country_code"] == "IN"

    # 3. Grounding & Sources
    assert len(data["sources"]) > 0
    assert data["sources"][0]["provider"] == "open-meteo"
    assert "Weather data by Open-Meteo.com (CC BY 4.0)" in data["sources"][0]["attribution"]

    # 4. Regional IMD Notice
    assert any("Official alerts: check IMD" in lim for lim in data["limitations"])

    # 5. Number Verifier: numbers in the answer MUST match the payload exactly!
    answer_text = data["answer"]
    payload = data["weather_data"]
    valid_period = data["valid_period"]

    is_valid, unmatched = verify_numbers(answer_text, payload, valid_period)
    assert is_valid is True, f"Unmatched numbers found in answer text: {unmatched}"
    assert len(unmatched) == 0
