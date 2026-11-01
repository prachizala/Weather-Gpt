# WeatherGPT Architecture

> A meteorological intelligence platform with grounded AI chat, RAG knowledge retrieval, deterministic number verification, and rule-based advisories.

---

## 1. System Architecture Overview

```mermaid
graph TB
    subgraph Client["Frontend (React + TypeScript)"]
        UI["Dashboard UI"]
        API_Client["Typed API Client"]
        SSE["SSE Stream Handler"]
    end

    subgraph Backend["Backend (FastAPI + Python)"]
        Router["API Router"]

        subgraph Services["Core Services"]
            Chat["Chat Orchestrator"]
            LLM["LLM Provider (OpenRouter)"]
            Tools["Tool Executor"]
            Verifier["Number Verifier"]
            Advisory["Advisory Engine"]
            HistComp["Historical Comparison"]
        end

        subgraph DataLayer["Data Layer"]
            OM["Open-Meteo Client"]
            RAG["RAG Pipeline"]
            Chroma["ChromaDB Vector Store"]
            Cache["In-Memory TTL Cache"]
        end
    end

    subgraph External["External APIs"]
        OpenMeteo["Open-Meteo API"]
        OpenRouterAPI["OpenRouter API"]
    end

    UI --> API_Client
    API_Client --> Router
    SSE --> Router
    Router --> Chat
    Router --> Advisory
    Router --> HistComp
    Chat --> LLM
    Chat --> Tools
    Chat --> Verifier
    Chat --> RAG
    Tools --> OM
    OM --> Cache
    OM --> OpenMeteo
    RAG --> Chroma
    LLM --> OpenRouterAPI
```

---

## 2. Layer Decomposition

### 2.1 API Layer (`backend/app/api/`)

| Module | Endpoints | Purpose |
|--------|-----------|---------|
| `health.py` | `GET /api/health` | Liveness probe, subsystem status |
| `locations.py` | `GET /api/locations/search` | Geocoding with Open-Meteo |
| `weather.py` | `GET /api/weather/current`, `/forecast`, `/history` | Meteorological data endpoints |
| `air_quality.py` | `GET /api/air-quality` | AQI and pollutant concentrations |
| `chat.py` | `POST /api/chat`, `/api/chat/stream`, `/api/chat/clear` | Grounded AI conversational assistant |
| `advisories.py` | `GET /api/advisories` | Rule-based safety advisories |
| `knowledge.py` | `POST /api/knowledge/search` | RAG document retrieval |
| `historical.py` | `POST /api/historical/comparison` | Multi-year statistical comparison |
| `deps.py` | — | Dependency injection (providers, cache) |

### 2.2 Services Layer (`backend/app/services/`)

| Service | Responsibility |
|---------|---------------|
| `open_meteo.py` | Async httpx client for all Open-Meteo APIs (geocoding, current, forecast, historical, air quality) |
| `normalizers.py` | Provider JSON → Pydantic model transformations |
| `chat_orchestrator.py` | Tool-calling loop: question → LLM decides tools → execute → verify → explain |
| `llm_provider.py` | Abstract `LLMProvider` + `OpenRouterProvider` + `MockLLMProvider` |
| `tools.py` | Tool definitions with JSON schemas for LLM function calling |
| `number_verifier.py` | Deterministic number extraction and cross-validation against payload |
| `advisories.py` | YAML-driven rule engine for weather safety advisories |
| `historical_comparison.py` | Multi-year date range alignment, gap detection, deterministic computation |
| `session_store.py` | Bounded session context (last 6 turns + location) |
| `india_alerts.py` | Static IMD reference link for Indian locations |
| `providers.py` | Abstract `WeatherProvider` interface |
| `exceptions.py` | Structured exception hierarchy |

### 2.3 RAG Pipeline (`backend/app/rag/`)

```mermaid
flowchart LR
    A["data/documents/*.md"] --> B["Loader"]
    B --> C["Cleaner / Deduper"]
    C --> D["Chunker (500-800 tokens, 50-100 overlap)"]
    D --> E["Embeddings (ChromaDB default)"]
    E --> F["ChromaDB Collection"]
    F --> G["Retriever (top-k, threshold filter)"]
    G --> H["search_knowledge tool"]
```

- **Document corpus**: 15-30 educational meteorological documents in `data/documents/`
- **Metadata**: title, publisher, source_url, publication_date, license_notes
- **Relevance threshold**: Cosine distance ≥ 0.40 → "sufficient evidence"; below → "insufficient evidence" response
- **Security**: Retrieved text is wrapped as `[UNTRUSTED_RETRIEVED_TEXT]` — cannot modify system instructions

### 2.4 Schemas Layer (`backend/app/schemas/`)

| Schema | Models |
|--------|--------|
| `base.py` | `BaseWeatherModel` (coordinates, timezone, provider, retrieved_at, units) |
| `location.py` | `Location`, `Coordinates` |
| `weather.py` | `WeatherSnapshot`, `ForecastPoint`, `ForecastData`, `HistoricalRecord`, `AirQuality` |
| `chat.py` | `ChatRequest`, `ChatResponse`, `SourceRef` |
| `comparison.py` | `HistoricalComparisonResult`, `YearlyBreakdown` |
| `advisories.py` | `AdvisoriesReport`, `AdvisoryItem`, `SkippedRule` |
| `error.py` | `ErrorResponse` |
| `api.py` | `APIResponseEnvelope` |

### 2.5 Utilities (`backend/app/utils/`)

| Utility | Purpose |
|---------|---------|
| `cache.py` | Abstract `Cache` interface + `InMemoryTTLCache` (Redis-replaceable) |
| `date_resolver.py` | Resolves "today", "tomorrow", "this weekend" in location timezone |
| `language.py` | Language detection and digit normalization (Hindi/Gujarati) |
| `rate_limit.py` | Per-endpoint sliding window rate limiter |
| `logging.py` | Structured JSON logger with API key redaction |

---

## 3. Data Flow: Chat Question

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API as FastAPI Router
    participant Orch as Chat Orchestrator
    participant LLM as OpenRouter LLM
    participant Tools as Tool Executor
    participant OM as Open-Meteo
    participant RAG as RAG Retriever
    participant Verifier as Number Verifier

    User->>Frontend: "Will it rain tomorrow?"
    Frontend->>API: POST /api/chat
    API->>Orch: process(message, session)
    Orch->>LLM: decide_tools(message)
    LLM-->>Orch: [get_forecast(Ahmedabad, tomorrow)]
    Orch->>Tools: execute(get_forecast)
    Tools->>OM: fetch forecast data
    OM-->>Tools: validated ForecastData
    Tools-->>Orch: payload with numbers
    Orch->>LLM: explain(payload)
    LLM-->>Orch: natural language answer
    Orch->>Verifier: verify(answer, payload)
    Verifier-->>Orch: ✓ verified (or regenerate)
    Orch-->>API: ChatResponse
    API-->>Frontend: JSON response
    Frontend-->>User: Rendered answer + sources
```

---

## 4. Data Flow: Mixed Question (Weather + Knowledge)

```mermaid
sequenceDiagram
    participant User
    participant Orch as Orchestrator
    participant Tools as Tool Executor
    participant OM as Open-Meteo
    participant RAG as RAG Retriever
    participant LLM as OpenRouter LLM

    User->>Orch: "Why does it feel hotter than the temperature today?"
    Orch->>LLM: decide_tools
    LLM-->>Orch: [get_current, search_knowledge("heat index")]
    Orch->>Tools: execute(get_current)
    Tools->>OM: fetch current weather
    OM-->>Tools: temp=33°C, apparent=38°C
    Orch->>RAG: search("heat index apparent temperature")
    RAG-->>Orch: chunks about heat index
    Orch->>LLM: explain(weather_payload + knowledge_chunks)
    LLM-->>Orch: "The apparent temperature is 38°C while actual is 33°C due to heat index..."
    Orch-->>User: Answer with weather source + document citations
```

---

## 5. Advisory Engine

```mermaid
flowchart TD
    A["advisory_rules.yaml"] --> B["AdvisoryEngine.evaluate()"]
    C["Current Weather Data"] --> B
    D["Forecast Data"] --> B
    E["Air Quality Data"] --> B
    B --> F{"Variable Available?"}
    F -->|Yes| G{"Threshold Exceeded?"}
    F -->|No| H["SkippedRule (explicit note)"]
    G -->|Yes| I["AdvisoryItem (rule_id, severity, trigger values)"]
    G -->|No| J["Rule passes - no advisory"]
    I --> K["AdvisoriesReport"]
    H --> K
```

---

## 6. Number Verification Pipeline

```mermaid
flowchart LR
    A["LLM Answer"] --> B["Extract Numbers (regex)"]
    B --> C["Normalize Digits (Hindi/Gujarati → ASCII)"]
    C --> D{"Compare vs Payload"}
    D -->|Match| E["✓ Return verified answer"]
    D -->|Mismatch| F["Regenerate once with mismatch note"]
    F --> G{"Second attempt match?"}
    G -->|Yes| E
    G -->|No| H["Return deterministic template answer"]
```

---

## 7. Frontend Architecture

```mermaid
graph TB
    subgraph App["App.tsx (State Manager)"]
        State["State: location, weather, forecast, AQI, advisories, units, errors"]
    end

    subgraph Components["React Components"]
        CS["CitySearch (debounced autocomplete)"]
        CC["CurrentConditionsCard"]
        FC["ForecastCards (7-day)"]
        WC["WeatherCharts (Recharts)"]
        AQ["AirQualityCard"]
        AB["AdvisoriesBanner"]
        HC["HistoricalComparisonCard"]
        CP["ChatPanel (SSE streaming)"]
    end

    subgraph APIClient["services/api.ts"]
        Client["WeatherApiClient"]
    end

    App --> CS
    App --> CC
    App --> FC
    App --> WC
    App --> AQ
    App --> AB
    App --> HC
    App --> CP
    CS --> Client
    CC --> Client
    CP --> Client
```

---

## 8. Caching Strategy

| Data Type | TTL | Cache Key Pattern |
|-----------|-----|-------------------|
| Geocoding results | 1 hour | `geo:{query}:{count}` |
| Current weather | 10 minutes | `current:{lat}:{lon}:{units}` |
| Forecast | 15 minutes | `forecast:{lat}:{lon}:{days}:{units}` |
| Air quality | 10 minutes | `aqi:{lat}:{lon}` |
| Historical data | 24 hours | `history:{lat}:{lon}:{start}:{end}:{units}` |

The `Cache` interface (`utils/cache.py`) is designed for drop-in Redis replacement.

---

## 9. Security Measures

- **Secrets**: All API keys are server-side only via `pydantic-settings` / environment variables
- **Input validation**: Pydantic models validate all request parameters
- **Rate limiting**: Sliding window per IP on `/api/chat`
- **Request size limits**: Bounded message length in chat requests
- **Bounded retries**: Max 2 retries with exponential backoff on upstream calls
- **RAG quarantine**: Retrieved text wrapped as untrusted data, cannot alter system instructions
- **Log redaction**: API keys, Bearer tokens, and passwords redacted from structured JSON logs
- **Security headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`

---

## 10. Deployment Architecture

```mermaid
graph LR
    subgraph Docker["Docker Compose"]
        FE["Frontend Container (Nginx)"]
        BE["Backend Container (Uvicorn)"]
        Vol["chroma_data volume"]
    end

    Client["Browser"] --> FE
    FE -->|"/api/*"| BE
    BE --> Vol
    BE --> ExtAPI["Open-Meteo / OpenRouter APIs"]
```

- **Backend**: Python 3.11-slim, pre-ingested ChromaDB, non-root user, healthcheck via `/api/health`
- **Frontend**: Multi-stage build (Node 20 → Nginx Alpine), reverse proxy to backend
- **Volume**: `chroma_data` persists the vector store across restarts
