from datetime import date

from pydantic import BaseModel

from app.schemas.submission import (
    CompletionTrendPoint,
    NurseReportOut,
    ScoreTrendPoint,
    SubmissionListItem,
)


# ---- 醫生端 ----

class DoctorDashboardSummary(BaseModel):
    today_patient_count: int
    waiting_patient_count: int
    completed_patient_count: int
    pending_report_count: int  # 待處理的護理師回報


class TodayPatientItem(BaseModel):
    patient_id: int
    patient_name: str
    patient_number: str
    visit_id: int
    visit_type: str  # FIRST | FOLLOW_UP
    status: str  # WAITING | IN_CONSULTATION | COMPLETED
    last_visit_date: date | None = None
    rehab_status: str  # NO_PLAN | ONGOING | PENDING_EVALUATION


class PlanReminderItem(BaseModel):
    plan_id: int
    patient_name: str
    plan_name: str
    status: str
    evaluation_date: date | None = None
    reason: str  # 為何需要注意


class DoctorDashboardOut(BaseModel):
    summary: DoctorDashboardSummary
    today_patients: list[TodayPatientItem]
    plan_reminders: list[PlanReminderItem]
    pending_reports: list[NurseReportOut]


# ---- 護理師端 ----

class NurseDashboardSummary(BaseModel):
    pending_review_count: int
    reviewed_today_count: int
    attention_patient_count: int
    my_patient_count: int
    analyzing_count: int = 0  # 演算法處理中的上傳（前端輪詢條件）


class AttentionItem(BaseModel):
    patient_id: int
    patient_name: str
    plan_name: str
    last_score: float | None = None
    score_delta: float | None = None  # 與前次相比（負值代表下滑）
    reason: str


class NurseDashboardOut(BaseModel):
    summary: NurseDashboardSummary
    review_queue: list[SubmissionListItem]  # 待審核佇列前 N 筆
    attention_items: list[AttentionItem]


# ---- 病患端 ----

class PatientDashboardOut(BaseModel):
    name: str
    patient_number: str
    next_follow_up_date: date | None = None
    current_plan_id: int | None = None
    current_plan_name: str | None = None
    current_plan_status: str | None = None
    week_completed: int  # 本週已上傳次數
    week_prescribed: int  # 本週處方次數（各動作 times_per_week 加總）
    week_completion_rate: float  # 0~1
    last_submission_date: date | None = None
    latest_score: float | None = None
    latest_feedback: str | None = None  # 最新護理師回饋
    latest_feedback_nurse: str | None = None
    score_trend: list[ScoreTrendPoint]
    completion_trend: list[CompletionTrendPoint]
