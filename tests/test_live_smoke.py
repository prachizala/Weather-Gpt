"""Live integration smoke tests against upstream Open-Meteo for Ahmedabad.

NOTE: This test is marked as 'live' and SKIPPED by default so that routine unit
tests execute hermetically without external network dependencies.
To execute this test, run:
    RUN_LIVE_TESTS=1 pytest -m live
"""

import os
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app


@pytest.mark.live
@pytest.mark.skipif(
    not os.getenv("RUN_LIVE_TESTS"),
    reason="Live integration tests skipped by default. Enable by setting RUN_LIVE_TESTS=1",
)
def test_live_ahmedabad_current_and_forecast_smoke():
    """Verify live end-to-end current weather and 7-day forecast for Ahmedabad."""
    client = TestClient(app)

    # 1. Geocode Ahmedabad
    geo_res = client.get("/api/locations/search?q=Ahmedabad&count=1")
    assert geo_res.status_code == 200
    geo_data = geo_res.json()
    assert len(geo_data["data"]) >= 1
    loc = geo_data["data"][0]
    lat = loc["coordinates"]["latitude"]
    lon = loc["coordinates"]["longitude"]
    assert "Ahmedabad" in loc["name"]
    assert loc["country_code"] == "IN"
    # India official alert
    assert "Official alerts: check IMD" in geo_data["alerts"]

    # 2. Live Current Weather for Ahmedabad
    current_res = client.get(f"/api/weather/current?latitude={lat}&longitude={lon}&units=celsius")
    assert current_res.status_code == 200
    current_data = current_res.json()
    assert current_data["data"]["temperature"] is not None
    assert "Official alerts: check IMD" in current_data["alerts"]
    assert current_data["source"]["provider"] == "open-meteo"

    # 3. Live 7-Day Forecast for Ahmedabad
    forecast_res = client.get(f"/api/weather/forecast?latitude={lat}&longitude={lon}&days=7&units=celsius")
    assert forecast_res.status_code == 200
    forecast_data = forecast_res.json()
    daily = forecast_data["data"]["daily"]
    hourly = forecast_data["data"]["hourly"]
    assert len(daily) == 7
    assert len(hourly) > 0
    assert "Official alerts: check IMD" in forecast_data["alerts"]
