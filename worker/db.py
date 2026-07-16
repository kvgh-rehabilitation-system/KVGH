"""Worker 的 DB 存取：共用 backend 的 SQLAlchemy models（image 內 COPY backend/app）。"""

from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from worker import config

# 匯入共用 models：必須經由 app.db.base 載入全部 model class，
# 否則 relationship() 以字串參照的類別（如 RehabPlan）會解析失敗
import app.db.base  # noqa: F401
from app.models.submission import AnalysisResult, VideoSubmission  # noqa: F401
from app.models.teacher_video import TeacherVideo  # noqa: F401

# pool_pre_ping：任務間隔可能很長，先驗連線活性再用，避免撿到已被 DB 關閉的死連線
engine = create_engine(config.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@contextmanager
def session_scope():
    """短交易 context manager：正常結束 commit、拋例外 rollback、必定歸還連線。"""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
