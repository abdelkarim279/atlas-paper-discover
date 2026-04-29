# ── Stage 1: build frontend ───────────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .
# Empty VITE_API_BASE_URL → relative /api/* paths → same-origin FastAPI
RUN VITE_API_BASE_URL= npm run build


# ── Stage 2: Python app ───────────────────────────────────────────────────────
FROM python:3.11-slim AS app

# libgomp1 is required by numba (umap-learn dependency)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies before copying code for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the embedding model so startup is instant (adds ~90 MB to image,
# avoids a cold HuggingFace download on every container start)
RUN python -c "\
from sentence_transformers import SentenceTransformer; \
SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

# Copy application source
COPY api/       api/
COPY ml/        ml/
COPY scripts/   scripts/
COPY pyproject.toml .
COPY start.sh   start.sh
RUN chmod +x start.sh

# Copy built frontend from stage 1
COPY --from=frontend-builder /build/dist frontend/dist/

RUN mkdir -p data/chroma
COPY data/atlas.json data/atlas.json

EXPOSE 7860

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:7860/health || exit 1

# start.sh launches ChromaDB on :8001 then uvicorn on :7860.
# docker-compose overrides CMD to run uvicorn directly (ChromaDB is a sidecar there).
CMD ["./start.sh"]
