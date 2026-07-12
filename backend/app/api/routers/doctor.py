from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_doctor
from app.db.session import get_db
from app.models.user import User
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
from app.schemas.submission import DoctorReportReview, NurseReportOut
from app.schemas.visit import VisitCreate, VisitOut
from app.services import doctor_service

router = APIRouter(prefix="/api/doctor", tags=["doctor"])


@router.get("/dashboard", response_model=DoctorDashboardOut)
def dashboard(user: User = Depends(require_doctor), db: Session = Depends(get_db)):
    return doctor_service.get_dashboard(db, user)


@router.get("/patients", response_model=list[PatientListItem])
def list_patients(
    search: str | None = None,
    visit_type: str | None = None,
    rehab_status: str | None = None,
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    return doctor_service.list_patients(db, search, visit_type, rehab_status)


@router.get("/patients/{patient_id}", response_model=PatientDetailOut)
def patient_detail(
    patient_id: int, user: User = Depends(require_doctor), db: Session = Depends(get_db)
):
    return doctor_service.get_patient_detail(db, patient_id)


@router.get("/patients/{patient_id}/visits", response_model=list[VisitOut])
def patient_visits(
    patient_id: int, user: User = Depends(require_doctor), db: Session = Depends(get_db)
):
    return doctor_service.list_patient_visits(db, patient_id)


@router.post("/patients/{patient_id}/visits", status_code=201)
def create_visit(
    patient_id: int,
    data: VisitCreate,
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    visit = doctor_service.create_visit(db, patient_id, user, data)
    return {"id": visit.id, "rehab_decision": visit.rehab_decision}


@router.get("/rehabilitation-plans/summary", response_model=PlanListSummary)
def plan_summary(user: User = Depends(require_doctor), db: Session = Depends(get_db)):
    return doctor_service.get_plan_summary(db)


@router.get("/rehabilitation-plans", response_model=list[PlanListItem])
def list_plans(
    search: str | None = None,
    status: str | None = None,
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    return doctor_service.list_plans(db, search, status)


@router.get("/rehabilitation-plans/{plan_id}", response_model=PlanDetailOut)
def plan_detail(
    plan_id: int, user: User = Depends(require_doctor), db: Session = Depends(get_db)
):
    return doctor_service.get_plan_detail(db, plan_id)


@router.post("/patients/{patient_id}/rehabilitation-plans", status_code=201)
def create_plan(
    patient_id: int,
    data: PlanCreate,
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    plan = doctor_service.create_plan(db, patient_id, user, data)
    return {"id": plan.id}


@router.post("/rehabilitation-plans/{plan_id}/adjust")
def adjust_plan(
    plan_id: int,
    data: PlanAdjust,
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    plan = doctor_service.adjust_plan(db, plan_id, data)
    return {"id": plan.id}


@router.post("/rehabilitation-plans/{plan_id}/close")
def close_plan(
    plan_id: int, user: User = Depends(require_doctor), db: Session = Depends(get_db)
):
    plan = doctor_service.close_plan(db, plan_id)
    return {"id": plan.id, "status": plan.status}


@router.get("/nurses", response_model=list[NurseOption])
def list_nurses(user: User = Depends(require_doctor), db: Session = Depends(get_db)):
    return doctor_service.list_nurses(db)


@router.get("/rehabilitation-plans/{plan_id}/submissions")
def plan_submissions(
    plan_id: int, user: User = Depends(require_doctor), db: Session = Depends(get_db)
):
    return doctor_service.get_plan_submissions(db, plan_id)


@router.get("/reports", response_model=list[NurseReportOut])
def list_reports(
    status: str | None = None,
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    return doctor_service.list_reports(db, user, status)


@router.post("/reports/{report_id}/review")
def review_report(
    report_id: int,
    data: DoctorReportReview,
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    doctor_service.review_report(db, report_id, data)
    return {"ok": True}
