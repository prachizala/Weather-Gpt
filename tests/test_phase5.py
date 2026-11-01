"""Unit and integration tests for Phase 5: Combined RAG + Weather, Multilingual, Streaming & Optimization."""

import asyncio
import pytest
from httpx import ASGITransport, AsyncClient

from backend.app.main import app
from backend.app.schemas.base import Coordinates
from backend.app.schemas.location import Location
from backend.app.schemas.weather import WeatherSnapshot
from backend.app.services.chat_orchestrator import ChatOrchestrator
from backend.app.services.llm_provider import MockLLMProvider, ToolCall
from backend.app.services.number_verifier import normalize_indic_digits, verify_numbers
from backend.app.services.open_meteo import OpenMeteoClient
from backend.app.utils.cache import InMemoryTTLCache
from backend.app.utils.language import detect_query_language
from backend.app.utils.rate_limit import rate_limiter


# ---------------------------------------------------------------------------
# 1. Mixed Question Routing & Dual Citations
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_mixed_question_routing_and_separate_citations():
    """Mixed query routes to both get_current and search_knowledge, showing separate citations."""
    mock_weather = OpenMeteoClient()
    mock_llm = MockLLMProvider()
    orchestrator = ChatOrchestrator(weather_provider=mock_weather, llm_provider=mock_llm)

    # Question asking why it feels hotter than the temperature in Ahmedabad today
    query = "Why does it feel hotter than the temperature today in Ahmedabad?"
    resp = await orchestrator.handle_chat(query)

    assert resp.intent == "mixed_weather_knowledge"
    # Both weather sources and knowledge citations must be present separately
    assert len(resp.sources) >= 1
    assert any("Open-Meteo" in s.title for s in resp.sources)
    assert len(resp.knowledge_citations) >= 1
    assert any("Apparent Temperature" in c.title or "Heat Index" in c.title for c in resp.knowledge_citations)
    # Both facts appear in answer
    assert "apparent temperature" in resp.answer.lower() or "heat index" in resp.answer.lower()


# ---------------------------------------------------------------------------
# 2. Multilingual & Indic Digit Verification (Hindi & Gujarati)
# ---------------------------------------------------------------------------

def test_indic_digit_normalization():
    assert normalize_indic_digits("तापमान २५.५ डिग्री") == "तापमान 25.5 डिग्री"
    assert normalize_indic_digits("તાપમાન ૩૨.૦ ડિગ્રી") == "તાપમાન 32.0 ડિગ્રી"
    assert normalize_indic_digits("Normal 123 text") == "Normal 123 text"


@pytest.mark.asyncio
async def test_hindi_weather_question_and_number_verification():
    """Hindi query about Ahmedabad weather returns Hindi answer and passes number verification."""
    mock_weather = OpenMeteoClient()
    mock_llm = MockLLMProvider()
    orchestrator = ChatOrchestrator(weather_provider=mock_weather, llm_provider=mock_llm)

    query = "अहमदाबाद में आज मौसम कैसा है?"
    resp = await orchestrator.handle_chat(query)

    assert resp.language == "hi"
    assert "अहमदाबाद" in resp.answer or "तापमान" in resp.answer
    assert resp.location is not None
    assert resp.location.name == "Ahmedabad"

    # Number verifier must pass on the Hindi answer
    is_valid, mismatches = verify_numbers(resp.answer, resp.weather_data, resp.valid_period)
    assert is_valid is True, f"Verifier failed with mismatches: {mismatches}"


@pytest.mark.asyncio
async def test_gujarati_weather_question_and_number_verification():
    """Gujarati query about Ahmedabad weather returns Gujarati answer and passes number verification."""
    mock_weather = OpenMeteoClient()
    mock_llm = MockLLMProvider()
    orchestrator = ChatOrchestrator(weather_provider=mock_weather, llm_provider=mock_llm)

    query = "અમદાવાદમાં આજે હવામાન કેવું છે?"
    resp = await orchestrator.handle_chat(query)

    assert resp.language == "gu"
    assert "અમદાવાદ" in resp.answer or "તાપમાન" in resp.answer
    assert resp.location is not None
    assert resp.location.name == "Ahmedabad"

    # Number verifier must pass on the Gujarati answer
    is_valid, mismatches = verify_numbers(resp.answer, resp.weather_data, resp.valid_period)
    assert is_valid is True, f"Verifier failed with mismatches: {mismatches}"


# ---------------------------------------------------------------------------
# 3. Cache Hit Avoids Second Upstream Call
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cache_hit_avoids_second_provider_call():
    """Identical tool requests reuse the in-memory TTL cache without repeated HTTP calls."""
    cache = InMemoryTTLCache()
    client = OpenMeteoClient(cache=cache)

    from datetime import datetime, timezone

    loc = Location(
        name="Ahmedabad",
        country="India",
        country_code="IN",
        coordinates=Coordinates(latitude=23.0225, longitude=72.5714),
        provider="open-meteo",
        retrieved_at=datetime.now(timezone.utc),
        timezone="Asia/Kolkata",
        units={},
    )

    fake_snapshot = WeatherSnapshot(
        timestamp=datetime.now(timezone.utc),
        temperature=31.5,
        apparent_temperature=34.0,
        relative_humidity=55.0,
        surface_pressure=1012.0,
        wind_speed=12.0,
        weather_code=0,
        units={"temperature": "°C"},
        provider="open-meteo",
        retrieved_at=datetime.now(timezone.utc),
        coordinates=loc.coordinates,
        timezone="Asia/Kolkata",
    )
    cache_key = "current:23.0225:72.5714:celsius"
    await cache.set(cache_key, fake_snapshot, ttl_seconds=600)

    # Call get_current_weather
    result = await client.get_current_weather(loc, units="celsius")
    assert result.temperature == 31.5
    assert result.apparent_temperature == 34.0


# ---------------------------------------------------------------------------
# 4. Latency Breakdown per Stage
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_latency_stages_logged_in_response():
    """Response tracks and returns latency breakdown for routing, tools, generation, and verification."""
    mock_weather = OpenMeteoClient()
    mock_llm = MockLLMProvider()
    orchestrator = ChatOrchestrator(weather_provider=mock_weather, llm_provider=mock_llm)

    resp = await orchestrator.handle_chat("What is the weather in London?")
    assert "routing" in resp.latency_stages
    assert "tools_execution" in resp.latency_stages
    assert "explanation_generation" in resp.latency_stages
    assert "total" in resp.latency_stages
    assert resp.latency_stages["total"] >= 0.0


# ---------------------------------------------------------------------------
# 5. Per-Request Timeout Fallback
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_per_request_timeout_fallback():
    """When execution exceeds timeout limit, a graceful localized fallback is returned."""
    mock_weather = OpenMeteoClient()
    mock_llm = MockLLMProvider()

    # Create slow mock orchestrator with 0.001s timeout
    orchestrator = ChatOrchestrator(weather_provider=mock_weather, llm_provider=mock_llm)
    resp = await orchestrator.handle_chat(
        message="What is the weather in Ahmedabad?",
        timeout=0.00001,
    )

    assert resp.intent == "timeout_fallback"
    assert "timed out" in resp.answer.lower() or "समय समाप्त" in resp.answer


# ---------------------------------------------------------------------------
# 6. Streaming SSE Endpoint Test
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_stream_chat_sse_endpoint():
    """POST /api/chat/stream yields SSE chunks, metadata event, and done event."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/chat/stream",
            json={"message": "What is the weather in Ahmedabad?"},
        )
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers.get("content-type", "")

        chunks = resp.text.split("\n\n")
        # Ensure we have data tokens and event completion markers
        data_chunks = [c for c in chunks if c.startswith("data:")]
        assert len(data_chunks) > 1
        assert any("[DONE]" in c for c in chunks)


# ---------------------------------------------------------------------------
# 7. Rate Limiting and Request Size Limits
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_chat_request_body_size_limit():
    """Requests exceeding max body size return HTTP 413."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        huge_message = "A" * 10000
        resp = await client.post(
            "/api/chat",
            json={"message": huge_message},
            headers={"Content-Length": str(len(huge_message) + 50)},
        )
        assert resp.status_code == 413
        assert "exceeds maximum permitted size" in resp.json().get("detail", "")


@pytest.mark.asyncio
async def test_chat_rate_limiting():
    """Requests exceeding per-minute rate limit return HTTP 429."""
    rate_limiter.reset()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Simulate rate limit by temporarily setting quota low or exhausting it
        rate_limiter.requests_per_minute = 3
        # Send 3 valid requests
        for _ in range(3):
            r = await client.post("/api/chat", json={"message": "What is the weather in London?"})
            assert r.status_code == 200

        # 4th request must be blocked with 429
        blocked = await client.post("/api/chat", json={"message": "What is the weather in London?"})
        assert blocked.status_code == 429
        assert "Rate limit exceeded" in blocked.json().get("detail", "")

    # Reset rate limiter
    rate_limiter.requests_per_minute = 30
    rate_limiter.reset()
