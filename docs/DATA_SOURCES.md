# WeatherGPT Data Sources & API Integrations

This document outlines the external data sources, endpoints, variables, rate limits, and licensing terms utilized by WeatherGPT.

---

## 1. Primary Weather Provider: Open-Meteo

Open-Meteo is an open-source weather API providing high-resolution global weather forecasts, historical weather archives, air quality metrics, and geocoding services.

> [!WARNING]
> ### Commercial Licensing Notice
> **The free Open-Meteo tier is strictly for NON-COMMERCIAL use.**
> 
> According to official Open-Meteo terms:
> - Free access is provided exclusively for personal projects, academic research, and non-commercial prototyping.
> - **A paid subscription plan or an alternative provider is required before any commercial launch.**
> - Paid plans route through dedicated commercial infrastructure (`customer-api.open-meteo.com`) with dedicated API keys and SLA support.
> - Alternatively, Open-Meteo is open-source (under the GNU AGPLv3 license), which permits self-hosting on private infrastructure for commercial purposes without API access fees.

---

### 1.1 Rate Limits (Free Non-Commercial Tier)

Limits are enforced per client IP address:
* **Hourly limit**: 5,000 API calls / hour
* **Daily limit**: 10,000 API calls / day
* **Per-minute limit**: 600 API calls / minute
* **Monthly budget limit**: 300,000 API calls / month

*Note: For commercial tiers (Standard, Professional, Enterprise), dedicated quotas from 1M to 50M+ calls/month are provided with an API key.*

---

### 1.2 Mandatory Attribution Requirement

All Open-Meteo data is provided under the **Creative Commons Attribution 4.0 International (CC BY 4.0)** license.
**Visible attribution is strictly required** wherever Open-Meteo data or derived insights are displayed in UI components, chat responses, or exported reports.

**Standard Attribution Format:**
```html
<a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a>
```
Or in plain text:
```text
Weather data provided by Open-Meteo.com (CC BY 4.0)
```

---

## 2. Integrated Open-Meteo API Endpoints

### 2.1 Weather Forecast API
* **Base URL**: `https://api.open-meteo.com/v1/forecast`
* **Commercial Endpoint**: `https://customer-api.open-meteo.com/v1/forecast`
* **Protocol**: HTTP GET
* **Key Request Parameters**: `latitude`, `longitude`, `hourly`, `daily`, `current`, `timezone`, `temperature_unit`, `wind_speed_unit`, `precipitation_unit`
* **Variables Utilized**:
  * **Current Conditions**:
    * `temperature_2m` (°C / °F)
    * `relative_humidity_2m` (%)
    * `apparent_temperature` (°C / °F)
    * `is_day` (0 / 1)
    * `precipitation` (mm / inch)
    * `rain` (mm / inch)
    * `showers` (mm / inch)
    * `snowfall` (cm / inch)
    * `weather_code` (WMO code 0–99)
    * `cloud_cover` (%)
    * `surface_pressure` (hPa)
    * `wind_speed_10m` (km/h, m/s, mph)
    * `wind_direction_10m` (degrees)
    * `wind_gusts_10m` (km/h, m/s, mph)
  * **Forecast Hourly/Daily**:
    * `temperature_2m_max`, `temperature_2m_min`
    * `precipitation_probability` (%)
    * `precipitation_sum` (mm / inch)
    * `uv_index_max`

### 2.2 Historical Weather Archive API
* **Base URL**: `https://archive-api.open-meteo.com/v1/archive`
* **Commercial Endpoint**: `https://customer-archive-api.open-meteo.com/v1/archive`
* **Protocol**: HTTP GET
* **Data Sources / Models**: ERA5, ERA5-Land, CERRA reanalysis datasets (seamless global reanalysis from 1940 to near real-time).
* **Key Request Parameters**: `latitude`, `longitude`, `start_date`, `end_date`, `hourly`, `daily`, `timezone`
* **Variables Utilized**:
  * `temperature_2m`
  * `relative_humidity_2m`
  * `apparent_temperature`
  * `precipitation`
  * `rain`
  * `snowfall`
  * `weather_code`
  * `surface_pressure`
  * `wind_speed_10m`
  * `wind_direction_10m`

### 2.3 Geocoding API
* **Base URL**: `https://geocoding-api.open-meteo.com/v1/search`
* **Protocol**: HTTP GET
* **Key Request Parameters**: `name` (search query), `count` (number of results, default 10), `language`, `format=json`
* **Fields Utilized**:
  * `id` (integer)
  * `name` (city / location name)
  * `latitude`, `longitude` (decimal degrees)
  * `elevation` (meters)
  * `feature_code` (e.g., PPLA, PPLC)
  * `country_code` (ISO 3166-1 alpha-2, e.g., "US", "GB")
  * `country` (country name)
  * `admin1` (first administrative level, state/province)
  * `admin2` (second administrative level, county/district)
  * `timezone` (IANA timezone identifier, e.g., "America/New_York")
  * `population`

### 2.4 Air Quality API
* **Base URL**: `https://air-quality-api.open-meteo.com/v1/air-quality`
* **Commercial Endpoint**: `https://customer-air-quality-api.open-meteo.com/v1/air-quality`
* **Protocol**: HTTP GET
* **Key Request Parameters**: `latitude`, `longitude`, `hourly`, `current`, `timezone`
* **Variables Utilized**:
  * `pm10` (Particulate matter < 10 µm, μg/m³)
  * `pm2_5` (Particulate matter < 2.5 µm, μg/m³)
  * `carbon_monoxide` (CO, μg/m³)
  * `nitrogen_dioxide` (NO₂, μg/m³)
  * `sulphur_dioxide` (SO₂, μg/m³)
  * `ozone` (O₃, μg/m³)
  * `aerosol_optical_depth`
  * `dust` (μg/m³)
  * `uv_index` (Index 0–11+)
  * `european_aqi` (European Air Quality Index 0–100+)
  * `us_aqi` (United States Air Quality Index 0–500)

---

## 3. Data Ingestion Architecture & Guidelines

1. **Caching Layer**:
   - To respect rate limits and ensure low latency, all weather, forecast, and geocoding responses must pass through the `Cache` abstraction (TTL of 5–15 minutes for current weather, 60 minutes for forecast, 24+ hours for geocoding).
2. **Metadata Tracking**:
   - Every domain object must explicitly persist:
     - `provider` (e.g., `"open-meteo"`)
     - `retrieved_at` (ISO 8601 UTC timestamp)
     - `coordinates` (latitude, longitude, elevation)
     - `timezone` (e.g., `"Europe/Paris"`)
     - `units` (dictionary mapping variables to unit strings)
3. **Provider Agnostic Architecture**:
   - All weather queries interact with the `WeatherProvider` abstract interface so alternate providers (such as Tomorrow.io, AccuWeather, or self-hosted Open-Meteo) can be plugged in without changing domain logic.

---

## 4. Meteorological Explanatory Knowledge Corpus (RAG)

WeatherGPT maintains an offline explanatory knowledge base in `data/documents/` indexed into a persistent ChromaDB vector store.
**Rule of Use**: RAG is strictly restricted to explanatory scientific concepts, thermodynamic definitions, synoptic phenomena, and meteorological scales. **RAG is never used to synthesize or hallucinate live numerical weather values.**

### 4.1 Document Metadata Catalog

| Document ID | Title | Publisher | Source URL | Publication Date | License Notes |
|:---|:---|:---|:---|:---|:---|
| `01_weather_vs_climate` | Weather vs Climate: Fundamental Concepts | WeatherGPT Meteorological Knowledgebase | `https://weathergpt.internal/knowledge/weather-vs-climate` | 2026-01-15 | Project-authored; CC-BY-4.0 |
| `02_relative_humidity_dew_point` | Relative Humidity, Dew Point, and Saturation Vapor Pressure | WeatherGPT Meteorological Knowledgebase | `https://weathergpt.internal/knowledge/relative-humidity-dew-point` | 2026-01-15 | Project-authored; CC-BY-4.0 |
| `03_apparent_temperature_heat_index` | Apparent Temperature and Heat Index Dynamics | WeatherGPT Meteorological Knowledgebase | `https://weathergpt.internal/knowledge/heat-index-apparent-temperature` | 2026-01-15 | Project-authored; CC-BY-4.0 |
| `04_wind_chill_index` | Wind Chill Temperature Index and Cold Stress | WeatherGPT Meteorological Knowledgebase | `https://weathergpt.internal/knowledge/wind-chill-index` | 2026-01-15 | Project-authored; CC-BY-4.0 |
| `05_beaufort_wind_scale` | The Beaufort Wind Force Scale and Marine/Terrestrial Effects | WeatherGPT Meteorological Knowledgebase | `https://weathergpt.internal/knowledge/beaufort-wind-scale` | 2026-01-15 | Project-authored; CC-BY-4.0 |
| `06_precipitation_probability` | Probability of Precipitation (PoP): Definitions and Interpretation | WeatherGPT Meteorological Knowledgebase | `https://weathergpt.internal/knowledge/precipitation-probability` | 2026-01-15 | Project-authored; CC-BY-4.0 |
| `07_uv_index_sun_protection` | Global Solar Ultraviolet Index (UVI) and Radiation Safety | WeatherGPT Meteorological Knowledgebase | `https://weathergpt.internal/knowledge/uv-index-sun-protection` | 2026-01-15 | Project-authored; CC-BY-4.0 |
| `08_south_asian_monsoon_basics` | South Asian Southwest Monsoon: Mechanics, Onset, and Dynamics | WeatherGPT Meteorological Knowledgebase | `https://weathergpt.internal/knowledge/south-asian-monsoon-basics` | 2026-01-15 | Project-authored; CC-BY-4.0 |
| `09_northeast_retreating_monsoon` | Northeast (Post-Monsoon) Retreating System in the Indian Subcontinent | WeatherGPT Meteorological Knowledgebase | `https://weathergpt.internal/knowledge/northeast-retreating-monsoon` | 2026-01-15 | Project-authored; CC-BY-4.0 |
| `10_cloud_types_precipitation` | Cloud Classification, Genera, and Precipitation Mechanisms | WeatherGPT Meteorological Knowledgebase | `https://weathergpt.internal/knowledge/cloud-types-precipitation` | 2026-01-15 | Project-authored; CC-BY-4.0 |
| `11_atmospheric_pressure_barometer` | Atmospheric Pressure, Barometric Trends, and Altimetry | WeatherGPT Meteorological Knowledgebase | `https://weathergpt.internal/knowledge/atmospheric-pressure-barometer` | 2026-01-15 | Project-authored; CC-BY-4.0 |
| `12_air_quality_index_aqi` | Air Quality Index (AQI): Principles, Pollutants, and Health Standards | WeatherGPT Meteorological Knowledgebase | `https://weathergpt.internal/knowledge/air-quality-index-aqi` | 2026-01-15 | Project-authored; CC-BY-4.0 |
| `13_particulate_matter_pm25_pm10` | Atmospheric Particulate Matter (PM2.5 and PM10): Physics and Aerodynamic Behavior | WeatherGPT Meteorological Knowledgebase | `https://weathergpt.internal/knowledge/particulate-matter-pm25-pm10` | 2026-01-15 | Project-authored; CC-BY-4.0 |
| `14_thunderstorms_lightning` | Deep Convective Thunderstorms, Mesoscale Convective Systems, and Lightning Dynamics | WeatherGPT Meteorological Knowledgebase | `https://weathergpt.internal/knowledge/thunderstorms-lightning` | 2026-01-15 | Project-authored; CC-BY-4.0 |
| `15_tropical_cyclones_north_indian_ocean` | Tropical Cyclones in the North Indian Ocean | WeatherGPT Meteorological Knowledgebase | `https://weathergpt.internal/knowledge/tropical-cyclones-north-indian-ocean` | 2026-01-15 | Project-authored; CC-BY-4.0 |
| `16_western_disturbances` | Western Disturbances and Winter Precipitation in South Asia | WeatherGPT Meteorological Knowledgebase | `https://weathergpt.internal/knowledge/western-disturbances` | 2026-01-15 | Project-authored; CC-BY-4.0 |
| `17_urban_heat_island` | Urban Heat Island Effect and Microclimate Dynamics | WeatherGPT Meteorological Knowledgebase | `https://weathergpt.internal/knowledge/urban-heat-island` | 2026-01-15 | Project-authored; CC-BY-4.0 |
| `18_meteorological_drought` | Meteorological, Agricultural, and Hydrological Drought | WeatherGPT Meteorological Knowledgebase | `https://weathergpt.internal/knowledge/meteorological-drought` | 2026-01-15 | Project-authored; CC-BY-4.0 |

---

## 5. Conversational LLM Provider: OpenRouter

WeatherGPT integrates with [OpenRouter](https://openrouter.ai/) for conversational understanding, intent/entity extraction, tool dispatch, and grounded natural language synthesis.

### 5.1 Endpoint & Authentication
* **Base URL**: `https://openrouter.ai/api/v1`
* **Chat Endpoint**: `POST /chat/completions` (OpenAI-compatible)
* **Models Endpoint**: `GET /models` (used on startup for model capability and tool support validation)
* **Auth**: `Authorization: Bearer $OPENROUTER_API_KEY`
* **Attribution Headers**:
  * `HTTP-Referer`: configured via `APP_URL`
  * `X-Title`: configured via `APP_TITLE` (defaults to `WeatherGPT`)

### 5.2 Configured Model Tiers
* **Fast Model (`LLM_MODEL_FAST`)**: default `google/gemini-2.5-flash-lite` (or `meta-llama/llama-3.1-8b-instruct`) for low-latency tool routing and entity extraction.
* **Main Model (`LLM_MODEL_MAIN`)**: default `google/gemini-2.5-flash` for final grounded explanation synthesis.
* **Fallback Model (`LLM_MODEL_FALLBACK`)**: optional secondary model invoked if the main model encounters 5xx service failures after retries.

### 5.3 Error Handling & Status Code Mapping
* **401 Unauthorized**: Mapped to user-friendly `LLM key invalid: please check your OPENROUTER_API_KEY configuration.`
* **402 Payment Required**: Mapped to `LLM service out of credits: please check your OpenRouter account balance.`
* **429 Too Many Requests**: Mapped to `LLM rate limited, retry shortly.`
* **5xx Server Errors**: Handled with bounded retries (up to 2 retries with exponential backoff) and optional fallback model execution before returning a clean user-facing error message. Keys are strictly redacted and never logged.


