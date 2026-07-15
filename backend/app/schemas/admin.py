"""admin 端（/api/admin/*）的 request/response 結構：帳號 CRUD、系統總覽、分析任務監控。"""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, model_validator


# ---- 帳號管理 ----

class PatientProfileIn(BaseModel):
    """建立 patient 角色帳號時的病患基本資料（Patient 列）。"""

    patient_number: str
    birth_date: date
    gender: str  # MALE | FEMALE | OTHER
    phone: str | None = None


class AdminUserOut(BaseModel):
    """帳號列表/單筆回應（含軟刪除判定所需的 has_related_data）。"""

    id: int
    username: str
    role: str
    name: str
    title: str | None = None
    is_active: bool
    created_at: datetime
    patient_number: str | None = None  # role=patient 時帶出
    # 是否被看診/計畫/影片等資料引用；True 時只能停用不能真刪
    has_related_data: bool = False


class AdminUserCreate(BaseModel):
    """建立帳號：patient 角色必附 patient_profile（validator 強制）。"""

    username: str
    password: str = "1234"
    role: Literal["doctor", "nurse", "patient"]  # 不開放建立第二個 admin
    name: str
    title: str | None = None
    patient_profile: PatientProfileIn | None = None

    @model_validator(mode="after")
    def _patient_needs_profile(self):
        if self.role == "patient" and self.patient_profile is None:
            raise ValueError("建立病患帳號需提供 patient_profile（病歷號、生日、性別）")
        return self


class AdminUserUpdate(BaseModel):
    """不含 role：禁止改角色，避免 Patient 列孤兒與 FK 斷鏈。"""

    name: str | None = None
    title: str | None = None
    phone: str | None = None  # 僅 patient 角色生效（同步 Patient.phone）


class ResetPasswordIn(BaseModel):
    """重設密碼（預設回到通用初始密碼 1234）。"""

    new_password: str = "1234"


class SetActiveIn(BaseModel):
    """停用/啟用帳號的開關。"""

    is_active: bool


# ---- 系統總覽 ----

class RoleCount(BaseModel):
    """單一角色的帳號統計（總數/啟用中）。"""

    total: int
    active: int


class MediaDiskOut(BaseModel):
    """media/ 目錄用量與所在磁碟的容量資訊。"""

    media_bytes: int
    disk_total_bytes: int
    disk_free_bytes: int


class AdminOverviewOut(BaseModel):
    """系統總覽頁：帳號統計 + 上傳/分析狀態計數 + 磁碟用量。"""

    users: dict[str, RoleCount]  # key = role
    submissions_total: int
    pending_review: int
    analysis: dict[str, int]  # done | failed | in_progress | pending
    media_disk: MediaDiskOut


# ---- 分析任務監控 ----

class AdminTaskRow(BaseModel):
    """任務監控列表的一列（一筆 submission 的分析狀態）。"""

    submission_id: int
    patient_name: str
    item_name: str | None = None
    submitted_at: datetime
    status: str
    analysis_status: str
    analysis_error: str | None = None
    celery_task_id: str | None = None
    teacher_video_id: int | None = None


class AdminTaskListOut(BaseModel):
    """任務監控回應：分頁列表 + 全域狀態計數（篩選不影響計數）。"""

    items: list[AdminTaskRow]
    total: int
    page: int
    page_size: int
    status_counts: dict[str, int]  # key = analysis_status（未篩選的全域計數）
