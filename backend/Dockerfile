FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# System deps (curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Install uv (fast resolver), then install dependencies
COPY requirements.txt .
RUN pip install --quiet uv && uv pip install --system --no-cache -r requirements.txt

# Pre-download fastembed model so first news-ingestion run is instant
RUN python -c "from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-en-v1.5')" || true

# Copy source (overridden by volume mount in dev, still needed for prod)
COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
