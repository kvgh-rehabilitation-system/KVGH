"""影片上傳、演算法分析結果、護理師審核與回報的 request/response 結構。

display_status 是把 status（業務流）與 analysis_status（演算法管線）
合併後的單一顯示狀態，統一由 common.submission_display_status 計算，
前端只認這個欄位，不自行組合兩軸。
"""

from datetime import date, datetime

from pydantic import BaseModel

# ---- 演算法分析 ----


class AnalysisOut(BaseModel):
    """演算法分析結果（四分數 + metrics 直通 + 規則式摘要）。"""

    analyzed_at: datetime
    overall_score: float
    joint_angle_score: float
    stability_score: float
    posture_score: float
    metrics: dict
    summary_text: str | None = None
    # LLM 分析報告（未來由 LLM worker 寫入 metrics["ai_report"]，此處帶出，免 schema migration）
    ai_report: str | None = None


class ScoreTrendPoint(BaseModel):
    """分數趨勢圖的一個點（同日多筆已平均）。"""

    date: date
    overall: float
    joint_angle: float
    stability: float
    posture: float


class CompletionTrendPoint(BaseModel):
    """每週完成率趨勢圖的一個點。"""

    week_start: date
    label: str  # 例如「6/22 週」
    completed: int
    prescribed: int
    rate: float  # 0~1


# ---- 上傳與審核 ----


class SubmissionListItem(BaseModel):
    """審核佇列列表的一列。"""

    id: int
    patient_id: int
    patient_name: str
    patient_number: str
    plan_id: int
    plan_name: str
    item_name: str
    submitted_at: datetime
    status: str  # ANALYZING | PENDING_REVIEW | REVIEWED
    display_status: (
        str  # PENDING|TRANSCODING|EXTRACTING|COMPARING|DONE|FAILED|PENDING_REVIEW|REVIEWED
    )
    decision: str | None = None  # APPROVED | NEEDS_ATTENTION
    overall_score: float | None = None
    needs_attention: bool = False  # 分數偏低或連續下滑


class SubmissionItemInfo(BaseModel):
    """審核頁顯示的動作項目資訊（上傳當時版本的快照）。"""

    id: int
    name: str
    frequency: str | None = None
    description: str | None = None
    precaution: str | None = None
    example_video_url: str | None = None
    example_video_note: str | None = None
    teacher_video_id: int | None = None


class SubmissionDetailOut(BaseModel):
    """審核頁完整資料：病患/計畫/動作/分析/審核狀態 + 歷次分數。"""

    id: int
    patient_id: int
    patient_name: str
    patient_number: str
    patient_age: int
    patient_gender: str
    plan_id: int
    plan_name: str
    plan_status: str
    plan_version: int
    item: SubmissionItemInfo
    submitted_at: datetime
    duration_seconds: int | None = None
    video_url: str | None = None
    status: str
    display_status: str = "PENDING"
    analysis_status: str = "PENDING"
    analysis_error: str | None = None
    teacher_video_id: int | None = None
    analysis: AnalysisOut | None = None
    reviewer_name: str | None = None
    reviewed_at: datetime | None = None
    decision: str | None = None
    feedback: str | None = None
    score_history: list[ScoreTrendPoint]  # 同病患同動作的歷次分數


class ReviewSubmit(BaseModel):
    """護理師送出審核的表單。"""

    decision: str  # APPROVED | NEEDS_ATTENTION
    feedback: str | None = None


# ---- 護理師回報醫生 ----


class NurseReportCreate(BaseModel):
    """護理師建立回報的表單（可選擇性掛在某筆上傳上）。"""

    plan_id: int
    submission_id: int | None = None
    kind: str  # STATUS_REPORT | ADJUSTMENT_SUGGESTION | ABNORMALITY
    severity: str = "NORMAL"  # NORMAL | PRIORITY | URGENT
    content: str


class NurseReportOut(BaseModel):
    """回報的完整回應（護理師端列表與醫生端待審共用）。"""

    id: int
    plan_id: int
    plan_name: str
    patient_id: int
    patient_name: str
    patient_number: str
    submission_id: int | None = None
    nurse_name: str
    kind: str
    severity: str
    content: str
    created_at: datetime
    status: str  # PENDING_DOCTOR_REVIEW | REVIEWED
    doctor_comment: str | None = None


class DoctorReportReview(BaseModel):
    """醫生批示回報的表單（標記已閱 + 選填批註）。"""

    doctor_comment: str | None = None
