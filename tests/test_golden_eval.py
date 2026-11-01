"""Pytest integration test for Golden Benchmark Evaluation."""

import pytest
from tests.golden.run_golden_eval import GoldenEvaluator


@pytest.mark.asyncio
async def test_golden_benchmark_suite():
    """Verify that the 52-question golden dataset meets or exceeds 90% benchmark pass rate."""
    evaluator = GoldenEvaluator()
    passed = await evaluator.run_evaluation(ci_mode=False)
    assert passed, "Golden evaluation suite failed to achieve >= 90.0% pass rate."
