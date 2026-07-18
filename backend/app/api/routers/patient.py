"""病患入口路由（/api/patient/*，全端點掛 require_patient）。

所有資料都以登入者本人為界（service 層驗歸屬），病患看不到別人的資料。
"""

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import require_patient
from app.db.session import get_db
from app.models.user import User
from app.schemas.dashboard import PatientDashboardOut
from app.schemas.teacher_video import SubmissionStatusOut
from app.schemas.visit import VisitOut
from app.services import patient_service

router = APIRouter(prefix="/api/patient", tags=["patient"])


@router.get("/dashboard", response_model=PatientDashboardOut)
def dashboard(user: User = Depends(require_patient), db: Session = Depends(get_db)):
    """病患首頁（目前計畫、本週完成度、最新分數/回饋與趨勢）。"""
    return patient_service.get_dashboard(db, user)


@router.get("/visits", response_model=list[VisitOut])
def my_visits(user: User = Depends(require_patient), db: Session = Depends(get_db)):
    """我的看診紀錄。"""
    return patient_service.list_visits(db, user)


@router.get("/rehabilitation-plans")
def my_plans(user: User = Depends(require_patient), db: Session = Depends(get_db)):
    """我的復健計畫列表。"""
    return patient_service.list_plans(db, user)


@router.get("/rehabilitation-plans/{plan_id}")
def plan_detail(plan_id: int, user: User = Depends(require_patient), db: Session = Depends(get_db)):
    """我的計畫詳細頁（動作清單 + 完成度 + 上傳紀錄）。"""
    return patient_service.get_plan_detail(db, user, plan_id)


@router.post(
    "/rehabilitation-plans/{plan_id}/submissions",
    response_model=SubmissionStatusOut,
    status_code=202,
)
def upload_submission(
    plan_id: int,
    plan_item_id: int = Form(...),
    video: UploadFile = File(...),
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
):
    """上傳居家復健影片，背景執行 轉檔 → 2D/3D 萃取 → 與導師影片比對。"""
    return patient_service.create_submission(db, user, plan_id, plan_item_id, video)


@router.get("/submissions/{submission_id}", response_model=SubmissionStatusOut)
def submission_status(
    submission_id: int,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
):
    """輪詢上傳影片的分析進度。"""
    return patient_service.get_submission_status(db, user, submission_id)


@router.delete("/submissions/{submission_id}")
def delete_submission(
    submission_id: int,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
):
    """刪除自己的上傳紀錄（含影片檔與分析產物；已審核者不可刪）。"""
    return patient_service.delete_submission(db, user, submission_id)
