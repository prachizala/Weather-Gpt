# WeatherGPT Backend Dockerfile
FROM python:3.11-slim

# Prevent python from buffering stdout/stderr and writing pyc files
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency requirements
COPY requirements.txt .

# Install Python packages
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code and data documents
COPY backend /app/backend
COPY data /app/data

# Ensure data directory for persistent ChromaDB and ingested vector index
RUN mkdir -p /app/data/chroma_db

# Pre-ingest meteorological knowledge documents into ChromaDB
RUN python -m backend.app.rag.ingest

# Create non-root user for runtime security
RUN useradd -u 1001 -m -s /bin/bash appuser && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Health check using the /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Launch production ASGI server
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
