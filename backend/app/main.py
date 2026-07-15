"""FastAPI 應用組裝入口（uvicorn 目標：app.main:app）。

路由按角色拆分（admin/auth/doctor/nurse/patient/media），
邏輯都在 services 層，這裡只負責建 app、掛 middleware 與 router。
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import admin, auth, doctor, media, nurse, patient
from app.core.config import settings
from app.db.base import Base
from app.db.ensure_schema import ensure_schema
from app.db.session import engine


def create_app() -> FastAPI:
    # 無 Alembic：create_all 建缺少的表，ensure_schema 再對既有表補新欄位
    #（兩者皆冪等，import 時即執行，所以 app 一載入 schema 就緒）
    Base.metadata.create_all(bind=engine)
    ensure_schema(engine)

    # CORS：容器部署時前端經 nginx 反代同源、不觸發 CORS，
    # 這裡放行的是「本機 vite dev（5173）直連後端」的開發情境
    app = FastAPI(title=settings.APP_NAME)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 六個角色/功能 router，各自帶 /api/{角色} prefix 與權限依賴
    app.include_router(admin.router)
    app.include_router(auth.router)
    app.include_router(doctor.router)
    app.include_router(nurse.router)
    app.include_router(patient.router)
    app.include_router(media.router)

    # 無認證的健康檢查端點（容器監控、部署驗證用）
    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()
