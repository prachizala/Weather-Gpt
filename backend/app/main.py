"""FastAPI application initialization with consistent error handling and route setup."""

import logging
from datetime import datetime, timezone
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.app.api import api_router
from backend.app.config import settings
from backend.app.schemas.error import ErrorResponse
from backend.app.services.exceptions import WeatherGPTException

from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events: verify LLM models on boot if configured with OpenRouter."""
    from backend.app.api.deps import get_llm_provider
    from backend.app.services.llm_provider import OpenRouterProvider

    llm = get_llm_provider()
    if isinstance(llm, OpenRouterProvider):
        await llm.verify_models_on_startup()
    yield


def create_app() -> FastAPI:
    """Application factory for WeatherGPT."""
    app = FastAPI(
        title=settings.app_name,
        description="Meteorological Intelligence & Weather Advisory AI Assistant",
        version="0.1.0",
        debug=settings.debug,
        lifespan=lifespan,
    )

    # Mount CORS middleware
    from fastapi.middleware.cors import CORSMiddleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Security Headers and Request Latency Middleware
    import time
    @app.middleware("http")
    async def security_and_latency_middleware(request: Request, call_next):
        start_time = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # Standard Security Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Response-Time-Ms"] = str(duration_ms)

        # Structured request logging
        logger.info(
            "%s %s -> %s (%s ms)",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            },
        )
        return response

    app.include_router(api_router, prefix="/api")

    # Serve static frontend SPA build in production if available
    import os
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse

    frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")
    if os.path.exists(frontend_dist):
        assets_dir = os.path.join(frontend_dist, "assets")
        if os.path.exists(assets_dir):
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str):
            # Do not intercept API requests
            if full_path.startswith("api"):
                return JSONResponse(status_code=404, content={"error": "Not Found"})
            file_path = os.path.join(frontend_dist, full_path)
            if full_path and os.path.exists(file_path) and os.path.isfile(file_path):
                return FileResponse(file_path)
            index_path = os.path.join(frontend_dist, "index.html")
            if os.path.exists(index_path):
                return FileResponse(index_path)
            return JSONResponse(status_code=404, content={"error": "Frontend build not found"})

    # Consistent Error Handlers returning ErrorResponse
    @app.exception_handler(WeatherGPTException)
    async def weathergpt_exception_handler(request: Request, exc: WeatherGPTException) -> JSONResponse:
        error_resp = ErrorResponse(
            error=exc.__class__.__name__,
            detail=exc.message,
            code=exc.code,
            status_code=exc.status_code,
            provider="weather-gpt",
            retrieved_at=datetime.now(timezone.utc),
            timezone="UTC",
            units={},
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=error_resp.model_dump(mode="json"),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        error_resp = ErrorResponse(
            error=exc.__class__.__name__,
            detail=str(exc.detail),
            code="HTTP_ERROR",
            status_code=exc.status_code,
            provider="weather-gpt",
            retrieved_at=datetime.now(timezone.utc),
            timezone="UTC",
            units={},
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=error_resp.model_dump(mode="json"),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        error_resp = ErrorResponse(
            error="ValidationError",
            detail=str(exc.errors()),
            code="VALIDATION_ERROR",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            provider="weather-gpt",
            retrieved_at=datetime.now(timezone.utc),
            timezone="UTC",
            units={},
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error_resp.model_dump(mode="json"),
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled server exception: %s", exc)
        error_resp = ErrorResponse(
            error="InternalServerError",
            detail=str(exc) if settings.debug else "An unexpected internal error occurred.",
            code="INTERNAL_ERROR",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            provider="weather-gpt",
            retrieved_at=datetime.now(timezone.utc),
            timezone="UTC",
            units={},
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_resp.model_dump(mode="json"),
        )

    return app


app = create_app()
