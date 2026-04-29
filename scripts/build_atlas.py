"""
Offline pipeline: arXiv fetch → embed → ChromaDB → UMAP → atlas.json

Usage:
    python scripts/build_atlas.py \
        --start-date 2024-04-01 \
        --end-date 2025-04-01 \
        --max-papers 5000 \
        --output-dir data/

Each step is skipped if its output already exists (resumable runs).
Delete the relevant output file to force a re-run of that step.
"""

import sys
from pathlib import Path

# Make the project root importable when the script is run directly.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import argparse
import json
import logging
import sys
import time
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

import numpy as np
import structlog
from tqdm import tqdm

# ── logging ───────────────────────────────────────────────────────────────────

structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)
log = structlog.get_logger()

# ── arXiv fetch ───────────────────────────────────────────────────────────────

_ARXIV_API = "https://export.arxiv.org/api/query"
_NS = {"atom": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}
_PAGE_SIZE = 100
_RETRY_WAIT = 5.0  # seconds between retries on rate-limit


def _parse_entry(entry: ET.Element) -> dict | None:
    id_raw = entry.findtext("atom:id", namespaces=_NS) or ""
    arxiv_id = id_raw.split("/abs/")[-1].strip()
    title = (entry.findtext("atom:title", namespaces=_NS) or "").replace("\n", " ").strip()
    abstract = (entry.findtext("atom:summary", namespaces=_NS) or "").replace("\n", " ").strip()
    published = (entry.findtext("atom:published", namespaces=_NS) or "")[:10]
    categories = [
        t.get("term", "")
        for t in entry.findall("atom:category", namespaces=_NS)
        if t.get("term")
    ]
    url = f"https://arxiv.org/abs/{arxiv_id}"
    if not (arxiv_id and title and abstract):
        return None
    return {
        "id": arxiv_id,
        "title": title,
        "abstract": abstract,
        "categories": categories,
        "date": published,
        "url": url,
    }


def fetch_papers(
    start_date: date,
    end_date: date,
    max_papers: int,
    output_path: Path,
) -> list[dict]:
    if output_path.exists():
        log.info("fetch_skip", reason="file_exists", path=str(output_path))
        with output_path.open(encoding="utf-8") as f:
            return json.load(f)

    import httpx

    papers: list[dict] = []
    start_iso = str(start_date)
    end_iso = str(end_date)
    start_str = start_date.strftime("%Y%m%d")
    end_str = end_date.strftime("%Y%m%d")

    log.info("fetch_start", start_date=start_iso, end_date=end_iso, max_papers=max_papers)
    offset = 0
    done = False
    with tqdm(total=max_papers, desc="Fetching arXiv", unit="papers") as pbar:
        while len(papers) < max_papers and not done:
            # Build the URL as a raw string so httpx does not re-encode + as %2B.
            # arXiv requires + as the space/AND separator and accepts bare [ ] in
            # query strings; percent-encoding them causes the date filter to be ignored.
            url = (
                f"{_ARXIV_API}?"
                f"search_query=cat:cs.LG+AND+submittedDate:[{start_str}0000+TO+{end_str}2359]"
                f"&start={offset}&max_results={_PAGE_SIZE}"
                f"&sortBy=submittedDate&sortOrder=descending"
            )
            for attempt in range(3):
                try:
                    resp = httpx.get(url, timeout=30)
                    if resp.status_code == 429:
                        log.warning("rate_limited", attempt=attempt, wait=_RETRY_WAIT)
                        time.sleep(_RETRY_WAIT)
                        continue
                    resp.raise_for_status()
                    break
                except httpx.HTTPError as exc:
                    if attempt == 2:
                        raise RuntimeError(f"arXiv API failed after 3 attempts: {exc}") from exc
                    time.sleep(_RETRY_WAIT)

            root = ET.fromstring(resp.text)
            entries = root.findall("atom:entry", namespaces=_NS)
            if not entries:
                log.info("fetch_exhausted", total=len(papers))
                break

            added = 0
            for entry in entries:
                paper = _parse_entry(entry)
                if not paper:
                    continue
                if paper["date"] < start_iso:
                    done = True
                    break
                if paper["date"] <= end_iso:
                    papers.append(paper)
                    added += 1
                    if len(papers) >= max_papers:
                        done = True
                        break
            pbar.update(added)
            offset += len(entries)
            # arXiv rate-limit: 3 seconds between requests
            time.sleep(3)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(papers, f, ensure_ascii=False)
    log.info("fetch_done", count=len(papers), path=str(output_path))
    return papers


# ── embed + store ─────────────────────────────────────────────────────────────

def embed_and_store(
    papers: list[dict],
    embed_model: str,
    chroma_host: str,
    chroma_port: int,
) -> np.ndarray:
    from ml.embedder import Embedder
    from ml.store import ChromaStore

    store = ChromaStore(host=chroma_host, port=chroma_port, collection_name="papers")

    if store.count == len(papers):
        log.info("embed_skip", reason="chroma_count_matches", count=store.count)
        # ChromaDB doesn't expose a bulk-get-embeddings endpoint, so we
        # re-embed for UMAP rather than round-trip. At 5k papers ~60s.
        log.info("re_embedding_for_umap")

    log.info("embedding_start", model=embed_model, papers=len(papers))
    embedder = Embedder(model_name=embed_model)

    abstracts = [p["abstract"] for p in papers]
    batch_size = 64
    all_embeddings: list[np.ndarray] = []

    for start in tqdm(range(0, len(abstracts), batch_size), desc="Embedding", unit="batch"):
        batch = abstracts[start : start + batch_size]
        vecs = embedder.embed(batch, batch_size=batch_size)
        all_embeddings.append(vecs)

    embeddings = np.vstack(all_embeddings)
    log.info("embedding_done", shape=list(embeddings.shape))

    ids = [p["id"] for p in papers]
    metadatas = [
        {
            "title": p["title"],
            "abstract": p["abstract"][:500],  # ChromaDB metadata has a size limit
            "categories": ",".join(p["categories"]),
            "date": p["date"],
            "url": p["url"],
        }
        for p in papers
    ]

    log.info("chroma_upsert_start", count=len(ids))
    store.upsert(ids=ids, embeddings=embeddings, metadatas=metadatas)
    log.info("chroma_upsert_done")

    return embeddings


# ── UMAP reduction ────────────────────────────────────────────────────────────

def reduce(embeddings: np.ndarray) -> np.ndarray:
    from ml.reducer import fit_transform

    log.info("umap_start", input_shape=list(embeddings.shape))
    coords = fit_transform(embeddings)
    log.info("umap_done", output_shape=list(coords.shape))
    return coords


# ── export ────────────────────────────────────────────────────────────────────

def export_atlas(
    papers: list[dict],
    coords: np.ndarray,
    output_path: Path,
) -> None:
    atlas = [
        {
            "id": p["id"],
            "x": float(coords[i, 0]),
            "y": float(coords[i, 1]),
            "title": p["title"],
            "abstract": p["abstract"],
            "categories": p["categories"],
            "date": p["date"],
            "url": p["url"],
        }
        for i, p in enumerate(papers)
    ]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(atlas, f, ensure_ascii=False)
    log.info("atlas_written", count=len(atlas), path=str(output_path))


# ── CLI ───────────────────────────────────────────────────────────────────────

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build the Embedding Atlas from arXiv cs.LG abstracts."
    )
    parser.add_argument(
        "--start-date",
        type=date.fromisoformat,
        required=True,
        help="Earliest submission date (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--end-date",
        type=date.fromisoformat,
        required=True,
        help="Latest submission date (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--max-papers",
        type=int,
        default=5000,
        help="Maximum papers to fetch (default: 5000)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data"),
        help="Directory for output files (default: data/)",
    )
    parser.add_argument(
        "--embed-model",
        default="sentence-transformers/all-MiniLM-L6-v2",
        help="Sentence-transformers model name",
    )
    parser.add_argument(
        "--chroma-host",
        default="localhost",
        help="ChromaDB server host (default: localhost)",
    )
    parser.add_argument(
        "--chroma-port",
        type=int,
        default=8001,
        help="ChromaDB server port (default: 8001)",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    output_dir: Path = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    raw_path = output_dir / "raw_papers.json"
    atlas_path = output_dir / "atlas.json"

    papers = fetch_papers(
        start_date=args.start_date,
        end_date=args.end_date,
        max_papers=args.max_papers,
        output_path=raw_path,
    )

    if not papers:
        log.error("no_papers_fetched")
        sys.exit(1)

    embeddings = embed_and_store(
        papers=papers,
        embed_model=args.embed_model,
        chroma_host=args.chroma_host,
        chroma_port=args.chroma_port,
    )

    coords = reduce(embeddings)

    export_atlas(papers=papers, coords=coords, output_path=atlas_path)
    log.info("build_complete", papers=len(papers), atlas=str(atlas_path))


if __name__ == "__main__":
    main()
