"""Document chunking and text cleaning pipeline for meteorological knowledge corpus."""

from __future__ import annotations
import hashlib
import re
from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class DocumentChunk:
    """A clean, token-bounded document chunk with metadata."""
    chunk_id: str
    doc_id: str
    content: str
    title: str
    publisher: str
    source_url: str
    publication_date: str
    license_notes: str
    chunk_index: int
    token_count: int


def parse_frontmatter(raw_text: str) -> tuple[dict[str, str], str]:
    """Extract YAML-style frontmatter from markdown text."""
    metadata: dict[str, str] = {
        "title": "Untitled Document",
        "publisher": "WeatherGPT Knowledgebase",
        "source_url": "",
        "publication_date": "",
        "license_notes": "Project-authored; CC-BY-4.0",
    }
    body = raw_text

    frontmatter_match = re.match(r"^---\s*\n(.*?)\n---\s*\n", raw_text, re.DOTALL)
    if frontmatter_match:
        fm_content = frontmatter_match.group(1)
        body = raw_text[frontmatter_match.end():]
        for line in fm_content.splitlines():
            line = line.strip()
            if not line or line.startswith("#") or ":" not in line:
                continue
            k, v = line.split(":", 1)
            clean_k = k.strip()
            clean_v = v.strip().strip('"').strip("'")
            if clean_k in metadata or clean_k in [
                "title",
                "publisher",
                "source_url",
                "publication_date",
                "license_notes",
            ]:
                metadata[clean_k] = clean_v

    return metadata, body.strip()


def clean_markdown_text(text: str) -> str:
    """Normalize whitespace and strip unnecessary formatting while preserving structure."""
    # Replace multiple empty lines with double newline
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Strip carriage returns
    text = text.replace("\r", "")
    return text.strip()


def approximate_token_count(text: str) -> int:
    """Approximate word/token count using whitespace & punctuation splits (~1.3 tokens per word)."""
    words = len(text.split())
    return int(words * 1.3)


def chunk_text(
    text: str,
    target_token_min: int = 500,
    target_token_max: int = 800,
    overlap_tokens: int = 75,
) -> list[str]:
    """Chunk text into token-bounded sections respecting paragraph/sentence boundaries."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        return []

    # If the total document is small enough (under target_token_max tokens), return as single chunk
    total_tokens = approximate_token_count(text)
    if total_tokens <= target_token_max:
        return [text]

    chunks: list[str] = []
    current_paragraphs: list[str] = []
    current_tokens = 0

    for para in paragraphs:
        para_tokens = approximate_token_count(para)
        
        # If adding this paragraph exceeds target_token_max and we have content
        if current_paragraphs and (current_tokens + para_tokens > target_token_max):
            chunk_str = "\n\n".join(current_paragraphs).strip()
            chunks.append(chunk_str)

            # Keep overlap: take the last paragraph if small, or part of it
            overlap_accum: list[str] = []
            overlap_count = 0
            for p in reversed(current_paragraphs):
                p_tok = approximate_token_count(p)
                if overlap_count + p_tok <= overlap_tokens or not overlap_accum:
                    overlap_accum.insert(0, p)
                    overlap_count += p_tok
                else:
                    break

            current_paragraphs = list(overlap_accum)
            current_tokens = sum(approximate_token_count(p) for p in current_paragraphs)

        current_paragraphs.append(para)
        current_tokens += para_tokens

    if current_paragraphs:
        chunk_str = "\n\n".join(current_paragraphs).strip()
        if not chunks or chunk_str != chunks[-1]:
            chunks.append(chunk_str)

    return chunks


def process_document(
    doc_id: str,
    raw_markdown: str,
    target_token_min: int = 500,
    target_token_max: int = 800,
    overlap_tokens: int = 75,
) -> list[DocumentChunk]:
    """End-to-end processing: parse metadata, clean, dedupe, and chunk."""
    metadata, body = parse_frontmatter(raw_markdown)
    cleaned_body = clean_markdown_text(body)

    raw_chunks = chunk_text(
        cleaned_body,
        target_token_min=target_token_min,
        target_token_max=target_token_max,
        overlap_tokens=overlap_tokens,
    )

    result: list[DocumentChunk] = []
    seen_hashes: set[str] = set()

    for idx, chunk_content in enumerate(raw_chunks):
        # Deduplication check
        chunk_hash = hashlib.sha256(chunk_content.encode("utf-8")).hexdigest()
        if chunk_hash in seen_hashes:
            continue
        seen_hashes.add(chunk_hash)

        chunk_id = f"{doc_id}_chunk_{idx}"
        tok_cnt = approximate_token_count(chunk_content)

        result.append(
            DocumentChunk(
                chunk_id=chunk_id,
                doc_id=doc_id,
                content=chunk_content,
                title=metadata.get("title", doc_id),
                publisher=metadata.get("publisher", "WeatherGPT"),
                source_url=metadata.get("source_url", ""),
                publication_date=metadata.get("publication_date", ""),
                license_notes=metadata.get("license_notes", "CC-BY-4.0"),
                chunk_index=idx,
                token_count=tok_cnt,
            )
        )

    return result
