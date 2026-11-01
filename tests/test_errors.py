"""Tests verifying consistent API error responses."""

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_404_error_format():
    """Verify 404 responses conform to the standard ErrorResponse model."""
    response = client.get("/api/unknown-endpoint")
    assert response.status_code == 404

    data = response.json()
    assert "error" in data
    assert "detail" in data
    assert "code" in data
    assert "status_code" in data
    assert data["status_code"] == 404
    # Metadata fields enforced on all models
    assert "provider" in data
    assert "retrieved_at" in data
    assert "coordinates" in data
    assert "timezone" in data
    assert "units" in data
