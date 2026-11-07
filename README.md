<div align="center">

# 🌤️ WeatherGPT
### Next-Generation Agentic AI Meteorological Intelligence & Decision Radars

[![CI Pipeline](https://github.com/prachizala/Weather-Gpt/actions/workflows/ci.yml/badge.svg)](https://github.com/prachizala/Weather-Gpt/actions/workflows/ci.yml)
[![Python 3.11](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React Vite](https://img.shields.io/badge/React_Vite-18+-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Docker](https://img.shields.io/badge/Docker-Multi--Stage-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-Gemini_2.5-6366F1?style=for-the-badge&logo=openai&logoColor=white)](https://openrouter.ai)
[![License: CC BY 4.0](https://img.shields.io/badge/Data_License-CC_BY_4.0-lightgrey.svg?style=for-the-badge)](https://creativecommons.org/licenses/by/4.0/)

<p align="center">
  <strong>WeatherGPT</strong> is an advanced full-stack AI meteorological application that bridges scientific atmospheric physics with daily human decisions. Combining factual retrieval-augmented generation (RAG), strict anti-hallucination number verification, real-time Doppler precipitation sweeps, clinical biometeorology, and home energy modeling.
</p>

[✨ Live Features](#-key-features--market-differentiators) • [🚀 Quickstart](#-quickstart) • [🐳 Docker & Deployment](#-docker--cloud-deployment) • [📱 PWA Setup](#-progressive-web-app-pwa) • [🧪 Test Suite](#-automated-e2e-testing)

---

</div>

## 📌 Repository Description / Tagline
> **"Agentic AI Meteorological Intelligence Dashboard with Grounded Conversational RAG, Real-Time Micro-Climate Radars, Clinical Biometeorology, Solar/AC Energy Yield, and PWA Mobile Support."**

---

## 🌟 Key Features & Market Differentiators

Unlike traditional weather apps (Apple Weather, AccuWeather, Windy) that simply display static temperature numbers, **WeatherGPT** translates complex atmospheric data into actionable life intelligence:

### 1. 👔 Daily Lifestyle & Activity Intelligence (`LifestyleIntelligenceCard`)
* **Outfit & Layering Engine**: Analyzes wind chill, solar irradiance, and diurnal temperature spreads to recommend clothing layers.
* **Cardio & Running Window**: Finds the exact sweet-spot hours with optimal temperature, low humidity, and acceptable AQI.
* **Laundry & Drying Velocity Index**: Computes natural textile drying duration based on vapor pressure deficit (VPD) and wind.
* **Hydration & Heat Stress Shield**: Calculates sweat rate index and mineral water intake requirements.

### 2. 🛡️ Event & Weekend Trip Weather Shield (`EventWeatherShieldCard`)
* 7-day multi-slot simulation (Morning, Afternoon, Evening, Night) for outdoor activities:
  - 🏏 **Cricket & Outdoor Sports** (Rain stoppage & pitch sogginess risk)
  - 🚗 **Highway Road Trips** (Fog, wet-braking friction, and crosswind hazard)
  - ⛺ **Camping & Trekking** (Dew point condensation and overnight minimums)
  - 💍 **Weddings & Open-Air Events** (Disruption risk score 0–100% with contingency verdict)

### 3. 🎙️ 30-Second Morning Audio Bulletin (`VoiceBriefingCard`)
* Radio AI host bulletin in **English (EN)**, **Hindi (HI)**, and **Gujarati (GU)**.
* **Smart Dual-Layer Voice Engine**: Uses native Indic TTS voices when present; automatically falls back to Indian English voices (`Microsoft Heera/Ravi`) paired with natural phonetic transliteration to ensure zero skipped words or distorted phonemes.
* Animated audio soundwave visualizer and live synced bilingual subtitles.

### 4. 🔬 Meteorological Anomaly Storyteller (`WeatherAnomalyCard`)
* Automatically detects atmospheric anomalies:
  - Temperature Inversion Layers (valley/urban smog traps).
  - Post-monsoon convective cloud surges.
  - Radiational cooling with extreme day/night diurnal spreads.
* Provides scientific physical mechanisms behind why the weather is behaving unusually.

### 5. 🧭 Wind Vector Streamline Radar (`WindStreamlineCard`)
* High-performance **60 FPS HTML5 Canvas particle streamline vectors** reacting to real-time wind speed and directional azimuth.
* Integrated **Beaufort Aerodynamic Force Scale** (Light / Gentle / Moderate / Gale).
* Live magnetic compass needle and adjustable streamline density (`normal`, `dense`, `vortex`).

### 6. 🏥 Clinical Biometeorology & Health Radar (`BiometeorologyCard`)
* 🧠 **Migraine & Barometric Headache Strain**: Calculates barometric pressure delta from 1013.25 hPa standard sea-level to predict vascular headaches.
* 🫁 **Asthma & Bronchial Load**: Correlates fine PM2.5, NO2, and humidity extremes.
* ☀️ **UV & Vitamin D Window**: Safe non-burning sun exposure countdown for healthy Vitamin D synthesis.
* 🌿 **Sinus & Dust Dispersion Index**: Tracks ground particulate suspension from dry winds.

### 7. 📡 Minutely Precipitation & Doppler PPI Radar (`PrecipitationNowcastCard`)
* Minute-by-minute timeline for the next 60 minutes (`0m`, `+10m`, `+20m`, `+30m`, `+40m`, `+50m`, `+60m`).
* Synthetic 360° Plan Position Indicator (PPI) circular Doppler radar sweep with interactive 15 km / 30 km / 60 km radius ranges.
* Smart commute advice (Safe travel window before incoming rain).

### 8. ⚡ Home AC Thermal Load & Solar PV Yield (`EnergyWeatherCard`)
* **AC Power Bill Saver**: Ambient thermal load calculator with recommended thermostat setpoint (e.g. 25°C) delivering ~24% electrical savings.
* **Rooftop Solar PV Efficiency**: Direct vs diffuse sunlight yield accounting for aerosol cloud cover and PM particulate scattering.
* **Parked Vehicle Cabin Oven Alert**: Predicts interior car temperature spike (up to 58°C in 20 mins) for child and pet safety.

### 9. 📱 Progressive Web App (PWA) & Offline Shell
* Standalone mobile installation on Android and iOS ("Add to Home Screen").
* High-resolution maskable icons (192×192 & 512×512) and Web App Manifest (`manifest.webmanifest`).
* Service Worker (`sw.js`) app shell pre-caching for instant sub-second opening even in offline tunnels.

### 10. 📸 9:16 Social Weather Story Generator (`WeatherStoryShareModal`)
* One-click generation of ultra-crisp 1080×1920 Instagram Story and WhatsApp status graphic cards.
* Client-side HTML5 Canvas PNG rendering with zero external library dependencies.
* Native OS mobile Web Share API integration.

### 11. 🛣️ Highway Route & Travel Micro-Climate Corridor (`RouteWeatherCorridorCard`)
* Multi-waypoint micro-climate progression across popular Indian travel corridors (Ahmedabad ➔ Mumbai, Delhi ➔ Jaipur, Mumbai ➔ Pune, Bengaluru ➔ Mysuru).
* Waypoint temperature variations, cloud transitions, and crosswind gusts.
* Critical driver road safety hazards: Road wet-friction coefficient, low visibility fog points, and low-angle sun glare hazard time slots.

### 12. 🎧 Atmospheric Procedural Web Audio Soundscape (`AmbientSoundscapeCard`)
* Native Web Audio API generative synthesizer converting real-time meteorological variables into live procedural acoustics.
* Synthesizes continuous pink noise buffers, aerodynamic lowpass/bandpass wind filter modulations (synced to live km/h), rain droplet resonant frequencies, and soothing 108 Hz night grounding drones.
* Zero external audio files or network stream downloads; 100% synthesized in the browser with presets (`Live Weather Sync`, `Gentle Rain Drops`, `Aerodynamic Breeze`, `Deep Night Calm`, `Study & Sleep Focus`).

### 13. 🔭 Celestial & Stargazing Clarity Radar (`CelestialSkyRadarCard`)
* **Astronomical Seeing Index (0–100%)**: Computes sky transparency from cloud cover, relative humidity dew point, and wind shear.
* **Exact Moon Phase & Synodic Lunar Illumination**: Mathematical algorithm calculating current moon phase, illumination percentage, and lunar age.
* **Planetary & Deep-Sky Targets**: Real-time visibility windows for Jupiter, Saturn, Mars, and open star clusters (Pleiades M45).
* **Photography Hours**: Precise calculations for Evening Golden Hour, Dusk Blue Hour, and Astronomical True Night (< -18° solar angle).

### 14. 🌾 Agro-Climate & Smart Irrigation Shield (`AgroClimateShieldCard`)
* **Evapotranspiration ($ET_0$) Estimator**: Hargreaves-Samani model estimating daily soil moisture loss (mm/day) from temperature, humidity, wind, and solar radiation proxy.
* **Smart Irrigation Advisory**: Recommends exact watering cycles or advises skipping watering when upcoming precipitation is forecasted to save 100% irrigation water.
* **Optimal Spraying Window**: Real-time assessment of wind drift hazard, rain wash-off probability, and high-temperature foliar vaporization risk.
* **Crop Disease & Fungal Blight Risk**: Smith Period incubation warnings for powdery mildew, downy mildew, and leaf spots.

---

## 🏗️ Architecture & Grounded RAG Pipeline

```text
                                  ┌────────────────────────┐
                                  │      Client (PWA)      │
                                  │ React 18 + Vite + TS   │
                                  └───────────┬────────────┘
                                              │ HTTP / SSE Stream
                                              ▼
                                  ┌────────────────────────┐
                                  │    FastAPI Gateway     │
                                  │ Security, Rate Limiter │
                                  └─────┬────────────┬─────┘
                                        │            │
                  ┌─────────────────────┘            └────────────────────┐
                  ▼                                                       ▼
       ┌──────────────────────┐                               ┌──────────────────────┐
       │   Meteorological     │                               │ Grounded RAG & LLM   │
       │   Data Ingestion     │                               │ Orchestration        │
       └──────────┬───────────┘                               └──────────┬───────────┘
                  │                                                      │
         ┌────────┴────────┐                                   ┌─────────┴─────────┐
         │  Open-Meteo API │                                   │ ChromaDB (Vectors)│
         │  ECMWF, GFS,    │                                   │ 18 Peer-Reviewed  │
         │  ERA5 Reanalysis│                                   │ Atmospheric Docs  │
         └─────────────────┘                                   └─────────┬─────────┘
                                                                         │
                                                               ┌─────────┴─────────┐
                                                               │ Number Verifier & │
                                                               │ Hallucination Bed │
                                                               └─────────┬─────────┘
                                                                         │
                                                               ┌─────────┴─────────┐
                                                               │ OpenRouter Engine │
                                                               │ Gemini 2.5 Flash  │
                                                               └───────────────────┘
```

* **Anti-Hallucination Number Verifier**: Every numerical fact in the LLM response is checked against raw meteorological API payloads. Mismatches trigger automatic self-correction or deterministic fallback.
* **Deterministic Relative Dates**: Natural phrases like *"this weekend"*, *"day after tomorrow"*, or *"कल"* are resolved deterministically in the target city's timezone.
* **Multilingual Grounding**: Full support for English, Hindi (हिंदी), and Gujarati (ગુજરાતી), with Indic numeral normalizer (mapping `०-९` and `૦-૯` to ASCII for mathematical verification).

---

## 🚀 Quickstart

### 1. Clone & Setup Virtual Environment
```bash
git clone https://github.com/prachizala/Wheather-Gpt.git
cd Wheather-Gpt

# Create Python environment
python -m venv .venv
.\.venv\Scripts\activate       # Windows
source .venv/bin/activate      # Linux / macOS

pip install -r requirements.txt
```

### 2. Configure Environment (`.env`)
```bash
cp .env.example .env
```
Add your OpenRouter key:
```ini
OPENROUTER_API_KEY=your_openrouter_api_key_here
LLM_MODEL_MAIN=google/gemini-2.5-flash
LLM_MODEL_FAST=google/gemini-2.5-flash-lite
```

### 3. Start Backend & Frontend
```bash
# Terminal 1: Backend
uvicorn backend.app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```
Visit `http://localhost:5173` in your browser.

---

## 🐳 Docker & Cloud Deployment

### 1-Click Free Deployment on Render.com
1. Go to [Render.com](https://render.com) → **New Web Service**.
2. Connect `https://github.com/prachizala/Wheather-Gpt.git`.
3. Select **Docker** environment and **Free Plan**.
4. Add environment variable: `OPENROUTER_API_KEY`.
5. Hit **Create Web Service**! Render will automatically deploy a unified production URL.

### Single-Command Docker Deployment
```bash
docker compose up --build -d
```
* Web App: `http://localhost` (Port 80)
* REST API: `http://localhost:8000` (Port 8000)

---

## 🧪 Automated E2E Testing

WeatherGPT includes a comprehensive Playwright End-to-End test suite ensuring visual layout integrity, responsive behavior, accessibility, and chart stability:

```bash
# Run all Playwright E2E UI tests
pytest tests/e2e/test_ui_playwright.py -v
```

```text
============================= test session starts =============================
tests/e2e/test_ui_playwright.py::test_ui_demo_flow PASSED                [ 16%]
tests/e2e/test_ui_playwright.py::test_ui_error_state_handling PASSED     [ 33%]
tests/e2e/test_ui_playwright.py::test_ui_keyboard_navigation_and_accessibility PASSED [ 50%]
tests/e2e/test_ui_playwright.py::test_ui_chat_panel_interaction_and_layout PASSED [ 66%]
tests/e2e/test_ui_playwright.py::test_ui_visual_integrity_and_diagnostics PASSED [ 83%]
tests/e2e/test_ui_city_search_dropdown_no_overlap PASSED                [100%]

============================= 6 passed in 34.43s ==============================
```

---

## 📄 License & Attribution
- Weather Data: Provided by [Open-Meteo.com](https://open-meteo.com/) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (Educational & Non-Commercial use).
- Official India Weather Warnings: Refer to [India Meteorological Department (IMD)](https://mausam.imd.gov.in/).
- Built with ❤️ by [Prachi Zala](https://github.com/prachizala).
