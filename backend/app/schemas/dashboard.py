"""三種角色首頁儀表板的 response 結構（醫生/護理師/病患各一組）。"""

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
    """醫生首頁頂部統計卡。"""

    today_patient_count: int
    waiting_patient_count: int
    completed_patient_count: int
    pending_report_count: int  # 待處理的護理師回報


class TodayPatientItem(BaseModel):
    """今日看診名單的一列。"""

    patient_id: int
    patient_name: str
    patient_number: str
    visit_id: int
    visit_type: str  # FIRST | FOLLOW_UP
    status: str  # WAITING | IN_CONSULTATION | COMPLETED
    last_visit_date: date | None = None
    rehab_status: str  # NO_PLAN | ONGOING | PENDING_EVALUATION


class PlanReminderItem(BaseModel):
    """計畫評估提醒的一列（待評估/評估日到期/將到期）。"""

    plan_id: int
    patient_name: str
    plan_name: str
    status: str
    evaluation_date: date | None = None
    reason: str  # 為何需要注意


class DoctorDashboardOut(BaseModel):
    """醫生首頁完整回應。"""

    summary: DoctorDashboardSummary
    today_patients: list[TodayPatientItem]
    plan_reminders: list[PlanReminderItem]
    pending_reports: list[NurseReportOut]


# ---- 護理師端 ----


class NurseDashboardSummary(BaseModel):
    """護理師首頁頂部統計卡。"""

    pending_review_count: int
    reviewed_today_count: int
    attention_patient_count: int
    my_patient_count: int
    analyzing_count: int = 0  # 演算法處理中的上傳（前端輪詢條件）


class AttentionItem(BaseModel):
    """需注意病患的一列（低分/下滑/評估日將至，reason 說明原因）。"""

    patient_id: int
    patient_name: str
    plan_name: str
    last_score: float | None = None
    score_delta: float | None = None  # 與前次相比（負值代表下滑）
    reason: str


class NurseDashboardOut(BaseModel):
    """護理師首頁完整回應。"""

    summary: NurseDashboardSummary
    review_queue: list[SubmissionListItem]  # 待審核佇列前 N 筆
    attention_items: list[AttentionItem]


# ---- 病患端 ----


class PatientDashboardOut(BaseModel):
    """病患入口首頁：目前計畫、本週完成度、最新分數/回饋與雙趨勢。"""

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
