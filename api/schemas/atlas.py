from pydantic import BaseModel, Field


class PointResponse(BaseModel):
    id: str
    x: float
    y: float
    title: str
    date: str
    categories: list[str]


class DocumentResponse(BaseModel):
    id: str
    x: float
    y: float
    title: str
    abstract: str
    categories: list[str]
    date: str
    url: str


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    k: int = Field(default=10, ge=1, le=50)


class SearchHit(BaseModel):
    id: str
    x: float
    y: float
    title: str
    date: str
    score: float


class SearchResponse(BaseModel):
    results: list[SearchHit]
    query: str
    latency_ms: int
