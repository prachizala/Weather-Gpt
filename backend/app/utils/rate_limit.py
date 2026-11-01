"""Rate limiting and request size enforcement utilities."""

from __future__ import annotations
import time
from collections import defaultdict
from typing import Dict, List
from fastapi import HTTPException, Request, status

from backend.app.config import settings


class InMemoryRateLimiter:
    """Sliding-window in-memory IP rate limiter."""

    def __init__(self, requests_per_minute: int = 30) -> None:
        self.requests_per_minute = requests_per_minute
        self.ip_records: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, client_ip: str) -> bool:
        now = time.time()
        window_start = now - 60.0

        # Purge older timestamps
        records = [ts for ts in self.ip_records[client_ip] if ts > window_start]
        if len(records) >= self.requests_per_minute:
            self.ip_records[client_ip] = records
            return False

        records.append(now)
        self.ip_records[client_ip] = records
        return True

    def reset(self) -> None:
        self.ip_records.clear()


rate_limiter = InMemoryRateLimiter(requests_per_minute=settings.chat_rate_limit_per_minute)


async def check_chat_rate_limit_and_size(request: Request) -> None:
    """Dependency enforcing request body size and client IP rate limiting."""
    # 1. Enforce max body size (Content-Length header check)
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            length_int = int(content_length)
            if length_int > settings.chat_max_body_bytes:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"Request body exceeds maximum permitted size of {settings.chat_max_body_bytes} bytes.",
                )
        except ValueError:
            pass

    # 2. Enforce IP rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if not rate_limiter.is_allowed(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Maximum {settings.chat_rate_limit_per_minute} requests per minute.",
        )
