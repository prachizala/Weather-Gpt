# 🚀 WeatherGPT Deployment Guide

This guide explains how to deploy **WeatherGPT** to production on free cloud hosting platforms, Docker containers, or self-hosted servers.

---

## 🌟 Option 1: Render.com (Recommended Free Cloud Hosting)

Render provides free hosting for Docker web services and automatically builds directly from your GitHub repository.

### Quick Steps:
1. Sign up / Log in to [Render.com](https://render.com/).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository:
   ```text
   https://github.com/prachizala/Wheather-Gpt.git
   ```
4. Configure service settings:
   - **Name**: `weathergpt`
   - **Region**: Oregon (US West) or Singapore
   - **Environment**: **Docker** (Render will automatically detect the root `Dockerfile`)
   - **Plan**: **Free**
5. Add Environment Variables under **Advanced**:
   - `OPENROUTER_API_KEY`: `your_openrouter_api_key_here`
   - `LLM_MODEL_MAIN`: `google/gemini-2.5-flash`
   - `LLM_MODEL_FAST`: `google/gemini-2.5-flash-lite`
6. Click **Create Web Service**. Render will build the unified frontend + backend image and give you a free HTTPS URL:
   ```text
   https://weathergpt-xxxx.onrender.com
   ```

---

## 🐳 Option 2: Docker / Docker Compose (Local or Cloud VPS)

Run the full production stack with a single command on any server with Docker installed.

### Unified Single Container:
```bash
# Build unified image
docker build -t weathergpt .

# Run container
docker run -d -p 8000:8000 \
  -e OPENROUTER_API_KEY="your-api-key" \
  --name weathergpt-live weathergpt
```
Visit: `http://localhost:8000`

### Multi-Container Stack (Nginx + FastAPI):
```bash
docker compose up --build -d
```
- Frontend (Nginx PWA): `http://localhost` (port 80)
- Backend (FastAPI API): `http://localhost:8000`

---

## ⚡ Option 3: Railway.app (1-Click Deployment)

1. Go to [Railway.app](https://railway.app/).
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select `Wheather-Gpt`.
4. Add environment variable `OPENROUTER_API_KEY`.
5. Railway will automatically build the `Dockerfile` and generate an active public `.up.railway.app` URL.

---

## 📱 Progressive Web App (PWA) on Mobile

Once your deployed URL is live (e.g. `https://weathergpt.onrender.com`):
1. Open the URL in **Google Chrome (Android)** or **Safari (iOS)**.
2. Tap the **"Install App"** button in the header (or browser menu → **Add to Home screen**).
3. WeatherGPT will install as a standalone mobile application with an offline cache shell!
