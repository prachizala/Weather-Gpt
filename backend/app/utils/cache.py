"""Thread-safe in-memory TTL Cache implementation behind an abstract Cache interface."""

from __future__ import annotations
import asyncio
import time
from abc import ABC, abstractmethod
from typing import Any, Optional


class Cache(ABC):
    """Abstract Cache interface allowing seamless swap between in-memory, Redis, or other backends."""

    @abstractmethod
    async def get(self, key: str) -> Optional[Any]:
        """Retrieve a value by key. Returns None if key doesn't exist or is expired."""
        pass

    @abstractmethod
    async def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        """Store a value with an optional TTL (in seconds)."""
        pass

    @abstractmethod
    async def delete(self, key: str) -> bool:
        """Delete a key. Returns True if key existed and was deleted, False otherwise."""
        pass

    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Check if an unexpired key exists in the cache."""
        pass

    @abstractmethod
    async def clear(self) -> None:
        """Clear all keys in the cache."""
        pass

    @abstractmethod
    async def size(self) -> int:
        """Return the number of unexpired keys currently cached."""
        pass


class InMemoryTTLCache(Cache):
    """In-memory thread-safe TTL cache."""

    def __init__(self, default_ttl_seconds: int = 300) -> None:
        self.default_ttl_seconds = default_ttl_seconds
        # Mapping of key -> (value, expires_at_timestamp_float | None)
        self._store: dict[str, tuple[Any, Optional[float]]] = {}
        self._lock = asyncio.Lock()

    def _is_expired(self, expires_at: Optional[float]) -> bool:
        if expires_at is None:
            return False
        return time.time() >= expires_at

    async def get(self, key: str) -> Optional[Any]:
        async with self._lock:
            if key not in self._store:
                return None
            value, expires_at = self._store[key]
            if self._is_expired(expires_at):
                del self._store[key]
                return None
            return value

    async def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl_seconds
        expires_at = (time.time() + ttl) if (ttl is not None and ttl > 0) else None

        async with self._lock:
            self._store[key] = (value, expires_at)

    async def delete(self, key: str) -> bool:
        async with self._lock:
            if key in self._store:
                del self._store[key]
                return True
            return False

    async def exists(self, key: str) -> bool:
        async with self._lock:
            if key not in self._store:
                return False
            _, expires_at = self._store[key]
            if self._is_expired(expires_at):
                del self._store[key]
                return False
            return True

    async def clear(self) -> None:
        async with self._lock:
            self._store.clear()

    async def size(self) -> int:
        async with self._lock:
            # Purge expired keys during size calculation
            now = time.time()
            expired_keys = [
                k for k, (_, exp) in self._store.items() if exp is not None and now >= exp
            ]
            for k in expired_keys:
                del self._store[k]
            return len(self._store)
