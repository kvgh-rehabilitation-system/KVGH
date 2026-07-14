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
    return admin_service.list_users(db, role=role, search=search, include_inactive=include_inactive)


@router.post("/users", response_model=AdminUserOut, status_code=201)
def create_user(
    data: AdminUserCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return admin_service.create_user(db, data)


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: int,
    data: AdminUserUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return admin_service.update_user(db, user_id, data)


@router.post("/users/{user_id}/reset-password")
def reset_password(
    user_id: int,
    data: ResetPasswordIn | None = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    new_password = data.new_password if data else "1234"
    return admin_service.reset_password(db, user_id, new_password)


@router.post("/users/{user_id}/set-active", response_model=AdminUserOut)
def set_active(
    user_id: int,
    data: SetActiveIn,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return admin_service.set_active(db, user, user_id, data.is_active)


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return admin_service.delete_user(db, user, user_id)


# ---- 系統總覽 ----

@router.get("/overview", response_model=AdminOverviewOut)
def overview(_: User = Depends(require_admin), db: Session = Depends(get_db)):
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
    return admin_service.list_tasks(
        db, analysis_status=analysis_status, page=page, page_size=page_size
    )


@router.post("/submissions/{submission_id}/reanalyze")
def reanalyze(
    submission_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return admin_service.reanalyze_submission(db, submission_id)
