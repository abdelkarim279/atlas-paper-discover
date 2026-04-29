"""
Populate ChromaDB from data/atlas.json.
Run at container startup when ChromaDB is empty.
"""
import json
import os
import sys
from pathlib import Path

# Allow running from project root or scripts/
sys.path.insert(0, str(Path(__file__).parent.parent))

from ml.embedder import Embedder
from ml.store import ChromaStore

ATLAS_PATH = os.getenv("ATLAS_PATH", "data/atlas.json")
CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8001"))
EMBED_MODEL = os.getenv("EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
BATCH_SIZE = 256


def main() -> None:
    store = ChromaStore(host=CHROMA_HOST, port=CHROMA_PORT)
    if store.count > 0:
        print(f"ChromaDB already has {store.count} documents — skipping indexing.")
        return

    print(f"Loading atlas from {ATLAS_PATH}…")
    papers = json.loads(Path(ATLAS_PATH).read_text(encoding="utf-8"))
    print(f"Embedding {len(papers)} abstracts with {EMBED_MODEL}…")

    embedder = Embedder(EMBED_MODEL)
    abstracts = [p["abstract"] for p in papers]
    embeddings = embedder.embed(abstracts, batch_size=BATCH_SIZE)

    ids = [p["id"] for p in papers]
    metadatas = [
        {
            "title": p["title"],
            "categories": p["categories"][0] if p["categories"] else "",
            "date": p["date"],
            "url": p.get("url", ""),
            "x": p["x"],
            "y": p["y"],
        }
        for p in papers
    ]

    print("Upserting into ChromaDB…")
    store.upsert(ids, embeddings, metadatas)
    print(f"Done — {store.count} documents indexed.")


if __name__ == "__main__":
    main()
