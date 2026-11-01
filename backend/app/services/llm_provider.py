"""LLM provider adapters supporting tool-calling and grounded meteorological generation."""

from datetime import datetime, timezone
import json
import logging
import re
import asyncio
from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator, Callable, Optional
import httpx
from pydantic import BaseModel, Field

from backend.app.config import settings
from backend.app.schemas.chat import ChatRequest, ChatResponse
from backend.app.services.exceptions import UpstreamServiceError
from backend.app.services.providers import LLMProvider

logger = logging.getLogger(__name__)


class ToolCall(BaseModel):
    """Normalized tool call request produced by the LLM."""
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    id: Optional[str] = None


class LLMDecision(BaseModel):
    """Model output containing either synthesized text or structured tool invocations."""
    content: Optional[str] = None
    tool_calls: list[ToolCall] = Field(default_factory=list)


class BaseChatLLMProvider(LLMProvider, ABC):
    """Abstract base class for conversational LLM providers supporting function calling."""

    @abstractmethod
    async def decide_tools(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        system_instruction: Optional[str] = None,
    ) -> LLMDecision:
        """Analyze message history and decide whether to invoke meteorological tools or respond directly."""
        pass

    @abstractmethod
    async def generate_grounded_explanation(
        self,
        user_query: str,
        payload: Any,
        valid_period: Optional[dict[str, Any]] = None,
        mismatches: Optional[list[float]] = None,
        system_instruction: Optional[str] = None,
        language: str = "en",
    ) -> str:
        """Synthesize a natural language explanation grounded strictly in the verified payload."""
        pass

    async def generate_grounded_explanation_stream(
        self,
        user_query: str,
        payload: Any,
        valid_period: Optional[dict[str, Any]] = None,
        system_instruction: Optional[str] = None,
        language: str = "en",
    ):
        """Yield tokens or text chunks in a stream for SSE."""
        # Default fallback implementation streams words of the full generated explanation
        full_text = await self.generate_grounded_explanation(
            user_query=user_query,
            payload=payload,
            valid_period=valid_period,
            system_instruction=system_instruction,
            language=language,
        )
        words = full_text.split(" ")
        for i, w in enumerate(words):
            chunk = w + (" " if i < len(words) - 1 else "")
            yield chunk

    async def generate_response(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        **kwargs: Any,
    ) -> str:
        decision = await self.decide_tools([{"role": "user", "content": prompt}], [], system_instruction)
        return decision.content or ""

    async def generate_chat(
        self,
        request: ChatRequest,
        **kwargs: Any,
    ) -> ChatResponse:
        decision = await self.decide_tools([{"role": "user", "content": request.message}], [])
        return ChatResponse(
            response=decision.content or "",
            conversation_id=request.conversation_id,
            provider="weather-gpt",
        )


# ---------------------------------------------------------------------------
# OpenRouter Tool Formatting Helper
# ---------------------------------------------------------------------------

def format_tools_for_openrouter(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Format tools list to standard OpenAI/OpenRouter function declaration format."""
    formatted = []
    for tool in tools:
        if "type" in tool and tool["type"] == "function":
            formatted.append(tool)
        else:
            formatted.append({
                "type": "function",
                "function": {
                    "name": tool.get("name", ""),
                    "description": tool.get("description", ""),
                    "parameters": tool.get("parameters", {}),
                },
            })
    return formatted


# ---------------------------------------------------------------------------
# OpenRouter LLM Provider (Live Implementation)
# ---------------------------------------------------------------------------

class OpenRouterProvider(BaseChatLLMProvider):
    """OpenRouter adapter using OpenAI-compatible REST API with tool declarations."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_main: Optional[str] = None,
        model_fast: Optional[str] = None,
        model_fallback: Optional[str] = None,
        base_url: Optional[str] = None,
        app_url: Optional[str] = None,
        app_title: Optional[str] = None,
        client: Optional[httpx.AsyncClient] = None,
        timeout: float = 25.0,
    ) -> None:
        self.api_key = api_key or settings.openrouter_api_key
        self.model_main = model_main or settings.llm_model_main
        self.model_fast = model_fast or settings.llm_model_fast
        self.model_fallback = model_fallback or settings.llm_model_fallback
        self.base_url = (base_url or settings.openrouter_base_url).rstrip("/")
        self.app_url = app_url or settings.app_url
        self.app_title = app_title or settings.app_title
        self._external_client = client
        self.timeout = timeout
        self._verified_models_cache: Optional[dict[str, Any]] = None

    def _get_headers(self) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if self.app_url:
            headers["HTTP-Referer"] = self.app_url
        if self.app_title:
            headers["X-Title"] = self.app_title
        return headers

    async def _get_client(self) -> httpx.AsyncClient:
        if self._external_client is not None:
            return self._external_client
        return httpx.AsyncClient(timeout=self.timeout)

    @staticmethod
    def build_tool_message(tool_call_id: str, tool_name: str, result: Any) -> dict[str, Any]:
        """Format a tool result message in OpenAI format."""
        content_str = json.dumps(result, default=str) if not isinstance(result, str) else result
        return {
            "role": "tool",
            "tool_call_id": tool_call_id,
            "name": tool_name,
            "content": content_str,
        }

    async def verify_models_on_startup(self, client: Optional[httpx.AsyncClient] = None) -> dict[str, Any]:
        """Verify on boot that LLM_MODEL_MAIN and LLM_MODEL_FAST exist and support tools."""
        if self._verified_models_cache is not None:
            return self._verified_models_cache

        if not self.api_key:
            return {}

        url = f"{self.base_url}/models"
        headers = self._get_headers()
        c = client or await self._get_client()
        should_close = client is None and self._external_client is None

        try:
            resp = await c.get(url, headers=headers)
            if resp.status_code == 401:
                raise UpstreamServiceError("LLM key invalid: please check your OPENROUTER_API_KEY configuration.")
            if resp.status_code != 200:
                raise RuntimeError(f"OpenRouter models verification failed with status {resp.status_code}")

            data = resp.json()
            models_list = data.get("data", [])
            models_by_id = {m.get("id"): m for m in models_list}

            for model_slug, role in [
                (self.model_fast, "Fast model (LLM_MODEL_FAST)"),
                (self.model_main, "Main model (LLM_MODEL_MAIN)"),
            ]:
                if model_slug not in models_by_id:
                    raise ValueError(
                        f"Configured OpenRouter model '{model_slug}' for {role} was not found on OpenRouter."
                    )
                model_meta = models_by_id[model_slug]
                supported_params = model_meta.get("supported_parameters")
                if supported_params is not None and "tools" not in supported_params:
                    raise ValueError(
                        f"Configured OpenRouter model '{model_slug}' for {role} does not support tools."
                    )

            self._verified_models_cache = models_by_id
            return self._verified_models_cache
        finally:
            if should_close:
                await c.aclose()

    async def _execute_with_retry_and_fallback(
        self,
        payload: dict[str, Any],
        client: httpx.AsyncClient,
        stream: bool = False,
    ) -> httpx.Response:
        url = f"{self.base_url}/chat/completions"
        headers = self._get_headers()
        target_model = payload.get("model", self.model_main)

        async def _run_for_model(model_name: str) -> tuple[Optional[httpx.Response], Optional[Exception]]:
            req_data = {**payload, "model": model_name}
            max_retries = 2
            last_err = None
            for attempt in range(max_retries + 1):
                try:
                    if stream:
                        req = client.build_request("POST", url, headers=headers, json=req_data)
                        resp = await client.send(req, stream=True)
                    else:
                        resp = await client.post(url, headers=headers, json=req_data)

                    if resp.status_code == 401:
                        if stream:
                            await resp.aclose()
                        raise UpstreamServiceError("LLM key invalid: please check your OPENROUTER_API_KEY configuration.")
                    elif resp.status_code == 402:
                        if stream:
                            await resp.aclose()
                        raise UpstreamServiceError("LLM service out of credits: please check your OpenRouter account balance.")
                    elif resp.status_code == 429:
                        if stream:
                            await resp.aclose()
                        raise UpstreamServiceError("LLM rate limited, retry shortly.")
                    elif resp.status_code >= 500:
                        if stream:
                            await resp.aclose()
                        if attempt < max_retries:
                            await asyncio.sleep(0.1 * (2 ** attempt))
                            continue
                        return resp, None
                    return resp, None
                except UpstreamServiceError:
                    raise
                except Exception as exc:
                    last_err = exc
                    if attempt < max_retries:
                        await asyncio.sleep(0.1 * (2 ** attempt))
                        continue
            return None, last_err

        resp, err = await _run_for_model(target_model)
        if resp is not None and resp.status_code < 500:
            return resp

        # Fallback to secondary model if configured and different
        if self.model_fallback and target_model != self.model_fallback:
            logger.warning(
                "Primary model %s failed with status %s. Falling back to %s",
                target_model,
                resp.status_code if resp is not None else "error",
                self.model_fallback,
            )
            fb_resp, fb_err = await _run_for_model(self.model_fallback)
            if fb_resp is not None and fb_resp.status_code < 500:
                return fb_resp

        raise UpstreamServiceError("LLM service temporarily unavailable: please retry shortly.")

    async def decide_tools(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        system_instruction: Optional[str] = None,
    ) -> LLMDecision:
        if not self.api_key:
            raise UpstreamServiceError("OPENROUTER_API_KEY environment variable is not configured.")

        formatted_messages: list[dict[str, Any]] = []
        if system_instruction:
            formatted_messages.append({"role": "system", "content": system_instruction})

        for m in messages:
            role = m.get("role", "user")
            content = m.get("content")
            item: dict[str, Any] = {"role": role, "content": content}
            if "tool_calls" in m:
                item["tool_calls"] = m["tool_calls"]
            if "tool_call_id" in m:
                item["tool_call_id"] = m["tool_call_id"]
            if "name" in m:
                item["name"] = m["name"]
            formatted_messages.append(item)

        req_body: dict[str, Any] = {
            "model": self.model_fast,
            "messages": formatted_messages,
        }
        if tools:
            req_body["tools"] = format_tools_for_openrouter(tools)

        client = await self._get_client()
        should_close = self._external_client is None

        try:
            resp = await self._execute_with_retry_and_fallback(req_body, client, stream=False)
            data = resp.json()
            choices = data.get("choices", [])
            if not choices:
                return LLMDecision(content="I could not process your query at this time.")

            msg = choices[0].get("message", {})
            raw_tool_calls = msg.get("tool_calls") or []

            parsed_tool_calls: list[ToolCall] = []
            for tc in raw_tool_calls:
                func = tc.get("function", {})
                args = func.get("arguments", "{}")
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except json.JSONDecodeError:
                        args = {}
                parsed_tool_calls.append(
                    ToolCall(
                        name=func.get("name", ""),
                        arguments=args if isinstance(args, dict) else {},
                        id=tc.get("id"),
                    )
                )

            return LLMDecision(
                content=msg.get("content") or None,
                tool_calls=parsed_tool_calls,
            )
        finally:
            if should_close:
                await client.aclose()

    async def generate_grounded_explanation(
        self,
        user_query: str,
        payload: Any,
        valid_period: Optional[dict[str, Any]] = None,
        mismatches: Optional[list[float]] = None,
        system_instruction: Optional[str] = None,
        language: str = "en",
    ) -> str:
        if not self.api_key:
            raise UpstreamServiceError("OPENROUTER_API_KEY is not configured.")

        payload_json = json.dumps(
            payload.model_dump(mode="json") if hasattr(payload, "model_dump") else payload,
            default=str,
        )

        correction_clause = ""
        if mismatches:
            correction_clause = (
                f"\nIMPORTANT CORRECTION: Your previous answer contained unauthorized numbers: {mismatches}. "
                "You must rewrite the explanation using ONLY numbers present in the verified payload."
            )

        prompt = (
            f"User Question: {user_query}\n\n"
            f"Verified Meteorological Payload: {payload_json}\n"
            f"Target Time Window: {json.dumps(valid_period, default=str)}\n"
            f"{correction_clause}\n\n"
            "Answer the user's question clearly, concisely, conversationally, and factually using ONLY the information and numbers from the payload."
        )

        sys_inst = (
            system_instruction
            or "You are WeatherGPT. State verified weather conditions factually using ONLY the payload. Never fabricate or hallucinate numbers."
        )

        req_body: dict[str, Any] = {
            "model": self.model_main,
            "messages": [
                {"role": "system", "content": sys_inst},
                {"role": "user", "content": prompt},
            ],
        }

        client = await self._get_client()
        should_close = self._external_client is None

        try:
            resp = await self._execute_with_retry_and_fallback(req_body, client, stream=False)
            data = resp.json()
            choices = data.get("choices", [])
            if not choices:
                return ""
            msg = choices[0].get("message", {})
            return msg.get("content") or ""
        finally:
            if should_close:
                await client.aclose()

    async def generate_grounded_explanation_stream(
        self,
        user_query: str,
        payload: Any,
        valid_period: Optional[dict[str, Any]] = None,
        system_instruction: Optional[str] = None,
        language: str = "en",
    ) -> AsyncGenerator[str, None]:
        if not self.api_key:
            raise UpstreamServiceError("OPENROUTER_API_KEY is not configured.")

        payload_json = json.dumps(
            payload.model_dump(mode="json") if hasattr(payload, "model_dump") else payload,
            default=str,
        )

        prompt = (
            f"User Question: {user_query}\n\n"
            f"Verified Meteorological Payload: {payload_json}\n"
            f"Target Time Window: {json.dumps(valid_period, default=str)}\n\n"
            "Answer the user's question clearly, concisely, conversationally, and factually using ONLY the information and numbers from the payload."
        )

        sys_inst = (
            system_instruction
            or "You are WeatherGPT. State verified weather conditions factually using ONLY the payload. Never fabricate or hallucinate numbers."
        )

        req_body: dict[str, Any] = {
            "model": self.model_main,
            "messages": [
                {"role": "system", "content": sys_inst},
                {"role": "user", "content": prompt},
            ],
            "stream": True,
        }

        client = await self._get_client()
        should_close = self._external_client is None

        try:
            resp = await self._execute_with_retry_and_fallback(req_body, client, stream=True)
            async for line in resp.aiter_lines():
                line = line.strip()
                if not line:
                    continue
                if line.startswith("data:"):
                    raw_data = line[len("data:"):].strip()
                    if raw_data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(raw_data)
                        choices = chunk.get("choices", [])
                        if choices:
                            delta = choices[0].get("delta", {})
                            content = delta.get("content")
                            if content:
                                yield content
                    except json.JSONDecodeError:
                        continue
        finally:
            if should_close:
                await client.aclose()



# ---------------------------------------------------------------------------
# Mock LLM Provider (Hermetic Testing Implementation)
# ---------------------------------------------------------------------------

class MockLLMProvider(BaseChatLLMProvider):
    """Deterministic mock LLM adapter for testing routing, number verification, and tool dispatch."""

    def __init__(
        self,
        canned_tool_call: Optional[ToolCall] = None,
        canned_content: Optional[str] = None,
        injected_bad_numbers: bool = False,
    ) -> None:
        self.canned_tool_call = canned_tool_call
        self.canned_content = canned_content
        self.injected_bad_numbers = injected_bad_numbers
        self.generation_attempts = 0

    async def decide_tools(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        system_instruction: Optional[str] = None,
    ) -> LLMDecision:
        if self.canned_tool_call is not None:
            return LLMDecision(tool_calls=[self.canned_tool_call])
        if self.canned_content is not None:
            return LLMDecision(content=self.canned_content)

        last_msg = messages[-1].get("content", "").lower() if messages else ""
        raw_last_msg = messages[-1].get("content", "") if messages else ""

        # 1. Prompt injection / security overrides
        prompt_injections = [
            "override", "unrestricted", "jailbroken", "system instruction",
            "ignore all", "drop table", "<script>", "secret api key", "dump the server"
        ]
        if any(w in last_msg for w in prompt_injections):
            return LLMDecision(
                content="I am WeatherGPT, your friendly meteorological assistant. I cannot fulfill system override requests or disclose server configurations. How can I help you with weather or climate questions today?"
            )

        # 2. Conversational greetings and friendly human chat
        from backend.app.utils.language import detect_query_language
        lang = detect_query_language(raw_last_msg)

        conversational_greetings = [
            "hi", "hello", "hey", "namaste", "namaskar", "kem cho", "kya haal",
            "kaise ho", "kaisa hai", "who are you", "what can you do", "who created you",
            "who made you", "help me", "kya kar sakte ho", "tell me about yourself",
            "good morning", "good evening", "good afternoon", "shubh prabhat",
            "kya haal chaal", "kaise ho aap", "kya kar rahe ho", "kya chal raha hai",
            "how are you", "what is your name", "aapka naam", "thank you", "thanks",
            "dhanyawad", "aabhar", "shukriya"
        ]
        has_weather_intent = any(w in last_msg for w in ["weather", "mausam", "temperature", "rain", "havaman", "barish", "tapman", "forecast", "aqi", "pollution"])
        if any(g in last_msg for g in conversational_greetings) and not has_weather_intent:
            if lang == "hi":
                reply = "नमस्ते! मैं बिल्कुल ठीक हूँ। मैं WeatherGPT हूँ—आपका मौसम और दैनिक सहायक। आप कैसे हैं? आज मैं आपकी क्या मदद कर सकता हूँ?"
            elif lang == "gu":
                reply = "નમસ્તે! હું મજામાં છું. હું WeatherGPT છું—તમારો હવામાન સહાયક. તમે કેમ છો? આજે હું તમને શું મદદ કરી શકું?"
            else:
                reply = "Hello! I am doing great, thank you for asking. I'm WeatherGPT, your friendly weather and everyday assistant. How are you doing today, and how can I help you?"
            return LLMDecision(content=reply)

        # 3. Specific non-weather queries (Shakespeare, Python palindrome, etc.)
        if "shakespeare" in last_msg or "plays did he write" in last_msg:
            return LLMDecision(
                content="William Shakespeare (1564–1616) was an English playwright, poet, and actor, widely regarded as the greatest writer in the English language. His famous plays include Hamlet, Romeo and Juliet, Macbeth, and Othello. Interestingly, Shakespeare frequently used vivid meteorological imagery, such as the dramatic storm on the heath in King Lear!"
            )
        if "python" in last_msg and "palindrome" in last_msg:
            return LLMDecision(
                content="Here is a concise Python function to check for a palindrome:\n\n```python\ndef is_palindrome(word: str) -> bool:\n    clean = word.lower().replace(' ', '')\n    return clean == clean[::-1]\n```\n\nFor example, `is_palindrome('radar')` returns `True`."
            )
        if any(w in last_msg for w in ["recipe", "pasta", "capital of", "code in python", "history of france", "solve math", "mona lisa", "function to"]):
            return LLMDecision(
                content="I'm WeatherGPT! I'd be glad to help. While my primary specialty is weather, atmospheric science, and meteorological planning, I'm always happy to converse and assist you with your questions. Feel free to ask about any city's weather, forecast, air quality, or outdoor advice!"
            )

        # Look for city candidate in current message or previous turns
        known_cities = [
            ("ahmedabad", ["ahmedabad", "अहमदाबाद", "અમદાવાદ"]),
            ("london", ["london", "लंदन", "લંડન"]),
            ("delhi", ["delhi", "दिल्ली", "દિલ્હી"]),
            ("mumbai", ["mumbai", "मुंबई", "મુંબઈ"]),
            ("paris", ["paris", "पेरिस", "પેરિસ"]),
            ("bengaluru", ["bengaluru", "bangalore", "बेंगलुरु", "બેંગલુરુ"]),
            ("chicago", ["chicago", "शिकागो"]),
            ("sydney", ["sydney", "सिडनी"]),
            ("jaipur", ["jaipur", "जयपुर", "જયપુર"]),
            ("berlin", ["berlin", "बर्लिन"]),
            ("pune", ["pune", "पुणे"]),
            ("chennai", ["chennai", "चेन्नई"]),
            ("kolkata", ["kolkata", "कलकत्ता", "કોલકાતા"]),
            ("beijing", ["beijing", "बीजिंग"]),
            ("surat", ["surat", "सूरत", "સુરત"]),
            ("rajkot", ["rajkot", "राजकोट", "રાજકોટ"]),
            ("springfield", ["springfield"]),
            ("san jose", ["san jose"]),
            ("columbia", ["columbia"]),
            ("new york", ["new york", "न्यूयॉर्क"]),
            ("tokyo", ["tokyo", "टोक्यो", "ટોક્યો"]),
        ]

        city = None
        for m in reversed(messages):
            c_text = m.get("content", "").lower()
            for std_name, aliases in known_cities:
                if any(alias in c_text for alias in aliases):
                    city = std_name.title()
                    break
            if city:
                break
            if "nonexistent" in c_text:
                city = "NonExistentCity999XYZ"
                break

        location_args = {"location": city} if city else {}

        # 1. Historical comparison queries
        comparison_triggers = [
            "compare rainfall", "previous five", "previous 5", "past 5 years",
            "compare temperature", "historical comparison", "benchmark comparison",
            "how does rainfall this month compare", "પહેલાના પાંચ", "સરખામણી", "तुलना"
        ]
        if any(ct in last_msg for ct in comparison_triggers):
            return LLMDecision(
                tool_calls=[ToolCall(name="get_history_comparison", arguments={**location_args, "start": "this October"})]
            )

        # 2. Mixed Questions: combines live weather with conceptual knowledge (RAG)
        mixed_triggers = [
            "feel hotter than", "feels hotter than", "feel colder than",
            "heat index today", "apparent temperature today", "why does it feel",
            "humidity making", "muggy right now", "sun protection does", "beaufort wind scale"
        ]
        if any(t in last_msg for t in mixed_triggers):
            primary_tool = "get_air_quality" if "uv" in last_msg else "get_current"
            return LLMDecision(
                tool_calls=[
                    ToolCall(name=primary_tool, arguments=location_args),
                    ToolCall(name="search_knowledge", arguments={"query": messages[-1].get("content", "")}),
                ]
            )

        # 3. Explanatory meteorological knowledge questions (RAG)
        knowledge_triggers = [
            "difference between weather and climate", "weather vs climate",
            "what is humidity", "relative humidity", "dew point", "heat index",
            "apparent temperature", "wind chill", "beaufort",
            "probability of precipitation", "precipitation probability",
            "uv index scale", "uv index", "southwest monsoon", "monsoon",
            "cloud types", "atmospheric pressure", "barometer", "pm2.5 vs pm10",
            "particulate matter", "thunderstorm", "cyclone", "urban heat island",
            "drought", "ઝાકળબિંદુ", "હવામાન અને આબોહવા", "मौसम और जलवायु"
        ]
        is_direct_live_query = (
            "weather in" in last_msg
            or "temperature in" in last_msg
            or ("कल" in last_msg and "मौसम" in last_msg)
            or ("આવતીકાલે" in last_msg and "હવામાન" in last_msg)
            or (city is not None and not any(phrase in last_msg for phrase in ["difference between", "what is", "explain what", "what does", "તફાવત"]))
        )

        if not is_direct_live_query and any(k in last_msg for k in knowledge_triggers):
            return LLMDecision(
                tool_calls=[ToolCall(name="search_knowledge", arguments={"query": messages[-1].get("content", "")})]
            )

        # 4. Air quality
        if any(w in last_msg for w in ["air quality", "aqi", "pollution", "smog", "pm2.5", "ozone", "वायु गुणवत्ता", "હવાની ગુણવત્તા"]):
            return LLMDecision(tool_calls=[ToolCall(name="get_air_quality", arguments=location_args)])

        # 5. Historical archive
        if any(w in last_msg for w in ["yesterday", "historical", "archive", "recorded", "2024-", "2023-", "2022-", "august 15 2022", "christmas 2023", "कल का", "ગઈકાલ"]):
            return LLMDecision(
                tool_calls=[ToolCall(name="get_history", arguments={**location_args, "start": "yesterday", "end": "yesterday"})]
            )

        # 6. Forecast
        is_current_moment = any(now_w in last_msg for now_w in ["right now", "at the moment", "currently", "outside now", "અત્યારે", "इस समय"])
        if not is_current_moment and any(w in last_msg for w in ["forecast", "rain", "tomorrow", "weekend", "this weekend", "will it rain", "next week", "next 3 days", "next 24 hours", "next monday", "बारिश", "વરસાદ", "આગાહી", "पूर्वानुमान", "2035", "2040"]):
            start_val = "tomorrow" if ("tomorrow" in last_msg or "कल" in last_msg or "આવતીકાલે" in last_msg) else ("weekend" if "weekend" in last_msg else "today")
            return LLMDecision(tool_calls=[ToolCall(name="get_forecast", arguments={**location_args, "start": start_val})])

        # 7. Current weather (live weather query)
        weather_words = ["weather", "temp", "cold", "hot", "sun", "humid", "wind", "breeze", "mausam", "havaman", "barish", "tapman", "climate", "degree", "celsius", "fahrenheit", "sky", "cloud", "rain", "storm"]
        if city or any(kw in last_msg for kw in weather_words):
            return LLMDecision(tool_calls=[ToolCall(name="get_current", arguments=location_args)])

        # General conversational inquiry without weather keywords
        if lang == "hi":
            fallback = "मैं आपकी बात समझ रहा हूँ! मैं WeatherGPT हूँ, आपके मौसम, दैनिक गतिविधियों और किसी भी सवाल में मदद के लिए यहाँ हूँ। आप जो भी पूछना चाहें, बेझिझक पूछें!"
        elif lang == "gu":
            fallback = "હું WeatherGPT છું! હું તમને હવામાન, વરસાદ અને રોજિંદા પ્રશ્નોમાં મદદ કરી શકું છું. તમે શું પૂછવા માંગો છો?"
        else:
            fallback = "I'm WeatherGPT, your friendly assistant! I'm here to help with weather, forecasts, outdoor advice, and general questions. How can I help you today?"
        return LLMDecision(content=fallback)

    async def generate_grounded_explanation(
        self,
        user_query: str,
        payload: Any,
        valid_period: Optional[dict[str, Any]] = None,
        mismatches: Optional[list[float]] = None,
        system_instruction: Optional[str] = None,
        language: str = "en",
    ) -> str:
        self.generation_attempts += 1

        # Simulate injecting a hallucinated/bad number on first attempt if configured
        if self.injected_bad_numbers and self.generation_attempts == 1:
            return "Tomorrow in Ahmedabad the temperature will be 999.0°C with an impossible 12345.0 mm of rainfall."

        # If on second attempt and still injecting:
        if self.injected_bad_numbers and self.generation_attempts >= 2:
            return "Still bad: 888.0°C and 777.0 mm."

        # Mixed Question Payload: contains both weather snapshot/forecast and knowledge
        if isinstance(payload, dict) and "weather" in payload and "knowledge" in payload:
            weather_snap = payload["weather"]
            temp = getattr(weather_snap, "temperature", 32.0)
            app_temp = getattr(weather_snap, "apparent_temperature", 36.0)
            hum = getattr(weather_snap, "relative_humidity", 65.0)

            if language == "hi":
                return (
                    f"आज तापमान {temp:.1f}°C है लेकिन {hum:.0f}% आर्द्रता के कारण यह {app_temp:.1f}°C महसूस होता है। "
                    "हीट इंडेक्स बताता है कि उच्च सापेक्ष आर्द्रता पसीने के वाष्पीकरण को धीमा कर देती है, जिससे शरीर गर्मी को प्रभावी ढंग से बाहर नहीं निकाल पाता।"
                )
            elif language == "gu":
                return (
                    f"આજે તાપમાન {temp:.1f}°C છે પરંતુ {hum:.0f}% ભેજના કારણે તે {app_temp:.1f}°C અનુભવાય છે. "
                    "હીટ ઇન્ડેક્સ દર્શાવે છે કે ઊંચો સાપેક્ષ ભેજ પરસેવાના બાષ્પીભવનને ધીમું પાડે છે."
                )
            else:
                return (
                    f"Today the ambient temperature is {temp:.1f}°C, but with {hum:.0f}% relative humidity, "
                    f"the apparent temperature (heat index) feels like {app_temp:.1f}°C. "
                    "High humidity impairs evaporative cooling from the skin, causing the body to retain more heat."
                )

        # If payload represents knowledge chunks from search_knowledge alone
        if isinstance(payload, dict) and "chunks" in payload:
            chunks = payload.get("chunks", [])
            if chunks:
                top_chunk = chunks[0]
                content = top_chunk.get("content", "")
                first_para = content.split("\n\n")[0] if "\n\n" in content else content
                return f"{first_para}\n\nEvidence verified from meteorological knowledge corpus."
            return "The meteorological knowledge base does not contain sufficient verified evidence for this question."

        # Produce a natural, fully-grounded factual explanation from the payload
        from backend.app.services.number_verifier import build_deterministic_answer
        from backend.app.schemas.location import Location
        from backend.app.schemas.base import Coordinates
        from backend.app.schemas.weather import WeatherSnapshot

        # Extract location if possible
        loc = getattr(payload, "location", None) or Location(
            name="Ahmedabad",
            country="India",
            country_code="IN",
            coordinates=Coordinates(latitude=23.0225, longitude=72.5714),
            provider="open-meteo",
            retrieved_at=datetime.now(timezone.utc),
            timezone="Asia/Kolkata",
            units={},
        )

        intent_name = "current_weather" if isinstance(payload, WeatherSnapshot) else "forecast"
        return build_deterministic_answer(intent_name, loc, payload, valid_period, language=language)
