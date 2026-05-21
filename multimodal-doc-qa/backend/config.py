from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # =========================
    # Supabase
    # =========================
    supabase_url: str
    supabase_service_key: str

    # =========================
    # Ollama / LLM
    # =========================
    ollama_model: str = "llama3"
    llm_model: str = "llama3"

    # =========================
    # Embeddings
    # =========================
    embedding_model: str = "nomic-embed-text"

    # =========================
    # App settings
    # =========================
    max_file_size_mb: int = 20
    chunk_size: int = 500
    chunk_overlap: int = 50
    top_k_results: int = 5

    # =========================
    # Pydantic config
    # =========================
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


settings = Settings()