# WeatherGPT — Architecture Decisions & Interview Cheatsheet

This document provides a concise architectural guide and interview cheatsheet for **WeatherGPT**, explaining key technical choices in simple, direct language.

---

## 1. Project Overview & Technical Stack

| Property | Details |
|---|---|
| **Core Concept** | Next-generation agentic AI meteorological intelligence platform translating raw atmospheric physics into actionable human decisions. |
| **Backend Stack** | Python, FastAPI, Pydantic, OpenRouter (Gemini 2.5), Open-Meteo API integration |
| **Vector RAG Engine** | ChromaDB with strict numerical anti-hallucination guardrails |
| **Frontend Stack** | React (Vite), TypeScript, Tailwind CSS, Lucide icons, PWA mobile manifest |
| **Audio Bulletin** | Bilingual Voice Briefing engine (EN/HI/GU) with phonetic fallback synthesis |
| **Deployment** | Multi-stage Docker containerization with Render cloud configuration |

---

## 2. Key Architectural Decisions

### 1. Actionable Decision Radars vs. Static Weather Numbers
- Traditional weather apps only display numerical metrics (e.g., `28°C, 65% Humidity`). WeatherGPT models the underlying physics to generate domain intelligence:
  - **Outdoor Cardio Window:** Finds hours with optimal wet-bulb globe temperature (WBGT) and acceptable Air Quality Index (AQI).
  - **Vapor Pressure Deficit (VPD):** Computes natural laundry drying velocity based on relative humidity and boundary wind speed.
  - **Event Shield:** Runs multi-slot outdoor probability simulations for weddings, road trips, and sports.

### 2. Guarded RAG Against Number Hallucination
- LLMs are prone to hallucinating temperatures and precipitation percentages. WeatherGPT queries authoritative numerical meteorological endpoints first, freezes those ground-truth facts in a structured schema, and feeds them to the LLM prompt as immutable context.

---

## 3. Technical Interview Cheatsheet

### Q: How did you ensure the LLM doesn't hallucinate temperature forecasts?
> **Answer:** "I implemented a strict two-stage retrieval pipeline: the backend first fetches deterministic JSON telemetry from meteorological data feeds (temperature, dew point, wind vectors, AQI). These verified floats are locked into a Pydantic schema before constructing the LLM prompt, ensuring the AI only translates verified facts into conversational advice."
