"""ChromaDB vector store wrapper for meteorological knowledge base."""

from __future__ import annotations
import logging
from dataclasses import asdict
from typing import Any, Optional
import chromadb
from chromadb.api.models.Collection import Collection

from backend.app.config import settings
from backend.app.rag.chunker import DocumentChunk

logger = logging.getLogger(__name__)


class KnowledgeStore:
    """Manages persistent ChromaDB vector storage for meteorological documents."""

    def __init__(
        self,
        persist_directory: Optional[str] = None,
        collection_name: Optional[str] = None,
        embedding_function: Optional[Any] = None,
    ) -> None:
        self.persist_directory = persist_directory or settings.rag_persist_directory
        self.collection_name = collection_name or settings.rag_collection_name
        self.embedding_function = embedding_function

        # Initialize PersistentClient
        self.client = chromadb.PersistentClient(path=self.persist_directory)

        # Retrieve or create target collection
        kwargs: dict[str, Any] = {"name": self.collection_name}
        if self.embedding_function is not None:
            kwargs["embedding_function"] = self.embedding_function

        self.collection: Collection = self.client.get_or_create_collection(**kwargs)

    def add_chunks(self, chunks: list[DocumentChunk]) -> int:
        """Add document chunks to the collection with metadata."""
        if not chunks:
            return 0

        ids = [c.chunk_id for c in chunks]
        documents = [c.content for c in chunks]
        metadatas = [
            {
                "doc_id": c.doc_id,
                "title": c.title,
                "publisher": c.publisher,
                "source_url": c.source_url,
                "publication_date": c.publication_date,
                "license_notes": c.license_notes,
                "chunk_index": c.chunk_index,
                "token_count": c.token_count,
            }
            for c in chunks
        ]

        # Use upsert to be idempotent
        self.collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
        )
        return len(chunks)

    def query(
        self,
        query_text: str,
        n_results: int = 4,
    ) -> list[dict[str, Any]]:
        """Query similar chunks, returning content, metadata, distance, and similarity score."""
        clean_q = query_text.strip()
        if not clean_q or self.collection.count() == 0:
            return []

        results = self.collection.query(
            query_texts=[clean_q],
            n_results=min(n_results, max(1, self.collection.count())),
            include=["documents", "metadatas", "distances"],
        )

        output: list[dict[str, Any]] = []
        if not results or not results.get("ids") or not results["ids"][0]:
            return output

        doc_ids = results["ids"][0]
        documents = results["documents"][0] if results.get("documents") else []
        metadatas = results["metadatas"][0] if results.get("metadatas") else []
        distances = results["distances"][0] if results.get("distances") else []

        for i in range(len(doc_ids)):
            dist = distances[i] if i < len(distances) else 1.0
            # Chroma default cosine distance is in [0, 2]; convert to similarity score in [0, 1]
            similarity_score = max(0.0, min(1.0, 1.0 - (dist / 2.0)))
            output.append(
                {
                    "chunk_id": doc_ids[i],
                    "content": documents[i] if i < len(documents) else "",
                    "metadata": metadatas[i] if i < len(metadatas) else {},
                    "distance": dist,
                    "score": round(similarity_score, 4),
                }
            )

        return output

    def count(self) -> int:
        """Return the total number of chunks currently stored in the collection."""
        return self.collection.count()

    def reset(self) -> None:
        """Clear all records in the collection."""
        self.client.delete_collection(self.collection_name)
        kwargs: dict[str, Any] = {"name": self.collection_name}
        if self.embedding_function is not None:
            kwargs["embedding_function"] = self.embedding_function
        self.collection = self.client.get_or_create_collection(**kwargs)


# Global singleton instance
knowledge_store = KnowledgeStore()
