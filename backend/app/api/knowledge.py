"""REST endpoint for querying explanatory meteorological knowledge."""

from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException

from backend.app.rag.retriever import retriever
from backend.app.schemas.chat import SourceRef

router = APIRouter(prefix="/knowledge", tags=["Knowledge"])


class KnowledgeSearchRequest(BaseModel):
    """Payload for searching explanatory meteorological corpus."""
    query: str = Field(..., min_length=1, description="Meteorological search query or scientific question")
    limit: int = Field(default=4, ge=1, le=10, description="Maximum number of chunks to return")


class KnowledgeChunkResponse(BaseModel):
    """A retrieved knowledge chunk."""
    chunk_id: str
    content: str
    score: float
    metadata: dict[str, Any]


class KnowledgeSearchResponse(BaseModel):
    """Response containing retrieved knowledge chunks and citations."""
    query: str
    sufficient_evidence: bool
    message: Optional[str] = None
    chunks: list[KnowledgeChunkResponse] = Field(default_factory=list)
    citations: list[SourceRef] = Field(default_factory=list)


@router.post("/search", response_model=KnowledgeSearchResponse)
async def search_knowledge(request: KnowledgeSearchRequest) -> KnowledgeSearchResponse:
    """Search the meteorological knowledge base for explanatory scientific facts."""
    res = retriever.search(query=request.query, n_results=request.limit)

    chunk_objects = [
        KnowledgeChunkResponse(
            chunk_id=c.get("chunk_id", ""),
            content=c.get("content", ""),
            score=c.get("score", 0.0),
            metadata=c.get("metadata", {}),
        )
        for c in res.chunks
    ]

    return KnowledgeSearchResponse(
        query=res.query,
        sufficient_evidence=res.sufficient_evidence,
        message=res.message,
        chunks=chunk_objects,
        citations=res.citations,
    )
