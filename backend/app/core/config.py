from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """全域設定：環境變數 > .env 檔 > 此處預設值。

    預設值面向「本機不開 Docker 直接跑」的情境（SQLite、localhost broker）；
    容器部署時 docker-compose.yml 會以環境變數注入 Postgres/RabbitMQ 連線。
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "KVGH Rehabilitation System"
    # 本機 fallback 用 SQLite；容器內由 DATABASE_URL 環境變數覆寫為 Postgres
    DATABASE_URL: str = "sqlite:///./kvgh.db"
    # FIXME: 正式環境必須以環境變數覆寫 JWT_SECRET——目前 docker-compose.yml
    # 沒有注入此值，容器實際用的就是這個公開在 git 的開發密鑰
    JWT_SECRET: str = "kvgh-rehab-dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    # 12 小時：涵蓋一整個門診班次，避免醫護人員操作到一半被登出
    JWT_EXPIRE_MINUTES: int = 60 * 12
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:2000"]

    # 影片與演算法產物的永久存放根目錄（容器內為 /data/media，對應專案 media/）
    MEDIA_ROOT: str = "./media"
    # Celery broker；backend 只發送任務（send_task by name），不 import worker 程式碼
    CELERY_BROKER_URL: str = "amqp://kvgh:change-me-mq@localhost:5672//"


settings = Settings()
