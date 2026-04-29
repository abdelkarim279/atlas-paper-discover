from fastapi import Request

from ml.embedder import Embedder
from ml.store import ChromaStore


def get_atlas(request: Request) -> list[dict]:
    return request.app.state.atlas


def get_atlas_index(request: Request) -> dict[str, dict]:
    return request.app.state.atlas_index


def get_embedder(request: Request) -> Embedder:
    return request.app.state.embedder


def get_chroma(request: Request) -> ChromaStore:
    return request.app.state.chroma
