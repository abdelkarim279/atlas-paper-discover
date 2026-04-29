from fastapi.testclient import TestClient


def test_health(client: TestClient) -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_get_points_returns_all(client: TestClient) -> None:
    resp = client.get("/api/points")
    assert resp.status_code == 200
    points = resp.json()
    assert len(points) == 2
    first = points[0]
    assert {"id", "x", "y", "title", "date", "categories"} <= first.keys()


def test_get_document_found(client: TestClient) -> None:
    resp = client.get("/api/document/2404.00001")
    assert resp.status_code == 200
    doc = resp.json()
    assert doc["id"] == "2404.00001"
    assert "abstract" in doc
    assert len(doc["abstract"]) > 0


def test_get_document_not_found(client: TestClient) -> None:
    resp = client.get("/api/document/does-not-exist")
    assert resp.status_code == 404


def test_search_returns_hits(client: TestClient) -> None:
    resp = client.post("/api/search", json={"query": "reinforcement learning", "k": 2})
    assert resp.status_code == 200
    body = resp.json()
    assert "results" in body
    assert len(body["results"]) <= 2
    if body["results"]:
        hit = body["results"][0]
        assert {"id", "x", "y", "title", "date", "score"} <= hit.keys()


def test_search_validates_empty_query(client: TestClient) -> None:
    resp = client.post("/api/search", json={"query": "", "k": 5})
    assert resp.status_code == 422


def test_search_validates_k_bounds(client: TestClient) -> None:
    resp = client.post("/api/search", json={"query": "attention", "k": 100})
    assert resp.status_code == 422
