"""病患端商業邏輯：自己的儀表板/計畫/看診查詢、影片上傳與進度輪詢。

安全邊界：所有查詢都從 get_patient_by_user（登入者的 Patient 列）出發，
單筆存取走 _get_own_submission 驗歸屬——病患絕不能碰到別人的資料。
"""

from datetime import date, timedelta

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.models.patient import Patient
from app.models.rehab_plan import PlanItem
from app.models.submission import VideoSubmission
from app.models.user import User
from app.schemas.dashboard import PatientDashboardOut
from app.schemas.teacher_video import SubmissionStatusOut
from app.schemas.visit import VisitOut
from app.services import common, media_service, task_queue


def get_patient_by_user(db: Session, user: User) -> Patient:
    """登入帳號 → 對應的 Patient 列（所有病患端查詢的起點與安全邊界）。"""
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="找不到病患資料")
    return patient


def get_dashboard(db: Session, user: User) -> PatientDashboardOut:
    """病患入口首頁：目前計畫、本週完成度、最新分數/回饋與雙趨勢。"""
    patient = get_patient_by_user(db, user)
    last_visit = common.get_last_visit(patient)
    active_plan = common.get_active_plan(patient)

    # 無有效計畫時全部維持零值/空清單（新病患或計畫已結束）
    week_completed = 0
    week_prescribed = 0
    latest_score = None
    last_submission_date = None
    latest_feedback = None
    latest_feedback_nurse = None
    score_trend = []
    completion_trend = []

    if active_plan:
        subs = common.plan_submissions(db, active_plan.id)
        # 本週（週一起算）已上傳次數 vs 處方次數
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        week_completed = sum(1 for s in subs if s.submitted_at.date() >= week_start)
        week_prescribed = common.weekly_prescribed(active_plan)
        score_trend = common.score_trend(subs)
        completion_trend = common.completion_trend(active_plan, subs)

        # 最新分數與最近上傳日（subs 已依上傳時間排序）
        analyzed = [s for s in subs if s.analysis]
        if analyzed:
            latest_score = analyzed[-1].analysis.overall_score
        if subs:
            last_submission_date = subs[-1].submitted_at.date()
        # 最新一筆有護理師回饋的審核（依審核時間取最新）
        reviewed = [s for s in subs if s.feedback]
        if reviewed:
            latest = max(reviewed, key=lambda s: s.reviewed_at)
            latest_feedback = latest.feedback
            latest_feedback_nurse = latest.reviewer.name if latest.reviewer else None

    return PatientDashboardOut(
        name=patient.name,
        patient_number=patient.patient_number,
        next_follow_up_date=last_visit.follow_up_date if last_visit else None,
        current_plan_id=active_plan.id if active_plan else None,
        current_plan_name=active_plan.name if active_plan else None,
        current_plan_status=active_plan.status if active_plan else None,
        week_completed=week_completed,
        week_prescribed=week_prescribed,
        week_completion_rate=round(week_completed / week_prescribed, 2)
        if week_prescribed
        else 0.0,
        last_submission_date=last_submission_date,
        latest_score=latest_score,
        latest_feedback=latest_feedback,
        latest_feedback_nurse=latest_feedback_nurse,
        score_trend=score_trend,
        completion_trend=completion_trend,
    )


def list_visits(db: Session, user: User) -> list[VisitOut]:
    """我的看診紀錄（已完成，新到舊）。"""
    patient = get_patient_by_user(db, user)
    visits = sorted(
        [v for v in patient.visits if v.status == "COMPLETED"],
        key=lambda v: (v.visit_date, v.id),
        reverse=True,
    )
    return [common.visit_to_out(v) for v in visits]


def list_plans(db: Session, user: User) -> list[dict]:
    """我的復健計畫列表（新到舊，含目標與動作數摘要）。"""
    patient = get_patient_by_user(db, user)
    plans = sorted(patient.plans, key=lambda p: p.start_date, reverse=True)
    result = []
    for plan in plans:
        current = plan.current_version
        result.append(
            {
                "id": plan.id,
                "name": plan.name,
                "status": plan.status,
                "start_date": plan.start_date.isoformat(),
                "evaluation_date": plan.evaluation_date.isoformat()
                if plan.evaluation_date
                else None,
                "doctor_name": plan.doctor.name,
                "nurse_name": plan.nurse.name if plan.nurse else None,
                "goals": (current.goals or []) if current else [],
                "item_count": len(current.items) if current else 0,
            }
        )
    return result


def get_plan_detail(db: Session, user: User, plan_id: int) -> dict:
    """我的計畫詳細頁：動作清單 + 本週完成度 + 雙趨勢 + 上傳紀錄。"""
    # 只能看自己的計畫：從自己的 plans 找，找不到一律 404（不洩漏存在性）
    patient = get_patient_by_user(db, user)
    plan = next((p for p in patient.plans if p.id == plan_id), None)
    if not plan:
        raise HTTPException(status_code=404, detail="復健計畫不存在")

    current = plan.current_version
    subs = common.plan_submissions(db, plan.id)

    # 本週（週一起算）完成度
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_completed = sum(1 for s in subs if s.submitted_at.date() >= week_start)
    week_prescribed = common.weekly_prescribed(plan)

    return {
        "id": plan.id,
        "name": plan.name,
        "status": plan.status,
        "version": current.version if current else None,
        "start_date": plan.start_date.isoformat(),
        "evaluation_date": plan.evaluation_date.isoformat() if plan.evaluation_date else None,
        "doctor_name": plan.doctor.name,
        "nurse_name": plan.nurse.name if plan.nurse else None,
        "goals": (current.goals or []) if current else [],
        "items": [
            common.item_to_out(i).model_dump(mode="json")
            for i in (current.items if current else [])
        ],
        "week_completed": week_completed,
        "week_prescribed": week_prescribed,
        "week_completion_rate": round(week_completed / week_prescribed, 2)
        if week_prescribed
        else 0.0,
        "score_trend": [p.model_dump(mode="json") for p in common.score_trend(subs)],
        "completion_trend": [
            p.model_dump(mode="json") for p in common.completion_trend(plan, subs)
        ],
        "submissions": [_submission_for_patient(s) for s in reversed(subs)],
    }


def _submission_for_patient(sub: VideoSubmission) -> dict:
    """病患端顯示自己的上傳紀錄：分數 + 護理師回饋。"""
    analysis = sub.analysis
    return {
        "id": sub.id,
        "item_name": sub.plan_item.name,
        "submitted_at": sub.submitted_at.isoformat(),
        "status": sub.status,
        "display_status": common.submission_display_status(sub),
        "analysis_status": sub.analysis_status,
        "analysis_error": sub.analysis_error,
        "decision": sub.decision,
        "overall_score": analysis.overall_score if analysis else None,
        "joint_angle_score": analysis.joint_angle_score if analysis else None,
        "stability_score": analysis.stability_score if analysis else None,
        "posture_score": analysis.posture_score if analysis else None,
        "summary_text": analysis.summary_text if analysis else None,
        "feedback": sub.feedback,
        "reviewer_name": sub.reviewer.name if sub.reviewer else None,
        "reviewed_at": sub.reviewed_at.isoformat() if sub.reviewed_at else None,
    }


# ---- 影片上傳 ----

def create_submission(
    db: Session, user: User, plan_id: int, plan_item_id: int, upload: UploadFile
) -> SubmissionStatusOut:
    """病患上傳居家復健影片，排入 轉檔 → 2D/3D 萃取 → 比對 pipeline。"""
    patient = get_patient_by_user(db, user)
    plan = next((p for p in patient.plans if p.id == plan_id), None)
    if not plan:
        raise HTTPException(status_code=404, detail="復健計畫不存在")
    if plan.status not in common.ACTIVE_PLAN_STATUSES:
        raise HTTPException(status_code=400, detail="計畫已結束，無法上傳影片")
    current = plan.current_version
    item = db.get(PlanItem, plan_item_id)
    if not item or not current or item.version_id != current.id:
        raise HTTPException(status_code=404, detail="動作項目不存在")

    # 導師影片須「萃取完成且已標註」才收上傳：比對演算法同時需要
    # 3D 骨架（萃取產物）與重點動作幀（標註），缺一比對必失敗，不如在入口擋下
    tv = item.teacher_video
    if not tv or tv.extraction_status != "EXTRACTED" or tv.annotation_status != "ANNOTATED":
        raise HTTPException(
            status_code=409,
            detail="此動作的導師影片尚未就緒（需完成上傳、萃取與重點動作標註），請聯絡護理師",
        )

    # 建上傳紀錄：teacher_video_id 存「上傳當下」的綁定作為比對快照
    sub = VideoSubmission(
        plan_id=plan.id,
        plan_version_id=current.id,
        plan_item_id=item.id,
        patient_id=patient.id,
        teacher_video_id=tv.id,
        status="ANALYZING",
        analysis_status="PENDING",
    )
    db.add(sub)
    db.flush()  # 先取得 id 決定存放目錄與檔名

    # 存原始檔到 submissions/{id}/，再 commit 讓 worker 看得到紀錄
    rel_path, original_name = media_service.save_upload(
        upload, media_service.submission_dir(sub.id)
    )
    sub.video_path = rel_path  # 轉檔完成後由 worker 改指向 s{id}.mp4
    sub.original_filename = original_name
    db.commit()

    # 排入 轉檔 → 萃取 → 比對 pipeline，回填 task id 供監控
    task_id = task_queue.enqueue_submission_pipeline(sub.id, tv.id)
    sub.celery_task_id = task_id
    db.commit()
    return get_submission_status(db, user, sub.id)


def _get_own_submission(db: Session, user: User, submission_id: int) -> VideoSubmission:
    """取自己的上傳紀錄；別人的與不存在的一律 404（不洩漏存在性）。"""
    patient = get_patient_by_user(db, user)
    sub = db.get(VideoSubmission, submission_id)
    if not sub or sub.patient_id != patient.id:
        raise HTTPException(status_code=404, detail="上傳紀錄不存在")
    return sub


def get_submission_status(db: Session, user: User, submission_id: int) -> SubmissionStatusOut:
    """上傳後的進度輪詢端點（前端定時打，直到 DONE/FAILED）。"""
    sub = _get_own_submission(db, user, submission_id)
    return SubmissionStatusOut(
        id=sub.id,
        status=sub.status,
        analysis_status=sub.analysis_status,
        display_status=common.submission_display_status(sub),
        analysis_error=sub.analysis_error,
        overall_score=sub.analysis.overall_score if sub.analysis else None,
    )


def delete_submission(db: Session, user: User, submission_id: int) -> dict:
    """病患撤回自己的上傳（已審核的不可撤，分析中的等結束再撤）。"""
    sub = _get_own_submission(db, user, submission_id)
    if sub.status == "REVIEWED":
        raise HTTPException(status_code=409, detail="已審核的紀錄無法刪除")
    # 分析中不給刪：worker 正在讀寫該目錄，rmtree 會讓任務炸出難解的半殘狀態
    if sub.analysis_status in ("TRANSCODING", "EXTRACTING", "COMPARING"):
        raise HTTPException(status_code=409, detail="分析進行中，請稍候再刪除")
    if sub.analysis:
        db.delete(sub.analysis)
    # FIXME: 未檢查 NurseReport.submission_id 引用——若護理師曾針對此上傳回報，
    # db.delete 會撞 FK 500，且下兩行已先刪掉磁碟檔案（DB 列還在、檔案已消失）。
    # 應先驗引用（或改 SET NULL），commit 成功後才刪檔案。
    media_service.delete_media_dir(media_service.submission_dir(sub.id))
    media_service.delete_media_dir(media_service.results_dir(sub.id))
    db.delete(sub)
    db.commit()
    return {"detail": "上傳紀錄已刪除"}
