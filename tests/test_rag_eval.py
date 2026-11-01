"""Pytest integration test for RAG evaluation benchmark."""

import pytest
from tests.rag.evaluate_rag import evaluate_rag_benchmark


def test_rag_evaluation_benchmark():
    """Verify that RAG retrieval achieves >= 80% Top-1 hit rate and validates citations."""
    metrics = evaluate_rag_benchmark()
    assert metrics["top1_rate"] >= 80.0, f"Top-1 hit rate {metrics['top1_rate']}% is below 80.0% threshold"
    assert metrics["mrr"] >= 0.80, f"MRR {metrics['mrr']} is below 0.80 threshold"
    assert metrics["insufficient_evidence_passed"], "Out-of-domain query was not rejected by relevance threshold"
