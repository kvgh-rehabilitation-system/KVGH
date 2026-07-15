"""復健計畫（含版本快照與動作項目）的 request/response 結構。

醫生端與護理師端共用：PlanCreate/PlanAdjust 由醫生使用（整版覆蓋式調整），
PlanItemCreate/Update 另供護理師逐項維護動作（見 nurse router）。
"""

from datetime import date

from pydantic import BaseModel


class PlanItemTeacherVideo(BaseModel):
    """Plan item 上綁定的導師影片狀態（供前端顯示上傳/萃取/標註進度）。"""

    id: int
    name: str | None = None
    uploader_name: str | None = None
    extraction_status: str
    annotation_status: str
    fps: float | None = None
    frame_count: int | None = None
    extraction_error: str | None = None


class PlanItemOut(BaseModel):
    """動作項目回應（含綁定導師影片的狀態摘要）。"""

    id: int
    name: str
    frequency: str | None = None
    times_per_week: int = 3
    description: str | None = None
    precaution: str | None = None
    example_video_url: str | None = None
    example_video_note: str | None = None
    teacher_video: PlanItemTeacherVideo | None = None


class PlanItemCreate(BaseModel):
    """新增動作項目（醫生開計畫或護理師逐項維護共用）。"""

    name: str
    frequency: str | None = None
    times_per_week: int = 3
    description: str | None = None
    precaution: str | None = None
    example_video_url: str | None = None
    example_video_note: str | None = None
    # 從影片庫選用既有導師影片（須已完成萃取）
    teacher_video_id: int | None = None


class PlanItemUpdate(BaseModel):
    """部分更新動作項目（exclude_unset 語意：沒帶的欄位不動）。"""

    name: str | None = None
    frequency: str | None = None
    times_per_week: int | None = None
    description: str | None = None
    precaution: str | None = None
    example_video_url: str | None = None
    example_video_note: str | None = None
    # 從影片庫切換導師影片（須已完成萃取）；傳 null 可解除綁定
    teacher_video_id: int | None = None


class PlanVersionOut(BaseModel):
    """計畫版本快照回應（歷史回顧與目前版本共用）。"""

    id: int
    version: int
    goals: list[str]
    change_summary: str | None = None
    started_at: date
    ended_at: date | None = None
    is_current: bool
    items: list[PlanItemOut]


class PlanCardOut(BaseModel):
    """病患詳細頁「目前復健計畫」卡片。"""

    id: int
    name: str
    status: str
    start_date: date
    evaluation_date: date | None = None
    doctor_name: str
    nurse_name: str | None = None
    current_version: int | None = None
    item_count: int = 0
    pending_review_count: int = 0


class PlanListItem(BaseModel):
    """計畫列表的一列（含病患識別，供跨病患的計畫總表）。"""

    id: int
    patient_id: int
    patient_name: str
    patient_number: str
    name: str
    status: str
    start_date: date
    evaluation_date: date | None = None
    nurse_name: str | None = None


class PlanListSummary(BaseModel):
    """計畫列表頁頂部的狀態計數卡。"""

    ongoing: int
    pending_evaluation: int
    ending_soon: int
    closed: int


class PlanDetailOut(BaseModel):
    """計畫詳細頁：目前版本 + 全部歷史版本（版本快照設計見 models）。"""

    id: int
    name: str
    status: str
    patient_id: int
    patient_name: str
    patient_number: str
    doctor_name: str
    nurse_name: str | None = None
    start_date: date
    evaluation_date: date | None = None
    current_version: PlanVersionOut | None = None
    versions: list[PlanVersionOut]
    last_adjusted_at: date | None = None


class PlanCreate(BaseModel):
    """醫生建立計畫的表單（version 1 的內容）。"""

    name: str
    goals: list[str]
    items: list[PlanItemCreate] = []  # 動作項目主要由護理師制定，醫生可選填初始項目
    nurse_id: int | None = None
    start_date: date
    evaluation_date: date | None = None


class PlanAdjust(BaseModel):
    """醫生調整計畫的表單（覆蓋式：goals 與 items 為新版全量內容）。"""

    change_summary: str
    goals: list[str]
    items: list[PlanItemCreate]
    evaluation_date: date | None = None


class NurseOption(BaseModel):
    """指派護理師下拉選單的選項。"""

    id: int
    name: str
