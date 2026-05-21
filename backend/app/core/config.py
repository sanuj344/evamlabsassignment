import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Creative Battle Room"
    API_V1_STR: str = "/api"
    
    # SQLite Database URL
    DATABASE_URL: str = "sqlite:///./battle_room.db"
    
    # JWT Secret Key for token validation
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    
    # AI settings
    MOCK_AI_DELAY_SECONDS: float = 3.0
    MOCK_AI_FAILURE_RATE: float = 0.1  # 10% failure rate for realism
    MOCK_AI_TIMEOUT_RATE: float = 0.05 # 5% timeout rate for realism
    
    # Optional OpenAI Key
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    
    class Config:
        case_sensitive = True

settings = Settings()
