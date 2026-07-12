from datetime import date

from pydantic import BaseModel


class VisitOut(BaseModel):
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
    chief_complaint: str
    diagnosis: str
    assessment: str
    rehab_decision: str
    follow_up_date: date | None = None
