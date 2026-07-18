"""admin 角色：帳號管理、系統總覽統計、分析任務監控。

刪除策略：users 被多個 FK 指入且無 cascade，有關聯資料的帳號一律軟刪除
（is_active=False），只有完全無引用的帳號才真刪。
"""

import shutil
import time

from fastapi import HTTPException
from sqlalchemy import case, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.patient import Patient
from app.models.rehab_plan import PlanItem, RehabPlan
from app.models.submission import NurseReport, VideoSubmission
from app.models.user import User
from app.models.visit import Visit
from app.schemas.admin import AdminUserCreate, AdminUserUpdate
from app.services import media_service, nurse_service

_IN_PROGRESS_STATUSES = ("TRANSCODING", "EXTRACTING", "COMPARING")


# ---- 帳號管理 ----


def _get_user_or_404(db: Session, user_id: int) -> User:
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="使用者不存在")
    return u


def _patient_of(db: Session, user: User) -> Patient | None:
    """patient 角色帳號對應的 Patient 列（其他角色回 None）。"""
    if user.role != "patient":
        return None
    return db.query(Patient).filter(Patient.user_id == user.id).first()


def _user_ref_count(db: Session, user: User) -> int:
    """帳號被臨床資料引用的總數；> 0 時只能軟刪除。

    users 的入向 FK：visits.doctor_id、rehab_plans.doctor_id/nurse_id、
    video_submissions.reviewed_by、nurse_reports.nurse_id。
    病患另查 Patient 底下的 visits/plans/submissions（分析結果與護理回報
    掛在這三者之下，父層為 0 即安全）。

    FIXME: 漏了 teacher_videos.uploaded_by——曾上傳導師影片但無其他關聯的
    護理師會被誤判可真刪，db.delete 時撞 FK 直接 500。
    """
    count = 0
    count += db.query(func.count(Visit.id)).filter(Visit.doctor_id == user.id).scalar()
    count += db.query(func.count(RehabPlan.id)).filter(RehabPlan.doctor_id == user.id).scalar()
    count += db.query(func.count(RehabPlan.id)).filter(RehabPlan.nurse_id == user.id).scalar()
    count += (
        db.query(func.count(VideoSubmission.id))
        .filter(VideoSubmission.reviewed_by == user.id)
        .scalar()
    )
    count += db.query(func.count(NurseReport.id)).filter(NurseReport.nurse_id == user.id).scalar()

    p = _patient_of(db, user)
    if p:
        count += db.query(func.count(Visit.id)).filter(Visit.patient_id == p.id).scalar()
        count += db.query(func.count(RehabPlan.id)).filter(RehabPlan.patient_id == p.id).scalar()
        count += (
            db.query(func.count(VideoSubmission.id))
            .filter(VideoSubmission.patient_id == p.id)
            .scalar()
        )
    return count


def _user_out(db: Session, user: User) -> dict:
    """User ORM → 回應 dict（附病歷號與「是否可真刪」的判定結果）。"""
    p = _patient_of(db, user)
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "name": user.name,
        "title": user.title,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "patient_number": p.patient_number if p else None,
        "has_related_data": _user_ref_count(db, user) > 0,
    }


def list_users(
    db: Session,
    role: str | None = None,
    search: str | None = None,
    include_inactive: bool = True,
) -> list[dict]:
    """帳號列表：可依角色篩選、帳號/姓名模糊搜尋、隱藏停用帳號。"""
    q = db.query(User)
    if role:
        q = q.filter(User.role == role)
    if not include_inactive:
        q = q.filter(User.is_active.is_(True))
    if search:
        like = f"%{search.strip()}%"
        q = q.filter((User.username.ilike(like)) | (User.name.ilike(like)))
    users = q.order_by(User.role, User.username).all()
    return [_user_out(db, u) for u in users]


def create_user(db: Session, data: AdminUserCreate) -> dict:
    """建立帳號；patient 角色連動建立 Patient 列（schema validator 保證 profile 存在）。"""
    # 先做友善的撞名檢查（併發撞名由下方 IntegrityError 兜底）
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=409, detail="帳號名稱已存在")

    u = User(
        username=data.username,
        password_hash=hash_password(data.password),
        role=data.role,
        name=data.name,
        title=data.title,
    )
    db.add(u)
    try:
        # flush 取得 user id；patient 角色再掛 Patient 列（同一交易，一起成功或失敗）
        db.flush()
        if data.role == "patient":
            profile = data.patient_profile
            if db.query(Patient).filter(Patient.patient_number == profile.patient_number).first():
                raise HTTPException(status_code=409, detail="病歷號已存在")
            db.add(
                Patient(
                    user_id=u.id,
                    patient_number=profile.patient_number,
                    name=data.name,
                    birth_date=profile.birth_date,
                    gender=profile.gender,
                    phone=profile.phone,
                )
            )
        db.commit()
    except IntegrityError:
        # 唯一約束兜底：兩個 admin 同時建同名帳號時，後到者在此被擋
        db.rollback()
        raise HTTPException(status_code=409, detail="帳號名稱或病歷號已存在")
    db.refresh(u)
    return _user_out(db, u)


def update_user(db: Session, user_id: int, data: AdminUserUpdate) -> dict:
    """更新帳號基本資料（不含 role）；姓名/電話同步到 Patient 列。"""
    u = _get_user_or_404(db, user_id)
    if data.name is not None:
        u.name = data.name
    if data.title is not None:
        u.title = data.title
    # 病患帳號的姓名存兩處（users + patients），必須同步改
    p = _patient_of(db, u)
    if p:
        if data.name is not None:
            p.name = data.name
        if data.phone is not None:
            p.phone = data.phone
    db.commit()
    return _user_out(db, u)


def reset_password(db: Session, user_id: int, new_password: str = "1234") -> dict:
    """重設密碼（預設回初始密碼 1234，由使用者自行改掉——原型階段無自助改密碼）。"""
    u = _get_user_or_404(db, user_id)
    u.password_hash = hash_password(new_password)
    db.commit()
    return {"detail": "密碼已重設"}


def set_active(db: Session, actor: User, user_id: int, is_active: bool) -> dict:
    """停用/啟用帳號。停用立即生效（deps.py 每請求檢查 is_active）。"""
    u = _get_user_or_404(db, user_id)
    # 自鎖與鎖 admin 都會讓系統失去管理能力，一律擋下
    if u.id == actor.id:
        raise HTTPException(status_code=400, detail="不能停用自己的帳號")
    if u.role == "admin" and not is_active:
        raise HTTPException(status_code=400, detail="不能停用管理員帳號")
    u.is_active = is_active
    db.commit()
    return _user_out(db, u)


def delete_user(db: Session, actor: User, user_id: int) -> dict:
    """刪除帳號——軟刪除優先：有臨床關聯即自動降級為停用，僅乾淨帳號真刪。"""
    u = _get_user_or_404(db, user_id)
    if u.id == actor.id:
        raise HTTPException(status_code=400, detail="不能刪除自己的帳號")
    if u.role == "admin":
        raise HTTPException(status_code=400, detail="不能刪除管理員帳號")

    # 有任何 FK 引用 → 降級為停用（回傳 deleted=False 讓前端顯示正確訊息）
    if _user_ref_count(db, u) > 0:
        u.is_active = False
        db.commit()
        return {"detail": "帳號有關聯的臨床資料，已改為停用", "deleted": False}

    # 乾淨帳號真刪；病患要先刪 Patient 列（FK 指向 users）
    p = _patient_of(db, u)
    if p:
        db.delete(p)
    db.delete(u)
    db.commit()
    return {"detail": "帳號已刪除", "deleted": True}


# ---- 系統總覽 ----

# media/ 檔案數多時 rglob 加總偏慢，60 秒 TTL 快取
_disk_cache: tuple[float, dict] | None = None
_DISK_CACHE_TTL = 60


def _media_disk() -> dict:
    global _disk_cache
    now = time.monotonic()
    if _disk_cache and now - _disk_cache[0] < _DISK_CACHE_TTL:
        return _disk_cache[1]

    root = media_service.media_root()
    media_bytes = 0
    for f in root.rglob("*"):
        try:
            if f.is_file():
                media_bytes += f.stat().st_size
        except OSError:  # worker 清 jobs/ 暫存造成的 race
            continue
    usage = shutil.disk_usage(root)
    result = {
        "media_bytes": media_bytes,
        "disk_total_bytes": usage.total,
        "disk_free_bytes": usage.free,
    }
    _disk_cache = (now, result)
    return result


def get_overview(db: Session) -> dict:
    """系統總覽：角色帳號統計 + 上傳/分析狀態計數 + 磁碟用量。"""
    # 各角色的總數與啟用數（一次 group by + 條件加總算齊）
    role_rows = (
        db.query(
            User.role,
            func.count(User.id),
            func.sum(case((User.is_active.is_(True), 1), else_=0)),
        )
        .group_by(User.role)
        .all()
    )
    users = {
        role: {"total": total, "active": int(active or 0)} for role, total, active in role_rows
    }

    # 上傳總數與待審數
    submissions_total = db.query(func.count(VideoSubmission.id)).scalar()
    pending_review = (
        db.query(func.count(VideoSubmission.id))
        .filter(VideoSubmission.status == "PENDING_REVIEW")
        .scalar()
    )

    # 分析狀態計數：管線中間態（TRANSCODING/EXTRACTING/COMPARING）合併為 in_progress
    status_rows = (
        db.query(VideoSubmission.analysis_status, func.count(VideoSubmission.id))
        .group_by(VideoSubmission.analysis_status)
        .all()
    )
    analysis = {"done": 0, "failed": 0, "in_progress": 0, "pending": 0}
    for status, n in status_rows:
        if status == "DONE":
            analysis["done"] += n
        elif status == "FAILED":
            analysis["failed"] += n
        elif status in _IN_PROGRESS_STATUSES:
            analysis["in_progress"] += n
        else:
            analysis["pending"] += n

    return {
        "users": users,
        "submissions_total": submissions_total,
        "pending_review": pending_review,
        "analysis": analysis,
        "media_disk": _media_disk(),
    }


# ---- 分析任務監控 ----


def list_tasks(
    db: Session,
    analysis_status: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """分析任務監控：分頁列表（可依狀態篩）+ 全域狀態計數。"""
    # 狀態計數永遠算全部（篩選不影響），供前端顯示各狀態 tab 的數字
    status_counts = dict(
        db.query(VideoSubmission.analysis_status, func.count(VideoSubmission.id))
        .group_by(VideoSubmission.analysis_status)
        .all()
    )

    # 列表 join 病患名與動作名（outerjoin：動作可能已被刪）
    q = (
        db.query(VideoSubmission, Patient.name, PlanItem.name)
        .join(Patient, VideoSubmission.patient_id == Patient.id)
        .outerjoin(PlanItem, VideoSubmission.plan_item_id == PlanItem.id)
    )
    if analysis_status:
        q = q.filter(VideoSubmission.analysis_status == analysis_status)
    # 先算篩選後總數再取頁（最新上傳優先）
    total = q.count()
    rows = (
        q.order_by(VideoSubmission.submitted_at.desc(), VideoSubmission.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [
        {
            "submission_id": sub.id,
            "patient_name": patient_name,
            "item_name": item_name,
            "submitted_at": sub.submitted_at,
            "status": sub.status,
            "analysis_status": sub.analysis_status,
            "analysis_error": sub.analysis_error,
            "celery_task_id": sub.celery_task_id,
            "teacher_video_id": sub.teacher_video_id,
        }
        for sub, patient_name, item_name in rows
    ]
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "status_counts": status_counts,
    }


def reanalyze_submission(db: Session, submission_id: int) -> dict:
    # 複用 nurse 端邏輯（含無導師影片 409、進行中 409、冪等短路）
    return nurse_service.reanalyze_submission(db, submission_id)
