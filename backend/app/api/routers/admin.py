"""admin 端路由（/api/admin/*，全端點掛 require_admin）。

帳號 CRUD（軟刪除優先）、系統總覽、分析任務監控。
不需要 user 本人的端點以 `_` 接依賴（只為觸發權限檢查）。
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.admin import (
    AdminOverviewOut,
    AdminTaskListOut,
    AdminUserCreate,
    AdminUserOut,
    AdminUserUpdate,
    ResetPasswordIn,
    SetActiveIn,
)
from app.services import admin_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---- 帳號管理 ----

@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    role: str | None = None,
    search: str | None = None,
    include_inactive: bool = True,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """帳號列表（可依角色/關鍵字篩選、隱藏停用帳號）。"""
    return admin_service.list_users(db, role=role, search=search, include_inactive=include_inactive)


@router.post("/users", response_model=AdminUserOut, status_code=201)
def create_user(
    data: AdminUserCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """建立帳號（patient 角色連動建立病歷主檔；不開放建立 admin）。"""
    return admin_service.create_user(db, data)


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: int,
    data: AdminUserUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """更新帳號基本資料（禁改 role）。"""
    return admin_service.update_user(db, user_id, data)


@router.post("/users/{user_id}/reset-password")
def reset_password(
    user_id: int,
    data: ResetPasswordIn | None = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """重設密碼（body 可省略，預設重設為 1234）。"""
    new_password = data.new_password if data else "1234"
    return admin_service.reset_password(db, user_id, new_password)


@router.post("/users/{user_id}/set-active", response_model=AdminUserOut)
def set_active(
    user_id: int,
    data: SetActiveIn,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """停用/啟用帳號（不能停用 admin 或自己）。"""
    return admin_service.set_active(db, user, user_id, data.is_active)


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """刪除帳號——有臨床關聯時自動降級為停用（軟刪除優先）。"""
    return admin_service.delete_user(db, user, user_id)


# ---- 系統總覽 ----

@router.get("/overview", response_model=AdminOverviewOut)
def overview(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    """系統總覽（帳號統計/分析狀態計數/磁碟用量）。"""
    return admin_service.get_overview(db)


# ---- 分析任務監控 ----

@router.get("/tasks", response_model=AdminTaskListOut)
def list_tasks(
    analysis_status: str | None = None,
    page: int = 1,
    page_size: int = 20,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """分析任務監控列表（分頁 + 全域狀態計數）。"""
    return admin_service.list_tasks(
        db, analysis_status=analysis_status, page=page, page_size=page_size
    )


@router.post("/submissions/{submission_id}/reanalyze")
def reanalyze(
    submission_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """重新排入分析（複用 nurse 端邏輯，冪等）。"""
    return admin_service.reanalyze_submission(db, submission_id)
