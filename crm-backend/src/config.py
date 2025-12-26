"""Configuration settings for CRM Backend."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database settings
    db_host: str = "localhost"
    db_port: int = 3306
    db_user: str = "root"
    db_password: str = ""
    db_database: str = "clonecrm"
    db_tables: str = "branch,customer,lead,invoice,product,productdtl,city,customertype,customertypedtl"

    # OpenAI settings
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    class Config:
        env_prefix = "CRM_"
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
