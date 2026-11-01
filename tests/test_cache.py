"""Tests for the Cache interface and InMemoryTTLCache implementation."""

import asyncio
import pytest
from backend.app.utils.cache import Cache, InMemoryTTLCache


@pytest.mark.asyncio
async def test_cache_set_and_get():
    """Verify storing and retrieving values."""
    cache: Cache = InMemoryTTLCache(default_ttl_seconds=60)
    await cache.set("weather:london", {"temp": 21.0})

    result = await cache.get("weather:london")
    assert result == {"temp": 21.0}


@pytest.mark.asyncio
async def test_cache_miss():
    """Accessing non-existent key returns None."""
    cache: Cache = InMemoryTTLCache()
    result = await cache.get("non_existent_key")
    assert result is None


@pytest.mark.asyncio
async def test_cache_exists_and_delete():
    """Verify exists and delete methods."""
    cache: Cache = InMemoryTTLCache()
    await cache.set("forecast:paris", "cloudy")

    assert await cache.exists("forecast:paris") is True
    deleted = await cache.delete("forecast:paris")
    assert deleted is True
    assert await cache.exists("forecast:paris") is False
    assert await cache.get("forecast:paris") is None

    # Deleting already deleted key returns False
    assert await cache.delete("forecast:paris") is False


@pytest.mark.asyncio
async def test_cache_clear():
    """Clearing removes all items."""
    cache: Cache = InMemoryTTLCache()
    await cache.set("k1", "v1")
    await cache.set("k2", "v2")
    assert await cache.size() == 2

    await cache.clear()
    assert await cache.size() == 0
    assert await cache.get("k1") is None
    assert await cache.get("k2") is None


@pytest.mark.asyncio
async def test_cache_ttl_expiration():
    """Key automatically expires after TTL seconds."""
    cache: Cache = InMemoryTTLCache()
    # Set with 0.1s TTL
    await cache.set("quick_key", "temporary", ttl_seconds=0.1)

    # Immediately available
    assert await cache.get("quick_key") == "temporary"
    assert await cache.exists("quick_key") is True

    # Wait for expiration
    await asyncio.sleep(0.15)

    assert await cache.get("quick_key") is None
    assert await cache.exists("quick_key") is False
