#!/bin/bash
set -e

# Start ChromaDB server in the background (HF Spaces single-container).
# The app connects to it via HTTP on localhost:8001 (default in config.py).
chroma run --path /app/data/chroma --port 8001 &

# Wait until ChromaDB is accepting requests
echo "Waiting for ChromaDB..."
until curl -sf http://localhost:8001/api/v1/heartbeat > /dev/null 2>&1; do
  sleep 1
done
echo "ChromaDB ready."

exec uvicorn api.main:app --host 0.0.0.0 --port 7860
