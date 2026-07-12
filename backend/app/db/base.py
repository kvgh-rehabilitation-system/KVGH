"""匯入 Base 與所有 models，供 create_all 與未來 Alembic 使用。"""

from app.db.base_class import Base  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.patient import Patient  # noqa: F401
from app.models.visit import Visit  # noqa: F401
from app.models.teacher_video import TeacherVideo, TeacherVideoFolder  # noqa: F401
from app.models.rehab_plan import RehabPlan, PlanVersion, PlanItem  # noqa: F401
from app.models.submission import (  # noqa: F401
    VideoSubmission,
    AnalysisResult,
    NurseReport,
)
