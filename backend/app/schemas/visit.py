"""看診紀錄的 request/response 結構。"""

from datetime import date

from pydantic import BaseModel


class VisitOut(BaseModel):
    """看診紀錄回應（含醫生姓名，前端不需再查）。"""

    id: int
    visit_date: date
    status: str
    visit_type: str
    chief_complaint: str | None = None
    diagnosis: str | None = None
    assessment: str | None = None
    rehab_decision: str | None = None
    follow_up_date: date | None = None
    doctor_name: str


class VisitCreate(BaseModel):
    """醫生完成看診的表單（主訴/診斷/評估/復健決策皆必填）。"""

    chief_complaint: str
    diagnosis: str
    assessment: str
    rehab_decision: str
    follow_up_date: date | None = None
