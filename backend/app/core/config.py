from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    environment: str = "development"
    log_level: str = "INFO"
    # Comma-separated string so env var can be a plain string (no JSON needed)
    backend_cors_origins: str = "http://localhost:3000"

    # Database
    database_url: str = "postgresql+asyncpg://polymarket:polymarket@localhost:5432/polymarket"

    # Qdrant
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333

    # AI
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # External APIs
    tavily_api_key: str = ""
    newsapi_key: str = ""
    polymarket_api_base: str = "https://gamma-api.polymarket.com"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.backend_cors_origins.split(",") if o.strip()]

    @property
    def is_development(self) -> bool:
        return self.environment == "development"


settings = Settings()
