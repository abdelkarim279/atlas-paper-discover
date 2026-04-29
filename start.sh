#!/bin/bash
set -e

# Start ChromaDB server in the background (HF Spaces single-container).
chroma run --path /app/data/chroma --port 8001 &

echo "Waiting for ChromaDB..."
until curl -sf http://localhost:8001/api/v1/heartbeat > /dev/null 2>&1; do
  sleep 1
done
echo "ChromaDB ready."

# Populate ChromaDB from atlas.json on first boot (no sqlite committed to git).
python scripts/index_chroma.py

exec uvicorn api.main:app --host 0.0.0.0 --port 7860
