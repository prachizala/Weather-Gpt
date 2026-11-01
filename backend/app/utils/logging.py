"""Structured JSON logging with security redaction of secrets, tokens, and PII."""

from __future__ import annotations
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

# Sensitive patterns to redact automatically from all logs
REDACTION_PATTERNS = [
    (re.compile(r"(key|apikey|api_key|token|password|secret|auth)=([^\s&]+)", re.IGNORECASE), r"\1=***REDACTED***"),
    (re.compile(r"Bearer\s+([A-Za-z0-9\-\._~\+\/]+=*)", re.IGNORECASE), "Bearer ***REDACTED***"),
    (re.compile(r"sk-or-[0-9A-Za-z\-_]{16,}"), "***REDACTED_OPENROUTER_KEY***"),
]


def redact_sensitive_data(text: str) -> str:
    """Mask credentials, tokens, and sensitive query parameters from log text."""
    if not isinstance(text, str):
        text = str(text)
    for pattern, replacement in REDACTION_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


class StructuredJsonFormatter(logging.Formatter):
    """Logging formatter producing standardized, sanitized JSON records."""

    def format(self, record: logging.LogRecord) -> str:
        log_obj: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": redact_sensitive_data(record.getMessage()),
        }

        # Include structured extra fields if present
        for field in ("method", "path", "status_code", "duration_ms", "stage_latencies", "error_type", "provider"):
            if hasattr(record, field):
                val = getattr(record, field)
                if isinstance(val, str):
                    val = redact_sensitive_data(val)
                log_obj[field] = val

        if record.exc_info:
            log_obj["exception"] = redact_sensitive_data(self.formatException(record.exc_info))

        return json.dumps(log_obj, ensure_ascii=False)


def configure_structured_logging(level: int = logging.INFO) -> None:
    """Configure root logger with StructuredJsonFormatter for production and Docker."""
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Replace existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(StructuredJsonFormatter())
    root_logger.addHandler(console_handler)
