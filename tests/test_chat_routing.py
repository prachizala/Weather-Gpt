"""Tests for LLM tool call routing and meteorological tool dispatch."""

import pytest
from backend.app.services.llm_provider import MockLLMProvider
from backend.app.services.tools import WEATHER_TOOLS


@pytest.mark.asyncio
async def test_tool_routing_current_weather():
    """Verify current weather query routes to get_current tool."""
    mock_llm = MockLLMProvider()
    decision = await mock_llm.decide_tools(
        messages=[{"role": "user", "content": "What's the current weather in London right now?"}],
        tools=WEATHER_TOOLS,
    )
    assert len(decision.tool_calls) == 1
    call = decision.tool_calls[0]
    assert call.name == "get_current"
    assert "london" in call.arguments.get("location", "").lower()


@pytest.mark.asyncio
async def test_tool_routing_forecast():
    """Verify forecast query routes to get_forecast tool."""
    mock_llm = MockLLMProvider()
    decision = await mock_llm.decide_tools(
        messages=[{"role": "user", "content": "Will it rain in Ahmedabad tomorrow?"}],
        tools=WEATHER_TOOLS,
    )
    assert len(decision.tool_calls) == 1
    call = decision.tool_calls[0]
    assert call.name == "get_forecast"
    assert "ahmedabad" in call.arguments.get("location", "").lower()
    assert call.arguments.get("start") == "tomorrow"


@pytest.mark.asyncio
async def test_tool_routing_air_quality():
    """Verify air quality inquiry routes to get_air_quality tool."""
    mock_llm = MockLLMProvider()
    decision = await mock_llm.decide_tools(
        messages=[{"role": "user", "content": "What is the air quality and PM2.5 in Paris today?"}],
        tools=WEATHER_TOOLS,
    )
    assert len(decision.tool_calls) == 1
    call = decision.tool_calls[0]
    assert call.name == "get_air_quality"
    assert "paris" in call.arguments.get("location", "").lower()


@pytest.mark.asyncio
async def test_tool_routing_history():
    """Verify past reanalysis query routes to get_history tool."""
    mock_llm = MockLLMProvider()
    decision = await mock_llm.decide_tools(
        messages=[{"role": "user", "content": "Tell me about the recorded historical weather in Ahmedabad yesterday"}],
        tools=WEATHER_TOOLS,
    )
    assert len(decision.tool_calls) == 1
    call = decision.tool_calls[0]
    assert call.name == "get_history"
    assert "ahmedabad" in call.arguments.get("location", "").lower()
