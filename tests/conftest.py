"""
Test fixtures. ChromaDB is mocked via dependency overrides — no running server needed.
The embedder is also mocked so sentence-transformers doesn't load during tests.
"""

import json
from pathlib import Path
from unittest.mock import MagicMock

import numpy as np
import pytest
from fastapi.testclient import TestClient

_FIXTURE_ATLAS = [
    {
        "id": "2404.00001",
        "x": 1.23,
        "y": -0.45,
        "title": "Test Paper One",
        "abstract": "An abstract about reinforcement learning and policy gradients.",
        "categories": ["cs.LG", "cs.AI"],
        "date": "2024-04-01",
        "url": "https://arxiv.org/abs/2404.00001",
    },
    {
        "id": "2404.00002",
        "x": -0.87,
        "y": 2.11,
        "title": "Test Paper Two",
        "abstract": "An abstract about transformer architectures and attention mechanisms.",
        "categories": ["cs.LG", "cs.CL"],
        "date": "2024-04-02",
        "url": "https://arxiv.org/abs/2404.00002",
    },
]


def _mock_chroma() -> MagicMock:
    mock = MagicMock()
    mock.query.return_value = {
        "ids": [["2404.00001", "2404.00002"]],
        "distances": [[0.05, 0.20]],
        "metadatas": [[{}, {}]],
    }
    return mock


def _mock_embedder() -> MagicMock:
    mock = MagicMock()
    mock.embed.return_value = np.zeros((1, 384), dtype=np.float32)
    return mock


@pytest.fixture(scope="session")
def client(tmp_path_factory):
    import os

    atlas_path = tmp_path_factory.mktemp("data") / "atlas.json"
    atlas_path.write_text(json.dumps(_FIXTURE_ATLAS))

    os.environ["ATLAS_PATH"] = str(atlas_path)
    os.environ["CHROMA_HOST"] = "localhost"
    os.environ["CHROMA_PORT"] = "8001"

    import importlib

    import api.config as config_module

    config_module.settings = config_module.Settings()

    from api.deps import get_chroma, get_embedder
    from api.main import app

    app.dependency_overrides[get_chroma] = _mock_chroma
    app.dependency_overrides[get_embedder] = _mock_embedder

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
