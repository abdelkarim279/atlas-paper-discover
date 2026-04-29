import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from api.config import settings
from api.routers import atlas, health
from ml.embedder import Embedder
from ml.store import ChromaStore


def _configure_logging() -> None:
    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
    )


log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _configure_logging()

    atlas_path = Path(settings.atlas_path)
    if not atlas_path.exists():
        raise RuntimeError(
            f"Atlas file not found at {atlas_path}. "
            "Run `python scripts/build_atlas.py` first."
        )

    log.info("loading_atlas", path=str(atlas_path))
    with atlas_path.open(encoding="utf-8") as f:
        atlas_data: list[dict] = json.load(f)

    app.state.atlas = atlas_data
    app.state.atlas_index = {p["id"]: p for p in atlas_data}
    log.info("atlas_loaded", count=len(atlas_data))

    log.info("loading_embedder", model=settings.embed_model)
    app.state.embedder = Embedder(model_name=settings.embed_model)
    log.info("embedder_ready")

    log.info("loading_chroma", host=settings.chroma_host, port=settings.chroma_port)
    app.state.chroma = ChromaStore(
        host=settings.chroma_host, port=settings.chroma_port, collection_name="papers"
    )
    log.info("chroma_ready")

    yield

    log.info("shutdown")


app = FastAPI(
    title="Embedding Atlas",
    version="0.1.0",
    description="Interactive embedding map of arXiv cs.LG abstracts.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(atlas.router, prefix="/api")

# Serve the built frontend (HF Spaces / same-origin deployment).
# Built with: cd frontend && VITE_API_BASE_URL= npm run build
_dist = Path("frontend/dist")
if _dist.exists():
    app.mount("/assets", StaticFiles(directory=str(_dist / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str) -> FileResponse:
        return FileResponse(str(_dist / "index.html"))
