"""Comprehensive tests for OpenRouterProvider including tool calling, streaming, error mapping, and startup checks."""

import json
import os
import pytest
import httpx

from backend.app.services.exceptions import UpstreamServiceError
from backend.app.services.llm_provider import (
    OpenRouterProvider,
    ToolCall,
    format_tools_for_openrouter,
)
from backend.app.services.number_verifier import verify_numbers
from backend.app.services.tools import WEATHER_TOOLS


@pytest.fixture
def mock_openrouter_provider():
    return OpenRouterProvider(
        api_key="sk-or-test-mock-key-12345",
        model_main="google/gemini-2.5-flash",
        model_fast="google/gemini-2.5-flash-lite",
        model_fallback="anthropic/claude-3-haiku",
        base_url="https://openrouter.ai/api/v1",
        app_url="https://weathergpt.example.com",
        app_title="WeatherGPT Test",
    )


# ---------------------------------------------------------------------------
# 1. Tool Call Round Trip & Formatting
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_format_tools_for_openrouter():
    formatted = format_tools_for_openrouter(WEATHER_TOOLS)
    assert len(formatted) == len(WEATHER_TOOLS)
    for tool in formatted:
        assert tool["type"] == "function"
        assert "name" in tool["function"]
        assert "description" in tool["function"]
        assert "parameters" in tool["function"]


@pytest.mark.asyncio
async def test_tool_call_round_trip(mock_openrouter_provider):
    mock_response_data = {
        "id": "gen-123",
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": "call_abc123",
                            "type": "function",
                            "function": {
                                "name": "get_forecast",
                                "arguments": json.dumps({"location": "Ahmedabad", "start": "tomorrow"}),
                            },
                        }
                    ],
                }
            }
        ],
    }

    async def mock_handler(request: httpx.Request):
        assert request.url.path == "/api/v1/chat/completions"
        assert request.headers["authorization"] == "Bearer sk-or-test-mock-key-12345"
        assert request.headers["http-referer"] == "https://weathergpt.example.com"
        assert request.headers["x-title"] == "WeatherGPT Test"
        body = json.loads(request.content)
        assert body["model"] == "google/gemini-2.5-flash-lite"
        assert len(body["tools"]) > 0
        return httpx.Response(200, json=mock_response_data)

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        mock_openrouter_provider._external_client = client
        decision = await mock_openrouter_provider.decide_tools(
            messages=[{"role": "user", "content": "Will it rain tomorrow in Ahmedabad?"}],
            tools=WEATHER_TOOLS,
        )

        assert len(decision.tool_calls) == 1
        tc = decision.tool_calls[0]
        assert tc.name == "get_forecast"
        assert tc.arguments == {"location": "Ahmedabad", "start": "tomorrow"}
        assert tc.id == "call_abc123"

        # Check tool message construction
        tool_msg = OpenRouterProvider.build_tool_message(
            tool_call_id=tc.id,
            tool_name=tc.name,
            result={"temperature": 32.5, "rainfall_probability": 10},
        )
        assert tool_msg["role"] == "tool"
        assert tool_msg["tool_call_id"] == "call_abc123"
        assert tool_msg["name"] == "get_forecast"
        assert "temperature" in tool_msg["content"]


# ---------------------------------------------------------------------------
# 2. SSE Streaming
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_streaming_explanation(mock_openrouter_provider):
    sse_events = [
        'data: {"choices": [{"delta": {"content": "Tomorrow "}}]}\n\n',
        'data: {"choices": [{"delta": {"content": "in Ahmedabad "}}]}\n\n',
        'data: {"choices": [{"delta": {"content": "will be clear."}}]}\n\n',
        "data: [DONE]\n\n",
    ]

    async def mock_handler(request: httpx.Request):
        assert request.url.path == "/api/v1/chat/completions"
        body = json.loads(request.content)
        assert body.get("stream") is True
        return httpx.Response(
            200,
            headers={"Content-Type": "text/event-stream"},
            content="".join(sse_events).encode("utf-8"),
        )

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        mock_openrouter_provider._external_client = client
        chunks = []
        async for chunk in mock_openrouter_provider.generate_grounded_explanation_stream(
            user_query="Will it rain?",
            payload={"temperature": 32.0},
        ):
            chunks.append(chunk)

        full_streamed = "".join(chunks)
        assert full_streamed == "Tomorrow in Ahmedabad will be clear."


# ---------------------------------------------------------------------------
# 3. Error Mapping (401, 402, 429)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_401_invalid_api_key(mock_openrouter_provider):
    async def mock_handler(request: httpx.Request):
        return httpx.Response(401, json={"error": {"message": "Invalid API Key"}})

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        mock_openrouter_provider._external_client = client
        with pytest.raises(UpstreamServiceError) as exc_info:
            await mock_openrouter_provider.decide_tools(
                messages=[{"role": "user", "content": "hello"}],
                tools=[],
            )
        assert "LLM key invalid" in str(exc_info.value)
        # Ensure key is not exposed in error string
        assert "sk-or-test-mock-key-12345" not in str(exc_info.value)


@pytest.mark.asyncio
async def test_402_out_of_credits(mock_openrouter_provider):
    async def mock_handler(request: httpx.Request):
        return httpx.Response(402, json={"error": {"message": "Insufficient credits"}})

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        mock_openrouter_provider._external_client = client
        with pytest.raises(UpstreamServiceError) as exc_info:
            await mock_openrouter_provider.decide_tools(
                messages=[{"role": "user", "content": "hello"}],
                tools=[],
            )
        assert "out of credits" in str(exc_info.value)


@pytest.mark.asyncio
async def test_429_rate_limited(mock_openrouter_provider):
    async def mock_handler(request: httpx.Request):
        return httpx.Response(429, json={"error": {"message": "Rate limit exceeded"}})

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        mock_openrouter_provider._external_client = client
        with pytest.raises(UpstreamServiceError) as exc_info:
            await mock_openrouter_provider.decide_tools(
                messages=[{"role": "user", "content": "hello"}],
                tools=[],
            )
        assert "rate limited" in str(exc_info.value)


# ---------------------------------------------------------------------------
# 4. 5xx Error Retries & Fallback Model
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_5xx_fallback_model_success(mock_openrouter_provider):
    calls = []

    async def mock_handler(request: httpx.Request):
        body = json.loads(request.content)
        model = body.get("model")
        calls.append(model)
        if model == "google/gemini-2.5-flash":
            # Primary model fails with 503
            return httpx.Response(503, json={"error": {"message": "Service Unavailable"}})
        elif model == "anthropic/claude-3-haiku":
            # Fallback model succeeds
            return httpx.Response(
                200,
                json={
                    "choices": [
                        {"message": {"role": "assistant", "content": "Explanation from fallback model."}}
                    ]
                },
            )
        return httpx.Response(500)

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        mock_openrouter_provider._external_client = client
        explanation = await mock_openrouter_provider.generate_grounded_explanation(
            user_query="How is the weather?",
            payload={"temperature": 28.0},
        )
        assert explanation == "Explanation from fallback model."
        assert "google/gemini-2.5-flash" in calls
        assert "anthropic/claude-3-haiku" in calls


@pytest.mark.asyncio
async def test_5xx_without_fallback_fails(mock_openrouter_provider):
    mock_openrouter_provider.model_fallback = None

    async def mock_handler(request: httpx.Request):
        return httpx.Response(500, json={"error": {"message": "Internal Server Error"}})

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        mock_openrouter_provider._external_client = client
        with pytest.raises(UpstreamServiceError) as exc_info:
            await mock_openrouter_provider.generate_grounded_explanation(
                user_query="test",
                payload={},
            )
        assert "temporarily unavailable" in str(exc_info.value)


# ---------------------------------------------------------------------------
# 5. Startup Check: Model Verification
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_startup_check_missing_model_slug():
    provider = OpenRouterProvider(
        api_key="sk-or-valid-key",
        model_main="nonexistent/model-slug-xyz",
        model_fast="google/gemini-2.5-flash-lite",
        base_url="https://openrouter.ai/api/v1",
    )

    models_data = {
        "data": [
            {"id": "google/gemini-2.5-flash-lite", "supported_parameters": ["tools"]},
            {"id": "meta-llama/llama-3.1-8b-instruct", "supported_parameters": ["tools"]},
        ]
    }

    async def mock_handler(request: httpx.Request):
        assert request.url.path == "/api/v1/models"
        return httpx.Response(200, json=models_data)

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        with pytest.raises(ValueError) as exc_info:
            await provider.verify_models_on_startup(client=client)
        assert "nonexistent/model-slug-xyz" in str(exc_info.value)
        assert "was not found" in str(exc_info.value)


@pytest.mark.asyncio
async def test_startup_check_model_without_tool_support():
    provider = OpenRouterProvider(
        api_key="sk-or-valid-key",
        model_main="google/gemini-2.5-flash",
        model_fast="unsupported/model-no-tools",
        base_url="https://openrouter.ai/api/v1",
    )

    models_data = {
        "data": [
            {"id": "google/gemini-2.5-flash", "supported_parameters": ["tools"]},
            {"id": "unsupported/model-no-tools", "supported_parameters": ["temperature"]},  # No "tools"
        ]
    }

    async def mock_handler(request: httpx.Request):
        return httpx.Response(200, json=models_data)

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        with pytest.raises(ValueError) as exc_info:
            await provider.verify_models_on_startup(client=client)
        assert "unsupported/model-no-tools" in str(exc_info.value)
        assert "does not support tools" in str(exc_info.value)


@pytest.mark.asyncio
async def test_startup_check_success():
    provider = OpenRouterProvider(
        api_key="sk-or-valid-key",
        model_main="google/gemini-2.5-flash",
        model_fast="google/gemini-2.5-flash-lite",
        base_url="https://openrouter.ai/api/v1",
    )

    models_data = {
        "data": [
            {"id": "google/gemini-2.5-flash", "supported_parameters": ["tools", "temperature"]},
            {"id": "google/gemini-2.5-flash-lite", "supported_parameters": ["tools", "temperature"]},
        ]
    }

    async def mock_handler(request: httpx.Request):
        return httpx.Response(200, json=models_data)

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        cached = await provider.verify_models_on_startup(client=client)
        assert "google/gemini-2.5-flash" in cached
        assert "google/gemini-2.5-flash-lite" in cached


# ---------------------------------------------------------------------------
# 6. Number Verifier Catches Injected Wrong Numbers
# ---------------------------------------------------------------------------

def test_number_verifier_catches_wrong_number():
    from backend.app.schemas.weather import WeatherSnapshot
    from backend.app.schemas.base import Coordinates
    from datetime import datetime, timezone

    now = datetime(2026, 10, 18, 10, 0, 0, tzinfo=timezone.utc)
    verified_payload = WeatherSnapshot(
        timestamp=now,
        temperature=31.5,
        apparent_temperature=34.0,
        relative_humidity=62.0,
        precipitation=0.0,
        weather_code=1,
        cloud_cover=10.0,
        surface_pressure=1008.0,
        wind_speed=12.0,
        wind_direction=240.0,
        is_day=1,
        coordinates=Coordinates(latitude=23.0225, longitude=72.5714),
        provider="open-meteo",
        retrieved_at=now,
        timezone="Asia/Kolkata",
        units={"temperature": "celsius"},
    )

    valid_text = "The temperature is 31.5°C and it feels like 34.0°C with 62% humidity."
    is_valid, mismatches = verify_numbers(valid_text, verified_payload)
    assert is_valid is True
    assert mismatches == []

    # Injected hallucinated number: 99.9°C or 150 mm
    bad_text = "The temperature is 99.9°C with 150 mm of sudden rain."
    bad_valid, bad_mismatches = verify_numbers(bad_text, verified_payload)
    assert bad_valid is False
    assert 99.9 in bad_mismatches or 150.0 in bad_mismatches


# ---------------------------------------------------------------------------
# 7. Optional Live Smoke Test (Skipped by default unless key provided)
# ---------------------------------------------------------------------------

@pytest.mark.skipif(
    not os.getenv("OPENROUTER_API_KEY"),
    reason="OPENROUTER_API_KEY not configured in environment; skipping live test.",
)
@pytest.mark.asyncio
async def test_live_openrouter_smoke():
    provider = OpenRouterProvider()
    decision = await provider.decide_tools(
        messages=[{"role": "user", "content": "What is the capital of France?"}],
        tools=[],
    )
    assert decision.content is not None
    assert "Paris" in decision.content
