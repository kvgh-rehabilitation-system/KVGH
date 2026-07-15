"""SQLAlchemy engine 與 session 工廠（全 app 唯一入口）。"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

connect_args = {}
# SQLite 預設禁止跨執行緒共用連線，但 FastAPI 的同步端點跑在 threadpool，
# 同一請求的連線可能被不同執行緒使用，須放行（Postgres 無此限制）
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
# autoflush 關閉：查詢不觸發隱式 flush，寫入時機由 service 層的 commit 明確控制
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    """FastAPI 依賴：每請求一個 session，請求結束（含拋例外）必定歸還連線。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
