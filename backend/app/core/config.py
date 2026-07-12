from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "KVGH Rehabilitation System"
    DATABASE_URL: str = "sqlite:///./kvgh.db"
    JWT_SECRET: str = "kvgh-rehab-dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 12
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:2000"]

    # 影片與演算法產物的永久存放根目錄（容器內為 /data/media，對應專案 media/）
    MEDIA_ROOT: str = "./media"
    # Celery broker；backend 只發送任務（send_task by name），不 import worker 程式碼
    CELERY_BROKER_URL: str = "amqp://kvgh:change-me-mq@localhost:5672//"


settings = Settings()
