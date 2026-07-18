"""醫生端路由（/api/doctor/*，全端點掛 require_doctor）。

router 只做參數綁定與權限依賴，商業邏輯都在 doctor_service；
審核詳情兩個唯讀端點複用 nurse_service / analysis_data_service。
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_doctor
from app.db.session import get_db
from app.models.user import User
from app.schemas.analysis_data import AnalysisDataOut
from app.schemas.dashboard import DoctorDashboardOut
from app.schemas.patient import PatientDetailOut, PatientListItem
from app.schemas.rehab_plan import (
    NurseOption,
    PlanAdjust,
    PlanCreate,
    PlanDetailOut,
    PlanListItem,
    PlanListSummary,
)
from app.schemas.submission import DoctorReportReview, NurseReportOut, SubmissionDetailOut
from app.schemas.visit import VisitCreate, VisitOut
from app.services import analysis_data_service, doctor_service, nurse_service

router = APIRouter(prefix="/api/doctor", tags=["doctor"])


@router.get("/dashboard", response_model=DoctorDashboardOut)
def dashboard(user: User = Depends(require_doctor), db: Session = Depends(get_db)):
    """醫生首頁儀表板（今日名單 + 評估提醒 + 待審回報）。"""
    return doctor_service.get_dashboard(db, user)


@router.get("/patients", response_model=list[PatientListItem])
def list_patients(
    search: str | None = None,
    visit_type: str | None = None,
    rehab_status: str | None = None,
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    """病患總表（可依關鍵字/看診類型/復健狀態篩選）。"""
    return doctor_service.list_patients(db, search, visit_type, rehab_status)


@router.get("/patients/{patient_id}", response_model=PatientDetailOut)
def patient_detail(
    patient_id: int, user: User = Depends(require_doctor), db: Session = Depends(get_db)
):
    """病患詳細頁的組合資料。"""
    return doctor_service.get_patient_detail(db, patient_id)


@router.get("/patients/{patient_id}/visits", response_model=list[VisitOut])
def patient_visits(
    patient_id: int, user: User = Depends(require_doctor), db: Session = Depends(get_db)
):
    """病患看診史（已完成，新到舊）。"""
    return doctor_service.list_patient_visits(db, patient_id)


@router.get("/submissions/{submission_id}", response_model=SubmissionDetailOut)
def submission_detail(
    submission_id: int,
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    """上傳詳細（唯讀，與護理師審核頁共用同一 service）。"""
    return nurse_service.get_submission_detail(db, submission_id)


@router.get("/submissions/{submission_id}/analysis-data", response_model=AnalysisDataOut)
def submission_analysis_data(
    submission_id: int,
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    """儀表板明細（動作卡/相似度曲線/關節偏差，與護理師端同一資料）。"""
    return analysis_data_service.get_analysis_data(db, submission_id)


@router.post("/patients/{patient_id}/visits", status_code=201)
def create_visit(
    patient_id: int,
    data: VisitCreate,
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    """完成一次看診（含復健決策；END_PLAN 連動關閉計畫）。"""
    visit = doctor_service.create_visit(db, patient_id, user, data)
    # 回傳 rehab_decision 供前端決定是否導向計畫表單（CREATE_PLAN/ADJUST_PLAN）
    return {"id": visit.id, "rehab_decision": visit.rehab_decision}


@router.get("/rehabilitation-plans/summary", response_model=PlanListSummary)
def plan_summary(user: User = Depends(require_doctor), db: Session = Depends(get_db)):
    """計畫列表頁的狀態計數卡。"""
    return doctor_service.get_plan_summary(db)


@router.get("/rehabilitation-plans", response_model=list[PlanListItem])
def list_plans(
    search: str | None = None,
    status: str | None = None,
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    """計畫列表（預設只列有效中；status=ALL 列全部）。"""
    return doctor_service.list_plans(db, search, status)


@router.get("/rehabilitation-plans/{plan_id}", response_model=PlanDetailOut)
def plan_detail(plan_id: int, user: User = Depends(require_doctor), db: Session = Depends(get_db)):
    """計畫詳細頁（目前版本 + 歷史版本）。"""
    return doctor_service.get_plan_detail(db, plan_id)


@router.post("/patients/{patient_id}/rehabilitation-plans", status_code=201)
def create_plan(
    patient_id: int,
    data: PlanCreate,
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    """建立復健計畫（病患須無其他有效中計畫）。"""
    plan = doctor_service.create_plan(db, patient_id, user, data)
    return {"id": plan.id}


@router.post("/rehabilitation-plans/{plan_id}/adjust")
def adjust_plan(
    plan_id: int,
    data: PlanAdjust,
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    """調整計畫（產生新版本快照，覆蓋式）。"""
    plan = doctor_service.adjust_plan(db, plan_id, data)
    return {"id": plan.id}


@router.post("/rehabilitation-plans/{plan_id}/close")
def close_plan(plan_id: int, user: User = Depends(require_doctor), db: Session = Depends(get_db)):
    """結束計畫（狀態轉 CLOSED）。"""
    plan = doctor_service.close_plan(db, plan_id)
    return {"id": plan.id, "status": plan.status}


@router.get("/nurses", response_model=list[NurseOption])
def list_nurses(user: User = Depends(require_doctor), db: Session = Depends(get_db)):
    """指派護理師下拉選單的選項。"""
    return doctor_service.list_nurses(db)


@router.get("/rehabilitation-plans/{plan_id}/submissions")
def plan_submissions(
    plan_id: int, user: User = Depends(require_doctor), db: Session = Depends(get_db)
):
    """計畫的上傳審核紀錄與雙趨勢。"""
    return doctor_service.get_plan_submissions(db, plan_id)


@router.get("/reports", response_model=list[NurseReportOut])
def list_reports(
    status: str | None = None,
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    """我的計畫收到的護理師回報（可依狀態篩選）。"""
    return doctor_service.list_reports(db, user, status)


@router.post("/reports/{report_id}/review")
def review_report(
    report_id: int,
    data: DoctorReportReview,
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    """批示護理師回報（標記已閱 + 選填批註）。"""
    doctor_service.review_report(db, report_id, data)
    return {"ok": True}
