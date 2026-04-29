from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    chroma_host: str = "localhost"
    chroma_port: int = 8001
    atlas_path: str = "data/atlas.json"
    embed_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    cors_origins: list[str] = ["http://localhost:5173"]
    log_level: str = "INFO"


settings = Settings()
