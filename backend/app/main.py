from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import admin, auth, doctor, media, nurse, patient
from app.core.config import settings
from app.db.base import Base
from app.db.ensure_schema import ensure_schema
from app.db.session import engine


def create_app() -> FastAPI:
    Base.metadata.create_all(bind=engine)
    ensure_schema(engine)

    app = FastAPI(title=settings.APP_NAME)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(admin.router)
    app.include_router(auth.router)
    app.include_router(doctor.router)
    app.include_router(nurse.router)
    app.include_router(patient.router)
    app.include_router(media.router)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()
