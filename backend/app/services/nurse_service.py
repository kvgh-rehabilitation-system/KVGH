"""護理師端商業邏輯：影片審核、動作管理、回報醫生、導師影片庫。

範圍慣例：列表/儀表板以「我負責的計畫」（RehabPlan.nurse_id）為界；
單筆操作（審核、動作維護、導師影片）不驗歸屬——護理師間可互相支援代審。
導師影片庫為全院共享資源，與個別護理師無綁定。
"""

from datetime import date, datetime

from fastapi import HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.patient import Patient
from app.models.rehab_plan import PlanItem, RehabPlan
from app.models.submission import NurseReport, VideoSubmission
from app.models.teacher_video import TeacherVideo, TeacherVideoFolder
from app.models.user import User
from app.schemas.dashboard import (
    AttentionItem,
    NurseDashboardOut,
    NurseDashboardSummary,
)
from app.schemas.patient import PatientBasicInfo
from app.schemas.rehab_plan import PlanItemCreate, PlanItemUpdate
from app.schemas.submission import (
    NurseReportCreate,
    ReviewSubmit,
    SubmissionDetailOut,
    SubmissionItemInfo,
)
from app.schemas.teacher_video import (
    AnnotationOut,
    AnnotationSubmit,
    TeacherVideoFolderIn,
    TeacherVideoFolderOut,
    TeacherVideoOut,
    TeacherVideoUpdate,
)
from app.services import common, media_service, task_queue


def _my_plans(db: Session, nurse: User) -> list[RehabPlan]:
    """我（護理師）負責追蹤的全部計畫。"""
    return db.query(RehabPlan).filter(RehabPlan.nurse_id == nurse.id).all()


def _my_submissions_query(db: Session, nurse: User):
    """我負責計畫底下的所有上傳（歸屬看 plan.nurse_id，不看誰審核的）。"""
    return (
        db.query(VideoSubmission)
        .join(RehabPlan, VideoSubmission.plan_id == RehabPlan.id)
        .filter(RehabPlan.nurse_id == nurse.id)
    )


# ---- Dashboard ----


def get_dashboard(db: Session, nurse: User) -> NurseDashboardOut:
    """護理師首頁：摘要計數 + 待審佇列前 6 筆（最早優先）+ 需注意病患。

    analyzing_count 給前端當輪詢開關：>0 時首頁定時重抓，直到分析全部落地。
    """
    # 一次抓齊我負責的全部上傳，後續計數與佇列都在記憶體內分組（避免多次查詢）
    subs = _my_submissions_query(db, nurse).order_by(VideoSubmission.submitted_at).all()
    today = date.today()

    # 待審核與今日已審的子集合
    pending = [s for s in subs if s.status == "PENDING_REVIEW"]
    reviewed_today = [s for s in subs if s.reviewed_at and s.reviewed_at.date() == today]

    # 需注意病患 + 我的病患數（只算有效中計畫的病患）
    attention_items = _attention_items(db, nurse, subs)
    my_patients = {
        p.patient_id for p in _my_plans(db, nurse) if p.status in common.ACTIVE_PLAN_STATUSES
    }

    # 佇列取最早上傳的前 6 筆（先進先審）
    queue = sorted(pending, key=lambda s: s.submitted_at)[:6]
    return NurseDashboardOut(
        summary=NurseDashboardSummary(
            pending_review_count=len(pending),
            reviewed_today_count=len(reviewed_today),
            attention_patient_count=len({i.patient_id for i in attention_items}),
            my_patient_count=len(my_patients),
            analyzing_count=sum(1 for s in subs if s.status == "ANALYZING"),
        ),
        review_queue=[common.submission_to_list_item(s, subs) for s in queue],
        attention_items=attention_items,
    )


def _attention_items(db: Session, nurse: User, subs: list[VideoSubmission]) -> list[AttentionItem]:
    """需注意病患清單：最新分數偏低 / 較前次明顯下滑 / 評估日 3 天內。

    以「病患最新一筆有分析的上傳」為判定基準（跨動作直接比較，
    求的是護理師巡查的粗篩，不是嚴謹的同動作對照——那在審核頁做）。
    每病患至多一列，依最新分數低者優先排序。
    """
    items: list[AttentionItem] = []
    seen: set[int] = set()

    # 依病患分組（只留有分析結果的上傳）
    by_patient: dict[int, list[VideoSubmission]] = {}
    for s in subs:
        if s.analysis:
            by_patient.setdefault(s.patient_id, []).append(s)

    for patient_id, plist in by_patient.items():
        # 取該病患最新與次新的上傳作為判定基準
        plist.sort(key=lambda s: s.submitted_at)
        last = plist[-1]
        prev = plist[-2] if len(plist) > 1 else None
        reasons = []
        delta = None
        # 條件一：最新分數低於門檻
        if last.analysis.overall_score < common.ATTENTION_SCORE_THRESHOLD:
            reasons.append(f"最新動作分數 {last.analysis.overall_score:.0f} 分偏低")
        # 條件二：與前次相比跌超過 8 分
        if prev:
            delta = round(last.analysis.overall_score - prev.analysis.overall_score, 1)
            if delta <= -8:
                reasons.append("分數較前次明顯下滑")
        # 條件三：所屬計畫的評估日在 3 天內（含已過期）
        plan = last.plan
        if (
            plan.evaluation_date
            and plan.status in common.ACTIVE_PLAN_STATUSES
            and (plan.evaluation_date - date.today()).days <= 3
        ):
            reasons.append("計畫即將到達評估日")
        # 任一條件成立即列入（每病患只列一次）
        if reasons and patient_id not in seen:
            seen.add(patient_id)
            items.append(
                AttentionItem(
                    patient_id=patient_id,
                    patient_name=last.patient.name,
                    plan_name=plan.name,
                    last_score=last.analysis.overall_score,
                    score_delta=delta,
                    reason="；".join(reasons),
                )
            )
    items.sort(key=lambda i: i.last_score or 100)
    return items


# ---- 我的病患 ----


def list_my_patients(
    db: Session,
    nurse: User,
    scope: str = "mine",
    search: str | None = None,
    plan_status: str | None = None,
) -> list[dict]:
    """以病患為單位列出：scope=mine 只含顯示計畫由我負責的病患，scope=all 為全部病患。

    顯示計畫 = 進行中計畫優先，否則取最近開始的一筆（可能為 None，病患仍要出現在 all）。
    """
    patients = db.query(Patient).order_by(Patient.patient_number).all()
    rows = []
    for patient in patients:
        # 決定「顯示計畫」：有效中優先，否則最近開始的一筆（可能為 None）
        plan = common.get_active_plan(patient) or max(
            patient.plans, key=lambda p: p.start_date, default=None
        )
        # 歸屬判定 + 三種篩選（範圍/關鍵字/計畫狀態），不符即跳過
        is_mine = plan is not None and plan.nurse_id == nurse.id
        if scope != "all" and not is_mine:
            continue
        if search:
            key = search.strip()
            if key not in patient.name and key not in patient.patient_number:
                continue
        if plan_status and plan_status != "ALL":
            if plan is None or plan.status != plan_status:
                continue
        # 顯示計畫的上傳統計：最新有分析的一筆提供分數
        subs = common.plan_submissions(db, plan.id) if plan else []
        analyzed = [s for s in subs if s.analysis]
        latest = analyzed[-1] if analyzed else None
        rows.append(
            {
                "patient_id": patient.id,
                "patient_number": patient.patient_number,
                "patient_name": patient.name,
                "age": patient.age,
                "gender": patient.gender,
                "plan_id": plan.id if plan else None,
                "plan_name": plan.name if plan else None,
                "plan_status": plan.status if plan else None,
                "is_mine": is_mine,
                "nurse_name": plan.nurse.name if plan and plan.nurse else None,
                "pending_review_count": sum(1 for s in subs if s.status == "PENDING_REVIEW"),
                "latest_submission_date": subs[-1].submitted_at.date().isoformat()
                if subs
                else None,
                "latest_score": latest.analysis.overall_score if latest else None,
            }
        )
    return rows


def get_patient_detail_for_nurse(db: Session, nurse: User, patient_id: int) -> dict:
    """護理師端病患詳細頁：基本資料 + 目前計畫（含動作）+ 計畫卡列表 + 看診史。"""
    patient = common.get_patient_or_404(db, patient_id)
    active_plan = common.get_active_plan(patient)
    plans = common.get_patient_plans(patient)
    visits = common.get_completed_visits(patient)

    # 有效中計畫展開成含目標與動作項目的完整結構（護理師要逐項維護）
    current_plan = None
    if active_plan:
        current = active_plan.current_version
        current_plan = {
            "id": active_plan.id,
            "name": active_plan.name,
            "status": active_plan.status,
            "version": current.version if current else None,
            "doctor_name": active_plan.doctor.name,
            "nurse_name": active_plan.nurse.name if active_plan.nurse else None,
            "start_date": active_plan.start_date.isoformat(),
            "evaluation_date": active_plan.evaluation_date.isoformat()
            if active_plan.evaluation_date
            else None,
            "goals": (current.goals or []) if current else [],
            "items": [
                common.item_to_out(i).model_dump(mode="json")
                for i in (current.items if current else [])
            ],
        }

    return {
        "basic": PatientBasicInfo(
            id=patient.id,
            patient_number=patient.patient_number,
            name=patient.name,
            birth_date=patient.birth_date,
            age=patient.age,
            gender=patient.gender,
            phone=patient.phone,
            created_at=patient.created_at.date(),
        ).model_dump(mode="json"),
        "rehab_status": common.get_rehab_status(patient),
        "current_plan": current_plan,
        "plans": [common.plan_to_card(plan, db).model_dump(mode="json") for plan in plans],
        "visits": [common.visit_to_out(visit).model_dump(mode="json") for visit in visits],
    }


# ---- 影片審核 ----


def list_submissions(
    db: Session,
    nurse: User,
    status: str | None = None,
    decision: str | None = None,
    search: str | None = None,
) -> dict:
    """審核佇列頁：summary 計數永遠算「全部」（不受篩選影響），列表才套篩選
    ——篩選到空清單時卡片數字仍要反映真實工作量。"""
    subs = _my_submissions_query(db, nurse).order_by(VideoSubmission.submitted_at).all()

    # 列表用的複本套三種篩選（summary 仍算未篩選的 subs）
    rows = list(subs)
    if status and status != "ALL":
        rows = [s for s in rows if s.status == status]
    if decision and decision != "ALL":
        rows = [s for s in rows if s.decision == decision]
    if search:
        key = search.strip()
        rows = [
            s
            for s in rows
            if key in s.patient.name
            or key in s.patient.patient_number
            or key in s.plan.name
            or key in s.plan_item.name
        ]

    # 待審核優先、其次最新
    def sort_key(s: VideoSubmission):
        order = {"PENDING_REVIEW": 0, "ANALYZING": 1, "REVIEWED": 2}
        return (order.get(s.status, 3), -s.submitted_at.timestamp())

    rows.sort(key=sort_key)

    today = date.today()
    return {
        "summary": {
            "pending_review_count": sum(1 for s in subs if s.status == "PENDING_REVIEW"),
            "analyzing_count": sum(1 for s in subs if s.status == "ANALYZING"),
            "reviewed_today_count": sum(
                1 for s in subs if s.reviewed_at and s.reviewed_at.date() == today
            ),
            "needs_attention_count": sum(
                1
                for s in subs
                if s.status == "PENDING_REVIEW" and common.submission_needs_attention(s, subs)
            ),
        },
        "submissions": [
            common.submission_to_list_item(s, subs).model_dump(mode="json") for s in rows
        ],
    }


def get_submission_or_404(db: Session, submission_id: int) -> VideoSubmission:
    """以 id 取上傳紀錄，不存在回 404。"""
    sub = db.get(VideoSubmission, submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="上傳紀錄不存在")
    return sub


def get_submission_detail(db: Session, submission_id: int) -> SubmissionDetailOut:
    """審核頁的完整資料組裝（病患/計畫/動作/分析/審核狀態 + 歷次分數）。"""
    sub = get_submission_or_404(db, submission_id)
    patient = sub.patient
    item = sub.plan_item

    # 同病患同動作的歷次分數
    history = (
        db.query(VideoSubmission)
        .filter(
            VideoSubmission.patient_id == sub.patient_id,
            VideoSubmission.plan_item_id == sub.plan_item_id,
        )
        .order_by(VideoSubmission.submitted_at)
        .all()
    )

    return SubmissionDetailOut(
        id=sub.id,
        patient_id=patient.id,
        patient_name=patient.name,
        patient_number=patient.patient_number,
        patient_age=patient.age,
        patient_gender=patient.gender,
        plan_id=sub.plan_id,
        plan_name=sub.plan.name,
        plan_status=sub.plan.status,
        plan_version=sub.plan_version.version,
        item=SubmissionItemInfo(
            id=item.id,
            name=item.name,
            frequency=item.frequency,
            description=item.description,
            precaution=item.precaution,
            example_video_url=item.example_video_url,
            example_video_note=item.example_video_note,
            teacher_video_id=item.teacher_video_id,
        ),
        submitted_at=sub.submitted_at,
        duration_seconds=sub.duration_seconds,
        video_url=sub.video_url,
        status=sub.status,
        display_status=common.submission_display_status(sub),
        analysis_status=sub.analysis_status,
        analysis_error=sub.analysis_error,
        teacher_video_id=sub.teacher_video_id,
        analysis=common.analysis_to_out(sub.analysis) if sub.analysis else None,
        reviewer_name=sub.reviewer.name if sub.reviewer else None,
        reviewed_at=sub.reviewed_at,
        decision=sub.decision,
        feedback=sub.feedback,
        score_history=common.score_trend(history),
    )


def review_submission(
    db: Session, nurse: User, submission_id: int, data: ReviewSubmit
) -> SubmissionDetailOut:
    """送出審核結果。REVIEWED 後仍可再送（覆寫決定與回饋），視為修正審核。"""
    sub = get_submission_or_404(db, submission_id)
    # 分析中不給審（含 FAILED——status 仍是 ANALYZING）：
    # 失敗件要先走重新分析，避免在沒有演算法佐證下審核
    if sub.status == "ANALYZING":
        raise HTTPException(status_code=400, detail="演算法分析中，尚無法審核")
    if data.decision not in ("APPROVED", "NEEDS_ATTENTION"):
        raise HTTPException(status_code=422, detail="無效的審核結果")

    # 寫入審核結果：狀態轉 REVIEWED、記錄審核者與時間
    sub.status = "REVIEWED"
    sub.decision = data.decision
    sub.feedback = data.feedback
    sub.reviewed_by = nurse.id
    sub.reviewed_at = datetime.now()
    db.commit()
    return get_submission_detail(db, submission_id)


# ---- 回報醫生 ----


def create_report(db: Session, nurse: User, data: NurseReportCreate) -> NurseReport:
    """護理師建立給醫生的回報（初始狀態 PENDING_DOCTOR_REVIEW）。"""
    # 驗證目標計畫存在、回報類型合法
    plan = db.get(RehabPlan, data.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="復健計畫不存在")
    if data.kind not in ("STATUS_REPORT", "ADJUSTMENT_SUGGESTION", "ABNORMALITY"):
        raise HTTPException(status_code=422, detail="無效的回報類型")
    report = NurseReport(
        plan_id=data.plan_id,
        submission_id=data.submission_id,
        nurse_id=nurse.id,
        kind=data.kind,
        severity=data.severity,
        content=data.content,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def list_reports(db: Session, nurse: User) -> list[NurseReport]:
    """我送出過的回報（新到舊）。"""
    return (
        db.query(NurseReport)
        .filter(NurseReport.nurse_id == nurse.id)
        .order_by(NurseReport.created_at.desc())
        .all()
    )


# ---- 動作管理 ----


def _get_current_version(db: Session, plan_id: int):
    """取計畫與其目前版本；缺任一即擋（動作維護的共同前置檢查）。"""
    plan = db.get(RehabPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="復健計畫不存在")
    current = plan.current_version
    if not current:
        raise HTTPException(status_code=400, detail="計畫沒有有效版本")
    return plan, current


def get_plan_for_items(db: Session, plan_id: int) -> dict:
    """動作管理頁的資料：計畫摘要 + 目前版本的目標與動作清單。"""
    plan, current = _get_current_version(db, plan_id)
    return {
        "plan_id": plan.id,
        "plan_name": plan.name,
        "plan_status": plan.status,
        "version": current.version,
        "patient_id": plan.patient_id,
        "patient_name": plan.patient.name,
        "patient_number": plan.patient.patient_number,
        "goals": current.goals or [],
        "items": [common.item_to_out(i).model_dump(mode="json") for i in current.items],
    }


def add_plan_item(db: Session, plan_id: int, data: PlanItemCreate) -> dict:
    """在目前版本新增動作項目（護理師逐項維護，不產生新版本）。"""
    plan, current = _get_current_version(db, plan_id)
    if plan.status not in common.ACTIVE_PLAN_STATUSES:
        raise HTTPException(status_code=400, detail="計畫已結束，無法新增動作")
    # 有指定導師影片時驗證其存在且已完成萃取
    if data.teacher_video_id is not None:
        common.get_selectable_teacher_video(db, data.teacher_video_id)
    item = PlanItem(version_id=current.id, **data.model_dump())
    db.add(item)
    db.commit()
    return get_plan_for_items(db, plan_id)


def update_plan_item(db: Session, plan_id: int, item_id: int, data: PlanItemUpdate) -> dict:
    """部分更新動作項目（只動有帶的欄位；teacher_video_id 傳 null 可解除綁定）。"""
    plan, current = _get_current_version(db, plan_id)
    if plan.status not in common.ACTIVE_PLAN_STATUSES:
        raise HTTPException(status_code=400, detail="計畫已結束，無法修改動作")
    # item 必須屬於目前版本——歷史版本的項目是唯讀快照
    item = db.get(PlanItem, item_id)
    if not item or item.version_id != current.id:
        raise HTTPException(status_code=404, detail="動作項目不存在")
    # exclude_unset：沒帶的欄位不動；新綁定的導師影片需通過可選用驗證
    changes = data.model_dump(exclude_unset=True)
    if changes.get("teacher_video_id") is not None:
        common.get_selectable_teacher_video(db, changes["teacher_video_id"])
    for field, value in changes.items():
        setattr(item, field, value)
    db.commit()
    return get_plan_for_items(db, plan_id)


def delete_plan_item(db: Session, plan_id: int, item_id: int) -> dict:
    """刪除目前版本的動作項目（已有上傳紀錄的動作不可刪，保護歷史對照）。"""
    plan, current = _get_current_version(db, plan_id)
    if plan.status not in common.ACTIVE_PLAN_STATUSES:
        raise HTTPException(status_code=400, detail="計畫已結束，無法刪除動作")
    item = db.get(PlanItem, item_id)
    if not item or item.version_id != current.id:
        raise HTTPException(status_code=404, detail="動作項目不存在")
    # 有上傳引用的動作不能刪：submissions.plan_item_id 是 FK，
    # 刪了會讓歷史影片對不回「當時做的是哪個動作」
    has_submissions = (
        db.query(VideoSubmission).filter(VideoSubmission.plan_item_id == item_id).count()
    )
    if has_submissions:
        raise HTTPException(status_code=400, detail="此動作已有上傳紀錄，無法刪除")
    db.delete(item)
    db.commit()
    return get_plan_for_items(db, plan_id)


# ---- 導師影片 ----


def teacher_video_to_out(tv: TeacherVideo) -> TeacherVideoOut:
    """TeacherVideo ORM → 回應結構（含萃取/標註狀態）。"""
    return TeacherVideoOut(
        id=tv.id,
        name=tv.name,
        original_filename=tv.original_filename,
        folder_id=tv.folder_id,
        uploader_name=tv.uploader.name if tv.uploader else None,
        fps=tv.fps,
        frame_count=tv.frame_count,
        extraction_status=tv.extraction_status,
        extraction_error=tv.extraction_error,
        annotation_status=tv.annotation_status,
        annotation_frames=tv.annotation_frames,
        created_at=tv.created_at,
    )


def get_teacher_video_or_404(db: Session, teacher_video_id: int) -> TeacherVideo:
    """以 id 取導師影片，不存在回 404。"""
    tv = db.get(TeacherVideo, teacher_video_id)
    if not tv:
        raise HTTPException(status_code=404, detail="導師影片不存在")
    return tv


def list_teacher_videos(db: Session) -> list[TeacherVideoOut]:
    """影片庫清單（跨護理師共享），新到舊。"""
    videos = db.query(TeacherVideo).order_by(TeacherVideo.created_at.desc()).all()
    return [teacher_video_to_out(tv) for tv in videos]


def _create_teacher_video(db: Session, nurse: User, upload: UploadFile, name: str) -> TeacherVideo:
    """建立導師影片、存檔並排入 轉檔 → 2D/3D 萃取 pipeline（不綁定動作）。"""
    clean_name = name.strip()
    if not clean_name:
        raise HTTPException(status_code=422, detail="請輸入影片名稱")

    tv = TeacherVideo(uploaded_by=nurse.id, name=clean_name, extraction_status="PENDING")
    db.add(tv)
    db.flush()  # 先取得 id 才能決定存放目錄 teacher_videos/{id}/（commit 由呼叫端做）

    rel_path, original_name = media_service.save_upload(
        upload, media_service.teacher_video_dir(tv.id)
    )
    tv.video_path = rel_path  # 轉檔完成後由 worker 改指向 t{id}.mp4
    tv.original_filename = original_name
    return tv


def create_teacher_video(
    db: Session, nurse: User, upload: UploadFile, name: str
) -> TeacherVideoOut:
    """獨立上傳到影片庫（新增動作時先上傳、建立動作時再綁定）。"""
    tv = _create_teacher_video(db, nurse, upload, name)
    db.commit()
    task_queue.enqueue_teacher_pipeline(tv.id)
    return teacher_video_to_out(tv)


def upload_teacher_video(
    db: Session, nurse: User, plan_id: int, item_id: int, upload: UploadFile, name: str
) -> TeacherVideoOut:
    """上傳導師影片並綁定到指定動作，背景排入 轉檔 → 2D/3D 萃取 pipeline。"""
    plan, current = _get_current_version(db, plan_id)
    item = db.get(PlanItem, item_id)
    if not item or item.version_id != current.id:
        raise HTTPException(status_code=404, detail="動作項目不存在")
    if plan.status not in common.ACTIVE_PLAN_STATUSES:
        raise HTTPException(status_code=400, detail="計畫已結束，無法上傳導師影片")

    tv = _create_teacher_video(db, nurse, upload, name)
    item.teacher_video_id = tv.id
    db.commit()

    task_queue.enqueue_teacher_pipeline(tv.id)
    return teacher_video_to_out(tv)


def delete_teacher_video(db: Session, teacher_video_id: int) -> dict:
    """刪除影片庫中的導師影片（連同磁碟上的影片與萃取產物）。"""
    tv = get_teacher_video_or_404(db, teacher_video_id)
    referenced = db.query(PlanItem).filter(PlanItem.teacher_video_id == tv.id).count()
    if referenced:
        raise HTTPException(
            status_code=409, detail="此導師影片仍被復健計畫動作引用，請先更換影片再刪除"
        )
    # FIXME: 只檢查了 PlanItem 引用，沒檢查 VideoSubmission.teacher_video_id
    # （上傳當下的快照）——被歷史上傳引用的影片會在 db.delete 時撞 FK 直接 500，
    # 且下一行已先把磁碟檔案刪掉，形成「DB 還在、檔案已消失」的殘缺狀態。
    # 應改為：先驗兩種引用 → commit 成功後才刪檔案。
    media_service.delete_media_dir(media_service.teacher_video_dir(tv.id))
    db.delete(tv)
    db.commit()
    return {"detail": "導師影片已刪除"}


def update_teacher_video(
    db: Session, teacher_video_id: int, data: TeacherVideoUpdate
) -> TeacherVideoOut:
    """改名與/或移動資料夾（fields_set 未含的欄位不動）。"""
    tv = get_teacher_video_or_404(db, teacher_video_id)
    if "name" in data.model_fields_set:
        clean_name = (data.name or "").strip()
        if not clean_name:
            raise HTTPException(status_code=422, detail="請輸入影片名稱")
        tv.name = clean_name
    if "folder_id" in data.model_fields_set:
        if data.folder_id is not None:
            get_folder_or_404(db, data.folder_id)
        tv.folder_id = data.folder_id
    db.commit()
    return teacher_video_to_out(tv)


def reextract_teacher_video(db: Session, teacher_video_id: int) -> TeacherVideoOut:
    """重新執行 2D/3D 萃取：刪除姿態產物後重排 pipeline。

    保留 t{id}.mp4（transcode 會短路）與標註（annotation JSON 只依 mp4+幀號產生，
    影片內容未變仍有效）。既有比對結果不受影響，需另行對 submission 重新分析。
    """
    tv = get_teacher_video_or_404(db, teacher_video_id)
    if tv.extraction_status in ("PENDING", "TRANSCODING", "EXTRACTING"):
        raise HTTPException(status_code=409, detail="萃取處理中，請稍候")
    tv_dir = media_service.teacher_video_dir(tv.id)
    media_service.delete_media_dir(tv_dir / "alphapose")
    media_service.delete_media_dir(tv_dir / "motionbert")
    tv.extraction_status = "PENDING"
    tv.extraction_error = None
    db.commit()
    task_queue.enqueue_teacher_pipeline(tv.id)
    return teacher_video_to_out(tv)


# ---- 導師影片資料夾 ----


def get_folder_or_404(db: Session, folder_id: int) -> TeacherVideoFolder:
    """以 id 取資料夾，不存在回 404。"""
    folder = db.get(TeacherVideoFolder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="資料夾不存在")
    return folder


def _clean_folder_name(db: Session, name: str, exclude_id: int | None = None) -> str:
    """資料夾名稱正規化 + 撞名檢查（改名時以 exclude_id 排除自己）。"""
    clean = name.strip()
    if not clean:
        raise HTTPException(status_code=422, detail="請輸入資料夾名稱")
    query = db.query(TeacherVideoFolder).filter(TeacherVideoFolder.name == clean)
    if exclude_id is not None:
        query = query.filter(TeacherVideoFolder.id != exclude_id)
    if query.count():
        raise HTTPException(status_code=409, detail="已有同名資料夾")
    return clean


def _folder_to_out(folder: TeacherVideoFolder, video_count: int) -> TeacherVideoFolderOut:
    """Folder ORM → 回應結構（影片數由呼叫端算好傳入）。"""
    return TeacherVideoFolderOut(
        id=folder.id,
        name=folder.name,
        video_count=video_count,
        created_at=folder.created_at,
    )


def list_teacher_video_folders(db: Session) -> list[TeacherVideoFolderOut]:
    """全部資料夾（名稱排序）。影片數用一次 group by 算齊，避免逐夾 count。"""
    counts = dict(
        db.query(TeacherVideo.folder_id, func.count(TeacherVideo.id))
        .filter(TeacherVideo.folder_id.isnot(None))
        .group_by(TeacherVideo.folder_id)
        .all()
    )
    folders = db.query(TeacherVideoFolder).order_by(TeacherVideoFolder.name).all()
    return [_folder_to_out(f, counts.get(f.id, 0)) for f in folders]


def create_teacher_video_folder(db: Session, data: TeacherVideoFolderIn) -> TeacherVideoFolderOut:
    """建立資料夾（名稱唯一）。"""
    folder = TeacherVideoFolder(name=_clean_folder_name(db, data.name))
    db.add(folder)
    db.commit()
    return _folder_to_out(folder, 0)


def rename_teacher_video_folder(
    db: Session, folder_id: int, data: TeacherVideoFolderIn
) -> TeacherVideoFolderOut:
    """資料夾改名（撞名檢查排除自己）。"""
    folder = get_folder_or_404(db, folder_id)
    folder.name = _clean_folder_name(db, data.name, exclude_id=folder.id)
    db.commit()
    count = db.query(TeacherVideo).filter(TeacherVideo.folder_id == folder.id).count()
    return _folder_to_out(folder, count)


def delete_teacher_video_folder(db: Session, folder_id: int) -> dict:
    """刪除資料夾；夾內影片移回未分類（不刪影片）。"""
    folder = get_folder_or_404(db, folder_id)
    db.query(TeacherVideo).filter(TeacherVideo.folder_id == folder.id).update(
        {TeacherVideo.folder_id: None}
    )
    db.delete(folder)
    db.commit()
    return {"detail": "資料夾已刪除，影片已移至未分類"}


# ---- 導師影片標註 ----


def get_annotation(db: Session, teacher_video_id: int) -> AnnotationOut:
    """標註頁資料：影片參數 + 現有標註幀（未標註過回空清單）。"""
    tv = get_teacher_video_or_404(db, teacher_video_id)
    return AnnotationOut(
        teacher_video_id=tv.id,
        fps=tv.fps,
        frame_count=tv.frame_count,
        annotation_status=tv.annotation_status,
        frames=tv.annotation_frames or [],
    )


def submit_annotation(db: Session, teacher_video_id: int, data: AnnotationSubmit) -> AnnotationOut:
    """送出重點動作幀標註並排入 annotation JSON 產生任務。"""
    tv = get_teacher_video_or_404(db, teacher_video_id)
    # 標註以幀號指涉影片內容，必須等萃取（轉檔後幀數已定）完成才有意義
    if tv.extraction_status != "EXTRACTED":
        raise HTTPException(status_code=409, detail="影片尚未完成 2D/3D 萃取，無法標註")
    # 去重排序：標註順序由幀號決定，前端送來的順序不可信
    frames = sorted(set(int(f) for f in data.frames))
    if not frames:
        raise HTTPException(status_code=422, detail="至少需標註一個重點動作幀")
    if frames[0] < 0 or (tv.frame_count and frames[-1] >= tv.frame_count):
        raise HTTPException(status_code=422, detail="標註幀超出影片範圍")

    # ANNOTATING → worker 寫完 annotation JSON 後改 ANNOTATED；
    # 先 commit 再 enqueue，確保 worker 讀到的一定是新標註
    tv.annotation_frames = frames
    tv.annotation_status = "ANNOTATING"
    db.commit()
    task_queue.enqueue_annotation(tv.id, frames)
    return get_annotation(db, teacher_video_id)


# ---- 重新分析 ----


def reanalyze_submission(db: Session, submission_id: int) -> dict:
    """重新排入分析 pipeline（產物存在時 worker 會短路重用，冪等）。"""
    sub = get_submission_or_404(db, submission_id)
    if not sub.teacher_video_id:
        raise HTTPException(status_code=409, detail="此紀錄沒有綁定導師影片，無法重新分析")
    if sub.analysis_status in ("TRANSCODING", "EXTRACTING", "COMPARING"):
        raise HTTPException(status_code=409, detail="分析進行中，請稍候")
    # 先 commit 狀態再 enqueue：worker 可能立刻開跑，必須先看到 PENDING；
    # task_id 要等 enqueue 才拿得到，所以分兩次 commit
    sub.analysis_status = "PENDING"
    sub.analysis_error = None
    sub.status = "ANALYZING"
    db.commit()
    task_id = task_queue.enqueue_submission_pipeline(sub.id, sub.teacher_video_id)
    sub.celery_task_id = task_id
    db.commit()
    return {"detail": "已重新排入分析", "submission_id": sub.id}
