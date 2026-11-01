"""API router aggregation."""

from fastapi import APIRouter
from backend.app.api.advisories import router as advisories_router
from backend.app.api.air_quality import router as air_quality_router
from backend.app.api.chat import router as chat_router
from backend.app.api.health import router as health_router
from backend.app.api.knowledge import router as knowledge_router
from backend.app.api.locations import router as locations_router
from backend.app.api.weather import router as weather_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(locations_router)
api_router.include_router(weather_router)
api_router.include_router(air_quality_router)
api_router.include_router(advisories_router)
api_router.include_router(knowledge_router)
api_router.include_router(chat_router)
