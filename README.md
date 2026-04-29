---
title: Paper Atlas
emoji: 🗺
colorFrom: violet
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Interactive embedding map of 5000 arXiv ML papers
---

# Paper Atlas

An interactive 2D map of **5,000 arXiv machine learning papers** (cs.LG, 2024–2025), laid out by semantic similarity. Papers that discuss similar ideas cluster together — browse the landscape, search by concept, and open any paper directly on arXiv.

## How it works

1. **Offline pipeline** — abstracts are embedded with `all-MiniLM-L6-v2` (sentence-transformers), then projected to 2D with UMAP. The result is a static `atlas.json` served at startup.
2. **Search** — your query is embedded on-the-fly, ChromaDB returns the nearest neighbors, and the matching points light up on the map.
3. **Frontend** — deck.gl renders 5,000 WebGL points at 60 fps with pan/zoom. Click any point for the full abstract and a link to arXiv.

## Usage

- **Pan / zoom** — drag and scroll on the map
- **Search** — type a concept, method, or keyword in the bar at the top (e.g. "mixture of experts", "diffusion policy", "in-context learning")
- **Select a paper** — click a point or a result in the sidebar to read the abstract and open on arXiv
- **Filter by category** — toggle arXiv subject tags in the legend (bottom-left)

## Stack

| Layer | Technology |
|---|---|
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` |
| Dimensionality reduction | UMAP |
| Vector search | ChromaDB |
| Backend | FastAPI (Python 3.11) |
| Frontend | Vite + React + TypeScript + Tailwind |
| Visualization | deck.gl (WebGL ScatterplotLayer) |
| Deploy | HF Spaces (Docker SDK) |

## Local setup

```bash
# 1. Start ChromaDB
docker compose up -d chromadb

# 2. Python environment
python -m venv .venv
source .venv/Scripts/activate   # Windows; use .venv/bin/activate on Mac/Linux
pip install -r requirements-dev.txt

# 3. Configure
cp .env.example .env

# 4. Build the atlas (run once — fetches ~5k papers, embeds, reduces to 2D)
python scripts/build_atlas.py --start-date 2024-04-01 --end-date 2025-04-01 --max-papers 5000

# 5. Start the API (dev)
uvicorn api.main:app --reload

# 6. Start the frontend (dev)
cd frontend && npm install && npm run dev
```

Or run the full stack with Docker:

```bash
# atlas.json must already exist from step 4 above
docker compose up --build
# open http://localhost:7860
```

## Project structure

```
api/          FastAPI app — /api/points, /api/search, /api/document/{id}
ml/           Embedder, UMAP reducer, ChromaDB client
scripts/      build_atlas.py — offline ingestion pipeline
frontend/     Vite + React + deck.gl visualization
data/         atlas.json + ChromaDB store (gitignored, built locally)
```
