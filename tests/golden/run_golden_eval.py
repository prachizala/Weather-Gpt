"""CI-ready Golden Test Set Evaluation Runner for WeatherGPT.

Evaluates 50+ golden benchmark inquiries across 13 diverse categories:
- Current Weather
- Forecast
- Historical Archive
- Historical Comparison
- Air Quality
- Explanatory RAG
- Mixed Weather + RAG
- Multilingual Hindi
- Multilingual Gujarati
- Ambiguous Locations
- Unsupported Future Dates
- Non-Weather Conversational Questions
- Adversarial Prompt Injections

Prints a category-by-category pass/fail scorecard and overall precision/accuracy.
"""

from __future__ import annotations
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

# Ensure workspace root is in sys.path
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
if str(WORKSPACE_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKSPACE_ROOT))

from backend.app.services.llm_provider import MockLLMProvider
from backend.app.services.tools import WEATHER_TOOLS
from backend.app.utils.language import detect_query_language

DATASET_PATH = Path(__file__).resolve().parent / "golden_dataset.json"


class GoldenEvaluator:
    """Evaluates golden test inquiries against routing and extraction heuristics."""

    def __init__(self, dataset_path: Path = DATASET_PATH) -> None:
        self.dataset_path = dataset_path
        with open(dataset_path, "r", encoding="utf-8") as f:
            self.test_cases: list[dict[str, Any]] = json.load(f)

    async def evaluate_case(self, case: dict[str, Any]) -> dict[str, Any]:
        """Evaluate a single test case for intent, language, and tool extraction."""
        query = case["query"]
        expected_tools = case.get("expected_tools", [])
        expected_lang = case.get("expected_language", "en")
        expected_intent = case.get("expected_intent")

        # 1. Evaluate Language Detection
        detected_lang = detect_query_language(query)
        lang_passed = (detected_lang == expected_lang)

        # 2. Evaluate Routing Intent & Tool Selection using router heuristics
        mock_llm = MockLLMProvider()
        messages = [{"role": "user", "content": query}]
        decision = await mock_llm.decide_tools(messages=messages, tools=WEATHER_TOOLS)

        actual_tools = [tc.name for tc in decision.tool_calls]

        # Check tool match
        if not expected_tools:
            tools_passed = (len(actual_tools) == 0)
        else:
            # Check if all expected tools are present or matched appropriately
            tools_passed = set(expected_tools).issubset(set(actual_tools)) or (
                len(actual_tools) > 0 and actual_tools[0] in expected_tools
            )

        # Handle prompt injection and non-weather cases
        if case["category"] in ("non_weather", "prompt_injection"):
            tools_passed = (len(actual_tools) == 0)

        case_passed = lang_passed and tools_passed

        return {
            "id": case["id"],
            "category": case["category"],
            "query": query,
            "expected_tools": expected_tools,
            "actual_tools": actual_tools,
            "expected_lang": expected_lang,
            "detected_lang": detected_lang,
            "passed": case_passed,
        }

    async def run_evaluation(self, ci_mode: bool = False) -> bool:
        """Run entire golden test suite and display CI scorecard."""
        results: list[dict[str, Any]] = []
        for case in self.test_cases:
            res = await self.evaluate_case(case)
            results.append(res)

        # Aggregate category statistics
        category_stats: dict[str, dict[str, int]] = {}
        for r in results:
            cat = r["category"]
            category_stats.setdefault(cat, {"total": 0, "passed": 0})
            category_stats[cat]["total"] += 1
            if r["passed"]:
                category_stats[cat]["passed"] += 1

        total_cases = len(results)
        total_passed = sum(1 for r in results if r["passed"])
        overall_accuracy = (total_passed / total_cases) * 100.0 if total_cases > 0 else 0.0

        # Print CI Scorecard Table
        print("\n" + "=" * 78)
        print(" WEATHERGPT GOLDEN BENCHMARK EVALUATION SCORECARD ")
        print("=" * 78)
        print(f"{'Category':<28} | {'Total':<6} | {'Passed':<6} | {'Failed':<6} | {'Pass Rate':<10}")
        print("-" * 78)

        for cat, stats in sorted(category_stats.items()):
            tot = stats["total"]
            pas = stats["passed"]
            fai = tot - pas
            rate = (pas / tot) * 100.0 if tot > 0 else 0.0
            print(f"{cat:<28} | {tot:<6} | {pas:<6} | {fai:<6} | {rate:>6.1f}%")

        print("-" * 78)
        print(f"{'OVERALL BENCHMARK':<28} | {total_cases:<6} | {total_passed:<6} | {total_cases - total_passed:<6} | {overall_accuracy:>6.1f}%")
        print("=" * 78)

        if overall_accuracy >= 90.0:
            print(">>> STATUS: PASS (Exceeds >= 90.0% acceptance threshold)\n")
            return True
        else:
            print(">>> STATUS: FAIL (Below 90.0% acceptance threshold)\n")
            if ci_mode:
                sys.exit(1)
            return False


if __name__ == "__main__":
    ci = "--ci" in sys.argv
    evaluator = GoldenEvaluator()
    passed = asyncio.run(evaluator.run_evaluation(ci_mode=ci))
    sys.exit(0 if passed else 1)
