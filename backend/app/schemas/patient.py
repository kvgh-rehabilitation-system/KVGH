"""醫護端「病患」視角的 response 結構（列表列、詳細頁組合資料）。

病患本人入口（portal）的結構在 dashboard.py 的 PatientDashboardOut，不在這裡。
"""

from datetime import date

from pydantic import BaseModel

from app.schemas.rehab_plan import PlanCardOut
from app.schemas.visit import VisitOut


class PatientListItem(BaseModel):
    """病患列表的一列（醫護端）：基本資料 + 最近看診 + 復健狀態。"""

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
    """病患基本資料卡（詳細頁左側）。"""

    id: int
    patient_number: str
    name: str
    birth_date: date
    age: int
    gender: str
    phone: str | None = None
    created_at: date


class PatientSummaryCards(BaseModel):
    """病患詳細頁頂部的統計卡數字。"""

    last_visit_date: date | None = None
    visit_count: int
    active_plan_count: int
    last_submission_date: date | None = None


class PatientDetailOut(BaseModel):
    """病患詳細頁的組合回應（基本資料/統計/計畫/看診史一次帶齊）。"""

    basic: PatientBasicInfo
    summary: PatientSummaryCards
    rehab_status: str
    latest_visit: VisitOut | None = None
    current_plan: PlanCardOut | None = None
    plans: list[PlanCardOut]
    visits: list[VisitOut]
