from datetime import date

from pydantic import BaseModel

from app.schemas.rehab_plan import PlanCardOut
from app.schemas.visit import VisitOut


class PatientListItem(BaseModel):
    id: int
    patient_number: str
    name: str
    age: int
    gender: str
    last_visit_date: date | None = None
    visit_type: str | None = None  # 最近一次看診類型（初診/回診）
    rehab_status: str  # NO_PLAN | ONGOING | PENDING_EVALUATION | CLOSED
    is_overdue: bool = False  # 逾期未回診


class PatientBasicInfo(BaseModel):
    id: int
    patient_number: str
    name: str
    birth_date: date
    age: int
    gender: str
    phone: str | None = None
    created_at: date


class PatientSummaryCards(BaseModel):
    last_visit_date: date | None = None
    visit_count: int
    active_plan_count: int
    last_submission_date: date | None = None


class PatientDetailOut(BaseModel):
    basic: PatientBasicInfo
    summary: PatientSummaryCards
    rehab_status: str
    latest_visit: VisitOut | None = None
    current_plan: PlanCardOut | None = None
    plans: list[PlanCardOut]
    visits: list[VisitOut]
