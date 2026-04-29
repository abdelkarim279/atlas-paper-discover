import asyncio
import time

import structlog
from fastapi import APIRouter, Depends, HTTPException

from api.deps import get_atlas, get_atlas_index, get_chroma, get_embedder
from api.schemas.atlas import (
    DocumentResponse,
    PointResponse,
    SearchHit,
    SearchRequest,
    SearchResponse,
)
from ml.embedder import Embedder
from ml.store import ChromaStore

log = structlog.get_logger()
router = APIRouter(tags=["atlas"])


@router.get("/points", response_model=list[PointResponse])
async def get_points(atlas: list[dict] = Depends(get_atlas)) -> list[PointResponse]:
    return [
        PointResponse(
            id=p["id"],
            x=p["x"],
            y=p["y"],
            title=p["title"],
            date=p["date"],
            categories=p["categories"],
        )
        for p in atlas
    ]


@router.get("/document/{arxiv_id}", response_model=DocumentResponse)
async def get_document(
    arxiv_id: str,
    atlas_index: dict[str, dict] = Depends(get_atlas_index),
) -> DocumentResponse:
    point = atlas_index.get(arxiv_id)
    if point is None:
        raise HTTPException(status_code=404, detail=f"Document '{arxiv_id}' not found")
    return DocumentResponse(
        id=point["id"],
        x=point["x"],
        y=point["y"],
        title=point["title"],
        abstract=point["abstract"],
        categories=point["categories"],
        date=point["date"],
        url=point["url"],
    )


@router.post("/search", response_model=SearchResponse)
async def search(
    req: SearchRequest,
    embedder: Embedder = Depends(get_embedder),
    chroma: ChromaStore = Depends(get_chroma),
    atlas_index: dict[str, dict] = Depends(get_atlas_index),
) -> SearchResponse:
    t0 = time.monotonic()

    query_vec = await asyncio.to_thread(embedder.embed, [req.query])
    results = await asyncio.to_thread(chroma.query, query_vec[0], req.k)

    hits: list[SearchHit] = []
    for doc_id, distance in zip(results["ids"][0], results["distances"][0]):
        point = atlas_index.get(doc_id)
        if point is None:
            continue
        hits.append(
            SearchHit(
                id=doc_id,
                x=point["x"],
                y=point["y"],
                title=point["title"],
                date=point["date"],
                score=float(1.0 - distance),  # cosine similarity from L2 distance
            )
        )

    latency_ms = int((time.monotonic() - t0) * 1000)
    log.info("search_complete", query=req.query, k=req.k, hits=len(hits), latency_ms=latency_ms)

    return SearchResponse(results=hits, query=req.query, latency_ms=latency_ms)
