"""Session context manager maintaining selected location and bounded last 6 conversation turns."""

from __future__ import annotations
from collections import deque
from datetime import datetime, timezone
from typing import Any, Optional
import uuid
from pydantic import BaseModel, Field
from backend.app.schemas.location import Location


class ChatTurn(BaseModel):
    """Single turn in a conversation."""
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    tool_calls: Optional[list[dict[str, Any]]] = None


class SessionState(BaseModel):
    """Session state carrying selected location and last 6 turns."""
    session_id: str
    selected_location: Optional[Location] = None
    turns: list[ChatTurn] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def add_turn(self, role: str, content: str, tool_calls: Optional[list[dict[str, Any]]] = None) -> None:
        """Add a turn and keep turns bounded to the last 6 turns."""
        self.turns.append(ChatTurn(role=role, content=content, tool_calls=tool_calls))
        if len(self.turns) > 6:
            self.turns = self.turns[-6:]
        self.updated_at = datetime.now(timezone.utc)

    def set_location(self, location: Location) -> None:
        """Update the currently active location for the session."""
        self.selected_location = location
        self.updated_at = datetime.now(timezone.utc)


class SessionStore:
    """Thread-safe in-memory session registry."""

    def __init__(self) -> None:
        self._sessions: dict[str, SessionState] = {}

    def get_or_create_session(self, session_id: Optional[str] = None) -> SessionState:
        """Retrieve existing session or instantiate a new one."""
        sid = session_id.strip() if session_id and session_id.strip() else str(uuid.uuid4())
        if sid not in self._sessions:
            self._sessions[sid] = SessionState(session_id=sid)
        return self._sessions[sid]

    def clear_session(self, session_id: str) -> bool:
        """Remove a session from storage."""
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False

    def clear_all(self) -> None:
        """Purge all sessions."""
        self._sessions.clear()


# Application global session registry
session_store = SessionStore()
