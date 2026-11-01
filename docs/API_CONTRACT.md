# WeatherGPT API Contract Specification

This document defines the formal OpenAPI / REST HTTP specification for all endpoints exposed by the WeatherGPT backend service (`http://localhost:8000`).

---

## 1. System Health & Infrastructure

### `GET /api/health`
Health check endpoint reporting operational readiness, subsystem connectivity, and vector database status.

- **Request**: None
- **Response** (`200 OK`):
```json
{
  "status": "healthy",
  "app": "WeatherGPT",
  "version": "1.0.0",
  "chroma_db": "connected",
  "cache": "operational",
  "timestamp": "2026-10-18T07:15:00.000000Z"
}
```

---

## 2. Geocoding & Locations

### `GET /api/locations/search`
Searches global geographical locations via Open-Meteo Geocoding API with in-memory TTL caching.

- **Query Parameters**:
  - `query` (string, required): City, region, or locality name (e.g. `Ahmedabad`, `Tokyo`, `दिल्ली`).
  - `count` (integer, optional, default: 5): Maximum number of candidate results (1-10).
- **Response** (`200 OK`):
```json
[
  {
    "name": "Ahmedabad",
    "country": "India",
    "country_code": "IN",
    "admin1": "Gujarat",
    "coordinates": {
      "latitude": 23.0225,
      "longitude": 72.5714
    },
    "timezone": "Asia/Kolkata",
    "provider": "open-meteo",
    "retrieved_at": "2026-10-18T07:15:00.000000Z",
    "units": {
      "temperature": "°C"
    }
  }
]
```

---

## 3. Real-Time & Forecast Meteorology

### `GET /api/weather/current`
Fetches verified current weather snapshot for given coordinates.

- **Query Parameters**:
  - `latitude` (float, required): -90.0 to 90.0
  - `longitude` (float, required): -180.0 to 180.0
  - `units` (string, optional, default: `celsius`): `celsius` or `fahrenheit`
- **Response** (`200 OK`):
```json
{
  "coordinates": {
    "latitude": 23.0225,
    "longitude": 72.5714
  },
  "timezone": "Asia/Kolkata",
  "provider": "open-meteo",
  "retrieved_at": "2026-10-18T07:15:00.000000Z",
  "units": {
    "temperature": "°C",
    "wind_speed": "km/h",
    "surface_pressure": "hPa"
  },
  "temperature": 33.4,
  "apparent_temperature": 36.2,
  "relative_humidity": 58,
  "wind_speed": 12.5,
  "wind_direction": 240,
  "surface_pressure": 1008.2,
  "weather_code": 1,
  "weather_description": "Mainly Clear",
  "is_day": 1,
  "timestamp": "2026-10-18T12:00:00"
}
```

### `GET /api/weather/forecast`
Fetches multi-day daily and hourly forecast up to 16 days ahead.

- **Query Parameters**:
  - `latitude` (float, required)
  - `longitude` (float, required)
  - `days` (integer, optional, default: 7): 1 to 16 days
  - `units` (string, optional, default: `celsius`)
- **Response** (`200 OK`):
```json
{
  "coordinates": { "latitude": 23.0225, "longitude": 72.5714 },
  "timezone": "Asia/Kolkata",
  "provider": "open-meteo",
  "retrieved_at": "2026-10-18T07:15:00.000000Z",
  "units": { "temperature": "°C", "precipitation": "mm" },
  "daily": [
    {
      "date": "2026-10-18",
      "temperature_2m_max": 35.6,
      "temperature_2m_min": 24.1,
      "precipitation_sum": 0.0,
      "precipitation_probability_max": 5,
      "weather_code": 1,
      "weather_description": "Mainly Clear"
    }
  ],
  "hourly": [ ... ]
}
```

### `GET /api/weather/history`
Retrieves past meteorological observations or reanalysis data for date range.

- **Query Parameters**:
  - `latitude` (float, required)
  - `longitude` (float, required)
  - `start_date` (string, required): `YYYY-MM-DD`
  - `end_date` (string, required): `YYYY-MM-DD`
  - `units` (string, optional, default: `celsius`)
- **Response** (`200 OK`): Contains historical daily records with explicit metadata: `dataset_type`: `"reanalysis"` (ERA5/ERA5-Land) or `"observation"`.

---

## 4. Atmospheric Quality & Advisories

### `GET /api/air-quality`
Retrieves European AQI and constituent pollutant concentrations.

- **Query Parameters**:
  - `latitude` (float, required)
  - `longitude` (float, required)
- **Response** (`200 OK`):
```json
{
  "coordinates": { "latitude": 23.0225, "longitude": 72.5714 },
  "timezone": "Asia/Kolkata",
  "provider": "open-meteo",
  "retrieved_at": "2026-10-18T07:15:00.000000Z",
  "european_aqi": 68,
  "pm2_5": 38.4,
  "pm10": 74.2,
  "nitrogen_dioxide": 22.1,
  "sulphur_dioxide": 8.5,
  "ozone": 42.0,
  "aqi_category": "Moderate"
}
```

### `GET /api/advisories`
Evaluates deterministic rule engine against live conditions and forecasts.

- **Query Parameters**:
  - `latitude` (float, required)
  - `longitude` (float, required)
  - `units` (string, optional, default: `celsius`)
  - `location_name` (string, optional, default: `Current Location`)
- **Response** (`200 OK`):
```json
{
  "location": "Ahmedabad",
  "coordinates": { "latitude": 23.0225, "longitude": 72.5714 },
  "evaluated_at": "2026-10-18T07:15:00.000000Z",
  "disclaimer": "App suggestion, not an official warning. Check official meteorological authorities (e.g. IMD) for severe safety warnings.",
  "official_alert_reference": {
    "authority": "India Meteorological Department (IMD)",
    "label": "Official alerts: check IMD",
    "url": "https://mausam.imd.gov.in/"
  },
  "active_advisories": [
    {
      "rule_id": "heat_caution",
      "category": "heat",
      "severity": "moderate",
      "title": "High Heat Index Advisory",
      "message": "Apparent temperature is 36.2°C. Stay hydrated and avoid prolonged midday direct sun.",
      "trigger_values": { "apparent_temperature": 36.2, "threshold": 35.0 }
    }
  ],
  "skipped_rules": []
}
```

---

## 5. Statistical Historical Analysis

### `POST /api/historical/comparison`
Computes multi-year statistical comparisons in deterministic Python code.

- **Request Body**:
```json
{
  "latitude": 23.0225,
  "longitude": 72.5714,
  "location_name": "Ahmedabad",
  "variable": "precipitation_sum",
  "start_month": 10,
  "start_day": 1,
  "end_month": 10,
  "end_day": 18,
  "target_year": 2026,
  "previous_years_count": 5
}
```
- **Response** (`200 OK`):
```json
{
  "location_name": "Ahmedabad",
  "variable": "precipitation_sum",
  "unit": "mm",
  "dataset_type": "reanalysis",
  "current_period": { "year": 2026, "total": 4.2, "mean_daily": 0.23, "coverage_pct": 100.0, "missing_days": 0 },
  "historical_baseline": {
    "years_sampled": 5,
    "historical_mean_total": 12.8,
    "historical_median_total": 10.4,
    "historical_std_dev": 4.1
  },
  "yearly_breakdown": [ ... ],
  "methodology_text": "Deterministic summation and arithmetic mean computed over identical Gregorian day-of-year windows across 5 preceding calendar years.",
  "limitations_text": "Sample sizes (5 years) are statistically insufficient to infer long-term climate trends or anthropomorphic change. Reanalysis data (ERA5) may exhibit slight bias relative to point rain-gauge observations."
}
```

---

## 6. Grounded AI Chat Assistant

### `POST /api/chat`
Performs end-to-end tool calling, RAG knowledge retrieval, and deterministic number verification.

- **Request Body**:
```json
{
  "message": "Will it rain tomorrow in Ahmedabad?",
  "session_id": "sess_12345",
  "language": "en",
  "units": "celsius"
}
```
- **Response** (`200 OK`):
```json
{
  "answer": "For tomorrow (2026-10-19) in Ahmedabad, the meteorological forecast indicates mainly clear skies with 0.0 mm expected precipitation and a maximum precipitation probability of 5%. Rain is highly unlikely.",
  "intent": "forecast",
  "location": { "name": "Ahmedabad", "country": "India", "coordinates": { "latitude": 23.0225, "longitude": 72.5714 } },
  "valid_period": { "start": "2026-10-19", "end": "2026-10-19" },
  "weather_data": { ... },
  "sources": [
    {
      "source_type": "weather_api",
      "title": "Open-Meteo Weather API",
      "url": "https://open-meteo.com/",
      "retrieved_at": "2026-10-18T07:15:00.000000Z",
      "license": "CC BY 4.0"
    }
  ],
  "limitations": [
    "Numerical forecast models lose precision beyond 3-5 days.",
    "Official alerts: check IMD for severe weather warnings."
  ],
  "verified": true
}
```

### `POST /api/chat/stream`
Server-Sent Events (SSE) streaming chat endpoint.
- **Content-Type**: `text/event-stream`
- **Events**:
  - `event: metadata` -> Initial JSON containing detected location, intent, and sources.
  - `event: token` -> Chunks of verified answer text.
  - `event: done` -> Final payload completion.

### `POST /api/chat/clear`
Clears session context and reset location bounds.
- **Request Body**: `{"session_id": "sess_12345"}`
- **Response** (`200 OK`): `{"status": "cleared"}`

---

## 7. Knowledge RAG Search

### `POST /api/knowledge/search`
Queries ChromaDB vector collection containing educational meteorological science documents.

- **Request Body**:
```json
{
  "query": "What is the difference between relative humidity and dew point?",
  "top_k": 3
}
```
- **Response** (`200 OK`):
```json
{
  "query": "What is the difference between relative humidity and dew point?",
  "results": [
    {
      "document_id": "humidity_dew_point.md",
      "chunk_id": "chunk_0",
      "title": "Understanding Humidity, Relative Humidity, and Dew Point",
      "publisher": "WeatherGPT Meteorological Science Corpus",
      "source_url": "project-authored",
      "relevance_score": 0.724,
      "text": "..."
    }
  ],
  "sufficient_evidence": true
}
```

---

## 8. Standard Error Responses
All endpoints consistently return structured errors conforming to `ErrorResponse`:

```json
{
  "error": "ValidationError",
  "detail": "Field 'latitude' must be between -90.0 and 90.0 degrees.",
  "retrieved_at": "2026-10-18T07:15:00.000000Z"
}
```
Standard HTTP Status Codes:
- `400 Bad Request`: Schema validation failure, unsupported date range, or period misalignment.
- `404 Not Found`: Location not found in geocoding index.
- `429 Too Many Requests`: Rate limit exceeded (configurable per minute window).
- `500 Internal Server Error`: Upstream weather provider error or internal failure with safe fallback.
