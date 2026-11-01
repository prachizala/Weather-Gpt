"""Health check endpoint for WeatherGPT API."""

from datetime import datetime, timezone
from fastapi import APIRouter
from backend.app.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health", summary="Service Health Check")
async def health_check() -> dict[str, str]:
    """Returns the health status and runtime metadata of the WeatherGPT API service."""
    return {
        "status": "healthy",
        "app_name": settings.app_name,
        "environment": settings.app_env,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
