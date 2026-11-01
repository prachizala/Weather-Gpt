"""Tests for the /api/health endpoint."""

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_api_health_endpoint():
    """Verify /api/health returns 200 and expected health metadata."""
    response = client.get("/api/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert "app_name" in data
    assert "environment" in data
    assert "timestamp" in data
