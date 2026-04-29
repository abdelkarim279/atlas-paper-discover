import httpx
import numpy as np

_BATCH_LIMIT = 5000


class ChromaStore:
    """Thin HTTP client for a remote ChromaDB server. No local hnswlib needed."""

    def __init__(
        self,
        host: str = "localhost",
        port: int = 8001,
        collection_name: str = "papers",
    ) -> None:
        self._base = f"http://{host}:{port}/api/v1"
        self._collection_name = collection_name
        self._collection_id = self._ensure_collection()

    def _ensure_collection(self) -> str:
        # ChromaDB 0.5.x GET /collections/{name} requires a UUID, not a name.
        # List all collections and match by name instead.
        resp = httpx.get(f"{self._base}/collections", timeout=10)
        resp.raise_for_status()
        for col in resp.json():
            if col["name"] == self._collection_name:
                return col["id"]
        create = httpx.post(
            f"{self._base}/collections",
            json={
                "name": self._collection_name,
                "metadata": {"hnsw:space": "cosine"},
            },
            timeout=10,
        )
        create.raise_for_status()
        return create.json()["id"]

    @property
    def count(self) -> int:
        resp = httpx.get(
            f"{self._base}/collections/{self._collection_id}/count", timeout=10
        )
        resp.raise_for_status()
        return int(resp.json())

    def upsert(
        self,
        ids: list[str],
        embeddings: np.ndarray,
        metadatas: list[dict],
    ) -> None:
        for start in range(0, len(ids), _BATCH_LIMIT):
            end = start + _BATCH_LIMIT
            resp = httpx.post(
                f"{self._base}/collections/{self._collection_id}/upsert",
                json={
                    "ids": ids[start:end],
                    "embeddings": embeddings[start:end].tolist(),
                    "metadatas": metadatas[start:end],
                },
                timeout=120,
            )
            resp.raise_for_status()

    def query(self, query_embedding: np.ndarray, n_results: int = 10) -> dict:
        resp = httpx.post(
            f"{self._base}/collections/{self._collection_id}/query",
            json={
                "query_embeddings": [query_embedding.tolist()],
                "n_results": n_results,
                "include": ["distances", "metadatas"],
            },
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
