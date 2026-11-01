"""Exceptions for WeatherGPT provider integrations and service errors."""

from __future__ import annotations


class WeatherGPTException(Exception):
    """Base exception for WeatherGPT service errors."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        status_code: int = 500,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


class UpstreamServiceError(WeatherGPTException):
    """Raised when an upstream provider (e.g. Open-Meteo) fails or returns a 5xx error."""

    def __init__(
        self,
        message: str,
        code: str = "UPSTREAM_SERVICE_ERROR",
        status_code: int = 502,
    ) -> None:
        super().__init__(message, code=code, status_code=status_code)


class UpstreamTimeoutError(UpstreamServiceError):
    """Raised when an upstream provider request times out."""

    def __init__(
        self,
        message: str = "Upstream weather provider timed out",
        code: str = "UPSTREAM_TIMEOUT",
        status_code: int = 504,
    ) -> None:
        super().__init__(message, code=code, status_code=status_code)


class UpstreamDataError(WeatherGPTException):
    """Raised when an upstream provider returns malformed, unparseable, or missing data."""

    def __init__(
        self,
        message: str,
        code: str = "UPSTREAM_DATA_ERROR",
        status_code: int = 502,
    ) -> None:
        super().__init__(message, code=code, status_code=status_code)


class LocationNotFoundError(WeatherGPTException):
    """Raised when a location query cannot be resolved to any geographic entity."""

    def __init__(
        self,
        message: str = "Location not found",
        code: str = "LOCATION_NOT_FOUND",
        status_code: int = 404,
    ) -> None:
        super().__init__(message, code=code, status_code=status_code)


class InvalidParameterError(WeatherGPTException):
    """Raised when request query parameters are invalid or out of allowed bounds."""

    def __init__(
        self,
        message: str,
        code: str = "INVALID_PARAMETER",
        status_code: int = 400,
    ) -> None:
        super().__init__(message, code=code, status_code=status_code)
