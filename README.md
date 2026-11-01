# WeatherGPT

WeatherGPT is an agentic AI assistant engineered for meteorological intelligence, weather synthesis, historical reanalysis, air quality tracking, and forecasting.

---

## Repository Layout

```text
├── frontend/               # User interface client (Phase 6+)
├── backend/
│   └── app/
│       ├── api/            # FastAPI endpoints, route aggregation & health check
│       │   ├── health.py       # GET /api/health
│       │   ├── locations.py    # GET /api/locations/search
│       │   ├── weather.py      # GET /api/weather/{current, forecast, history}
│       │   ├── air_quality.py  # GET /api/air-quality
│       │   └── chat.py         # POST /api/chat, POST/DELETE /api/chat/session/clear
│       ├── services/       # Provider abstractions, normalizers & orchestration
│       │   ├── providers.py        # WeatherProvider & LLMProvider interfaces
│       │   ├── open_meteo.py       # Asynchronous Open-Meteo client with caching & retries
│       │   ├── normalizers.py      # Decoupled raw JSON -> Pydantic normalizers
│       │   ├── tools.py            # Strict JSON tool declarations & tool executor
│       │   ├── llm_provider.py     # OpenRouter & Mock LLM adapters with OpenAI-compatible tool calling
│       │   ├── number_verifier.py  # Anti-hallucination number verification & fallback
│       │   ├── chat_orchestrator.py# Grounded conversation orchestrator
│       │   ├── session_store.py    # Bounded 6-turn dialogue context & location persistence
│       │   └── india_alerts.py     # India Meteorological Department (IMD) notice
│       ├── rag/            # Retrieval-Augmented Generation pipeline (Phase 4+)
│       ├── agents/         # Multi-agent coordination (Phase 5+)
│       ├── schemas/        # Pydantic data models & validation
│       ├── utils/          # In-memory TTL cache, date resolver & utilities
│       │   ├── cache.py            # Thread-safe InMemoryTTLCache behind Cache interface
│       │   └── date_resolver.py    # Deterministic relative-date timezone resolution
│       ├── config.py       # pydantic-settings configuration
│       └── main.py         # FastAPI application factory & error handlers
├── data/
│   └── documents/          # Meteorological reference documents for RAG
├── tests/                  # Pytest test suite (65+ tests covering schemas, API, verifier, dates)
├── docs/
│   └── DATA_SOURCES.md     # Open-Meteo API specifications, limits & license terms
├── .env.example            # Environment configuration template
├── requirements.txt        # Python backend dependencies
└── README.md               # Project documentation
```

---

## Architecture & Implementation

### Phase 1: Foundations & Schemas
* **Strict Base Metadata**: Every model enforces `units`, `provider`, `retrieved_at`, `coordinates`, and `timezone`.
* **Domain Models**: `Location`, `WeatherSnapshot`, `ForecastPoint`, `HistoricalRecord` (`observation`, `reanalysis`, `forecast`), `AirQuality`, `ChatRequest`, `ChatResponse`, `SourceRef`, `ErrorResponse`.
* **Caching Interface**: Thread-safe `InMemoryTTLCache` behind abstract `Cache` ABC.
* **Error Format**: Uniform `ErrorResponse` model for all exceptions.

### Phase 2: Real Data Services & REST Endpoints
* **Async Open-Meteo Client**: Built on `httpx.AsyncClient` with exponential backoff on transient/5xx errors (up to 2 retries). 4xx client errors fail immediately.
* **Decoupled Normalizers**: Separates raw provider JSON parsing from internal domain schemas (`provider JSON -> normalizer -> Pydantic model`).
* **TTL Caching**: Forecasts (15 min), current conditions (10 min), air quality (15 min), historical records and geocoding (24 hours).
* **Endpoints**:
  * `GET /api/locations/search?q={query}&count={count}`
  * `GET /api/weather/current?latitude={lat}&longitude={lon}&units={celsius|fahrenheit}`
  * `GET /api/weather/forecast?latitude={lat}&longitude={lon}&days={days}&units={celsius|fahrenheit}`
  * `GET /api/weather/history?latitude={lat}&longitude={lon}&start={start}&end={end}&units={celsius|fahrenheit}`
  * `GET /api/air-quality?latitude={lat}&longitude={lon}`
* **India Meteorological Department (IMD) Alerts**: Explicit, static advisory for India locations: `"Official alerts: check IMD (https://mausam.imd.gov.in/)"`.

### Phase 3: Grounded Conversational AI & Tool Calling
* **LLM Tool Calling**: Strict JSON function declarations (`get_current`, `get_forecast`, `get_history`, `get_air_quality`) using function calling rather than hand-written intent classifiers.
* **Deterministic Relative-Date Resolution**: Deterministically resolves expressions like `"today"`, `"tomorrow"`, `"day after tomorrow"`, `"this weekend"`, and `"yesterday"` in the **target location's timezone** before calling tools.
* **Number Verifier**: After model generation, extracts all numbers from the response and verifies them against the payload (allowing rounding and unit conversions).
  * **On mismatch**: Regenerates once with the detected mismatches explicitly listed.
  * **On secondary mismatch**: Automatically falls back to a deterministic, fact-accurate template built from the verified payload.
* **Chat Contract (`POST /api/chat`)**: Returns `answer`, `intent`, `location`, `valid_period`, `weather_data`, `sources`, `limitations`.
### Phase 4: Explanatory Meteorological Knowledge Corpus & RAG
* **Explanatory Knowledgebase**: 18 peer-reviewed/authoritative meteorological reference documents in `data/documents/` covering physical dynamics, scales, atmospheric thermodynamics, and Indian synoptic phenomena (monsoons, cyclones, western disturbances).
* **ChromaDB Vector Store**: Chunked to 500–800 tokens with 50–100 token overlap; cosine similarity threshold filtering (default: 0.45).
* **Prompt Injection Defense**: Retrieved document text is containerized within `<untrusted_retrieved_knowledge>` XML delimiters with explicit anti-injection instructions.
* **Separation of Citations**: Live weather API providers (`sources`) are reported separately from document citations (`knowledge_citations`).

### Phase 5: Combined Weather + RAG, Multilingual & Performance Optimization
* **Mixed-Intent Tool Orchestration**: Multi-tool execution for complex queries (e.g. `"Why does it feel hotter than the temperature today in Ahmedabad?"` -> `get_current` + `search_knowledge`).
* **Minimum Tool Routing**: Dual-tier routing strategy using fast, cost-efficient router LLMs for entity/tool extraction and high-capacity models for grounded synthesis.
* **Streaming Responses (SSE)**: Server-Sent Events endpoint at `POST /api/chat/stream` delivering low time-to-first-token streaming.
* **Multilingual Grounding (English, Hindi, Gujarati)**: Full support for English, Hindi (हिंदी), and Gujarati (ગુજરાતી), with Indic numeral normalizer (Devanagari `०-९` and Gujarati `૦-૯` mapped to ASCII) so the number verifier rigorously validates translated outputs.
* **Latency Instrumentation & Resilience**: Stage-by-stage latency tracking (`routing`, `tools_execution`, `explanation_generation`, `verification`), per-request timeout protection, client IP sliding-window rate limiting (30 req/min), and 8 KB payload caps.

---

## Data Sources & Licensing

> [!WARNING]
> The free Open-Meteo API tier is restricted to **NON-COMMERCIAL use only** (personal experiments, prototyping, academic research). A paid subscription plan or an alternative provider is strictly required before any commercial launch.
>
> All data requires visible attribution:
> `Weather data by Open-Meteo.com (CC BY 4.0)`

For complete details on endpoints, variables, rate limits, and licensing, refer to [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).

---

## Quickstart

### 1. Setup Virtual Environment
```bash
python -m venv .venv
# On Windows
.\.venv\Scripts\activate
# On Linux/macOS
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure Environment
```bash
cp .env.example .env
```
*(Configure `OPENROUTER_API_KEY` for live OpenRouter tool calling with `LLM_MODEL_MAIN` and `LLM_MODEL_FAST`; if unset, the hermetic mock LLM provider operates automatically.)*

Key environment variables:
- `OPENROUTER_API_KEY`: OpenRouter bearer authentication token.
- `LLM_MODEL_MAIN`: Model slug for final synthesis (default: `google/gemini-2.5-flash`).
- `LLM_MODEL_FAST`: Fast model slug for routing and tool extraction (default: `google/gemini-2.5-flash-lite`).
- `LLM_MODEL_FALLBACK`: Optional fallback model slug used if main model experiences a 5xx error.
- `OPENROUTER_BASE_URL`: Base endpoint (default: `https://openrouter.ai/api/v1`).
- `APP_URL` / `APP_TITLE`: Optional attribution headers sent to OpenRouter.

### 3. Run Tests
```bash
# Run all unit tests hermetically (no external API calls)
pytest -v

# Run optional live integration smoke test
RUN_LIVE_TESTS=1 pytest -v -m live
```

### 4. Start the Backend API
```bash
uvicorn backend.app.main:app --reload --port 8000
```
- Interactive Swagger UI: `http://localhost:8000/docs`
- OpenAPI Schema: `http://localhost:8000/openapi.json`
- Health check: `http://localhost:8000/api/health`
