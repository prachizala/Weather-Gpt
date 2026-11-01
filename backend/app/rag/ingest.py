"""CLI ingestion script to load, clean, deduplicate, chunk, and index meteorological knowledge into ChromaDB."""

from __future__ import annotations
import argparse
import glob
import logging
import os
import sys
from pathlib import Path

from backend.app.rag.chunker import process_document
from backend.app.rag.store import KnowledgeStore

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def ingest_documents(
    docs_dir: str = "data/documents",
    persist_dir: str = "data/chroma_db",
    reset_existing: bool = False,
) -> int:
    """Ingest markdown knowledge documents from docs_dir into ChromaDB."""
    path = Path(docs_dir)
    if not path.exists():
        logger.error("Documents directory does not exist: %s", docs_dir)
        return 0

    md_files = sorted(list(path.glob("*.md")))
    # Filter out README.md
    md_files = [f for f in md_files if f.name.lower() != "readme.md"]

    if not md_files:
        logger.warning("No markdown documents found in %s", docs_dir)
        return 0

    logger.info("Found %d markdown documents to ingest from %s", len(md_files), docs_dir)

    store = KnowledgeStore(persist_directory=persist_dir)
    if reset_existing:
        logger.info("Resetting existing collection in %s", persist_dir)
        store.reset()

    total_chunks = 0
    all_chunks = []

    for file_path in md_files:
        doc_id = file_path.stem
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            chunks = process_document(doc_id=doc_id, raw_markdown=content)
            all_chunks.extend(chunks)
            logger.info("Parsed %s -> %d chunk(s)", file_path.name, len(chunks))
        except Exception as e:
            logger.error("Failed to parse document %s: %e", file_path.name, e)

    if all_chunks:
        added_count = store.add_chunks(all_chunks)
        total_chunks = added_count
        logger.info("Successfully indexed %d total chunks into ChromaDB at %s", total_chunks, persist_dir)

    return total_chunks


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest meteorological knowledge documents into ChromaDB.")
    parser.add_argument(
        "--docs-dir",
        default="data/documents",
        help="Path to folder containing markdown documents (default: data/documents)",
    )
    parser.add_argument(
        "--persist-dir",
        default="data/chroma_db",
        help="Path to ChromaDB storage directory (default: data/chroma_db)",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Clear existing collection before ingesting",
    )

    args = parser.parse_args()
    count = ingest_documents(
        docs_dir=args.docs_dir,
        persist_dir=args.persist_dir,
        reset_existing=args.reset,
    )
    print(f"Ingestion complete. Total chunks indexed: {count}")


if __name__ == "__main__":
    main()
