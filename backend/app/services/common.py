"""跨角色共用的查詢與序列化 helpers。"""

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.patient import Patient
from app.models.rehab_plan import PlanVersion, RehabPlan
from app.models.submission import NurseReport, VideoSubmission
from app.models.teacher_video import TeacherVideo
from app.models.visit import Visit
from app.schemas.rehab_plan import (
    PlanCardOut,
    PlanItemOut,
    PlanItemTeacherVideo,
    PlanVersionOut,
)
from app.schemas.submission import (
    AnalysisOut,
    CompletionTrendPoint,
    NurseReportOut,
    ScoreTrendPoint,
    SubmissionListItem,
)
from app.schemas.visit import VisitOut

# 「有效中」= 病患仍在執行、儀表板要追蹤的計畫（COMPLETED/CLOSED/CANCELLED 之外）
ACTIVE_PLAN_STATUSES = ("ONGOING", "PENDING_EVALUATION")

# 需注意判定：整體分數低於門檻，或連續兩次下滑
ATTENTION_SCORE_THRESHOLD = 65


def get_active_plan(patient: Patient) -> RehabPlan | None:
    """病患目前的有效計畫。理論上同時只會有一個，
    若資料異常出現多個，取最近開始的那個而非炸掉。"""
    active = [p for p in patient.plans if p.status in ACTIVE_PLAN_STATUSES]
    return max(active, key=lambda p: p.start_date) if active else None


def get_patient_plans(patient: Patient) -> list[RehabPlan]:
    """計畫列表排序：有效中優先，再依開始日新到舊（id 當同日 tiebreaker）。"""
    return sorted(
        patient.plans,
        key=lambda plan: (
            plan.status in ACTIVE_PLAN_STATUSES,
            plan.start_date,
            plan.id,
        ),
        reverse=True,
    )


def get_completed_visits(patient: Patient) -> list[Visit]:
    """已完成的看診紀錄，新到舊（候診中/看診中不列入病歷顯示）。"""
    return sorted(
        (visit for visit in patient.visits if visit.status == "COMPLETED"),
        key=lambda visit: (visit.visit_date, visit.id),
        reverse=True,
    )


def get_rehab_status(patient: Patient) -> str:
    """NO_PLAN | ONGOING | PENDING_EVALUATION | CLOSED"""
    active = get_active_plan(patient)
    if active:
        return active.status
    return "CLOSED" if patient.plans else "NO_PLAN"


def get_last_visit(patient: Patient) -> Visit | None:
    """最近一次完成的看診（無看診史回 None）。"""
    completed = [v for v in patient.visits if v.status == "COMPLETED"]
    return max(completed, key=lambda v: v.visit_date) if completed else None


def is_follow_up_overdue(patient: Patient) -> bool:
    """逾期未回診：最後一次完成看診有約回診日、已過期，且之後沒有任何新掛號。

    later_visit 不限 COMPLETED——只要病患已再掛號（含候診中）就不算逾期，
    避免病患人已到院還被標成逾期。
    """
    last = get_last_visit(patient)
    if not last or not last.follow_up_date:
        return False
    later_visit = any(v.visit_date > last.visit_date for v in patient.visits)
    return last.follow_up_date < date.today() and not later_visit


def visit_to_out(visit: Visit) -> VisitOut:
    """Visit ORM → 回應結構（含醫生姓名的展平）。"""
    return VisitOut(
        id=visit.id,
        visit_date=visit.visit_date,
        status=visit.status,
        visit_type=visit.visit_type,
        chief_complaint=visit.chief_complaint,
        diagnosis=visit.diagnosis,
        assessment=visit.assessment,
        rehab_decision=visit.rehab_decision,
        follow_up_date=visit.follow_up_date,
        doctor_name=visit.doctor.name,
    )


def item_to_out(item) -> PlanItemOut:
    """PlanItem ORM → 回應結構；有綁導師影片時附上其狀態摘要。"""
    tv = item.teacher_video
    return PlanItemOut(
        id=item.id,
        name=item.name,
        frequency=item.frequency,
        times_per_week=item.times_per_week,
        description=item.description,
        precaution=item.precaution,
        example_video_url=item.example_video_url,
        example_video_note=item.example_video_note,
        teacher_video=PlanItemTeacherVideo(
            id=tv.id,
            name=tv.name,
            uploader_name=tv.uploader.name if tv.uploader else None,
            extraction_status=tv.extraction_status,
            annotation_status=tv.annotation_status,
            fps=tv.fps,
            frame_count=tv.frame_count,
            extraction_error=tv.extraction_error,
        )
        if tv
        else None,
    )


def version_to_out(version: PlanVersion) -> PlanVersionOut:
    """PlanVersion ORM → 回應結構（含全部動作項目）。"""
    return PlanVersionOut(
        id=version.id,
        version=version.version,
        goals=version.goals or [],
        change_summary=version.change_summary,
        started_at=version.started_at,
        ended_at=version.ended_at,
        is_current=version.is_current,
        items=[item_to_out(i) for i in version.items],
    )


def plan_to_card(plan: RehabPlan, db: Session | None = None) -> PlanCardOut:
    """計畫卡片。db 為選填：不傳就略過待審數的 count 查詢
    （呼叫端不需要該數字時省一次 DB 往返）。"""
    current = plan.current_version
    pending = 0
    if db is not None:
        pending = (
            db.query(VideoSubmission)
            .filter(
                VideoSubmission.plan_id == plan.id,
                VideoSubmission.status == "PENDING_REVIEW",
            )
            .count()
        )
    return PlanCardOut(
        id=plan.id,
        name=plan.name,
        status=plan.status,
        start_date=plan.start_date,
        evaluation_date=plan.evaluation_date,
        doctor_name=plan.doctor.name,
        nurse_name=plan.nurse.name if plan.nurse else None,
        current_version=current.version if current else None,
        item_count=len(current.items) if current else 0,
        pending_review_count=pending,
    )


# ---- 上傳與審核 ----


def plan_submissions(db: Session, plan_id: int) -> list[VideoSubmission]:
    """某計畫的全部上傳（舊到新——趨勢計算依賴此順序）。"""
    return (
        db.query(VideoSubmission)
        .filter(VideoSubmission.plan_id == plan_id)
        .order_by(VideoSubmission.submitted_at)
        .all()
    )


def submission_needs_attention(
    sub: VideoSubmission, history: list[VideoSubmission] | None = None
) -> bool:
    """分數偏低，或與同動作前一次相比明顯下滑（跌超過 8 分）。

    Args:
        history: 用來找「前一次」的候選清單（呼叫端已抓好的同批 submissions，
                 避免每筆再查一次 DB）；不傳則只做低分判定。
    """
    # 沒有分析結果就無從判斷
    if not sub.analysis:
        return False
    # 條件一：絕對低分
    if sub.analysis.overall_score < ATTENTION_SCORE_THRESHOLD:
        return True
    # 條件二：與「同動作、時間在前、有分析」的最近一筆相比明顯下滑
    if history:
        prev = [
            s
            for s in history
            if s.plan_item_id == sub.plan_item_id
            and s.analysis
            and s.submitted_at < sub.submitted_at
        ]
        if prev:
            last = max(prev, key=lambda s: s.submitted_at)
            if sub.analysis.overall_score < last.analysis.overall_score - 8:
                return True
    return False


def submission_display_status(sub: VideoSubmission) -> str:
    """單一顯示狀態：FAILED > 管線階段（分析中）> 業務狀態。
    值域：PENDING|TRANSCODING|EXTRACTING|COMPARING|DONE|FAILED|PENDING_REVIEW|REVIEWED"""
    if sub.analysis_status == "FAILED":
        return "FAILED"
    if sub.status == "ANALYZING":
        return sub.analysis_status
    return sub.status


def submission_to_list_item(
    sub: VideoSubmission, history: list[VideoSubmission] | None = None
) -> SubmissionListItem:
    """VideoSubmission ORM → 列表列（展平病患/計畫/動作名與分數）。"""
    return SubmissionListItem(
        id=sub.id,
        patient_id=sub.patient_id,
        patient_name=sub.patient.name,
        patient_number=sub.patient.patient_number,
        plan_id=sub.plan_id,
        plan_name=sub.plan.name,
        item_name=sub.plan_item.name,
        submitted_at=sub.submitted_at,
        status=sub.status,
        display_status=submission_display_status(sub),
        decision=sub.decision,
        overall_score=sub.analysis.overall_score if sub.analysis else None,
        needs_attention=submission_needs_attention(sub, history),
    )


def analysis_to_out(analysis) -> AnalysisOut:
    """AnalysisResult ORM → 回應結構；ai_report 從 metrics JSON 抽出成頂層欄位。"""
    return AnalysisOut(
        analyzed_at=analysis.analyzed_at,
        overall_score=analysis.overall_score,
        joint_angle_score=analysis.joint_angle_score,
        stability_score=analysis.stability_score,
        posture_score=analysis.posture_score,
        metrics=analysis.metrics or {},
        summary_text=analysis.summary_text,
        ai_report=(analysis.metrics or {}).get("ai_report"),
    )


def report_to_out(report: NurseReport) -> NurseReportOut:
    """NurseReport ORM → 回應結構（展平計畫/病患/護理師名）。"""
    return NurseReportOut(
        id=report.id,
        plan_id=report.plan_id,
        plan_name=report.plan.name,
        patient_id=report.plan.patient_id,
        patient_name=report.plan.patient.name,
        patient_number=report.plan.patient.patient_number,
        submission_id=report.submission_id,
        nurse_name=report.nurse.name,
        kind=report.kind,
        severity=report.severity,
        content=report.content,
        created_at=report.created_at,
        status=report.status,
        doctor_comment=report.doctor_comment,
    )


# ---- 趨勢計算 ----


def score_trend(submissions: list[VideoSubmission]) -> list[ScoreTrendPoint]:
    """依日期彙整（同日多筆取平均）分析分數趨勢。"""
    # 先把有分析結果的上傳按上傳日分組
    by_day: dict[date, list] = {}
    for s in submissions:
        if s.analysis:
            by_day.setdefault(s.submitted_at.date(), []).append(s.analysis)
    # 每組算四種分數的平均，依日期舊到新輸出
    points = []
    for day in sorted(by_day):
        group = by_day[day]
        n = len(group)
        points.append(
            ScoreTrendPoint(
                date=day,
                overall=round(sum(a.overall_score for a in group) / n, 1),
                joint_angle=round(sum(a.joint_angle_score for a in group) / n, 1),
                stability=round(sum(a.stability_score for a in group) / n, 1),
                posture=round(sum(a.posture_score for a in group) / n, 1),
            )
        )
    return points


def weekly_prescribed(plan: RehabPlan) -> int:
    """每週處方總次數 = 目前版本各動作 times_per_week 加總（完成率分母）。"""
    current = plan.current_version
    if not current:
        return 0
    return sum(i.times_per_week for i in current.items)


def completion_trend(
    plan: RehabPlan, submissions: list[VideoSubmission], weeks: int = 4
) -> list[CompletionTrendPoint]:
    """近 N 週的每週完成率：實際上傳次數 / 處方次數（週一為一週起點）。

    注意：分母固定用「目前版本」的處方，歷史週若當時處方不同會有偏差
    ——趨勢圖只求粗略走向，不為此保留各週的處方快照。
    """
    prescribed = weekly_prescribed(plan)
    # 以本週一為基準往回推 N 週（weekday()：週一=0）
    today = date.today()
    this_monday = today - timedelta(days=today.weekday())
    points = []
    for offset in range(weeks - 1, -1, -1):
        # 每週區間 [週一, 下週一)，數落在區間內的上傳次數
        week_start = this_monday - timedelta(weeks=offset)
        week_end = week_start + timedelta(days=7)
        completed = sum(1 for s in submissions if week_start <= s.submitted_at.date() < week_end)
        points.append(
            CompletionTrendPoint(
                week_start=week_start,
                label=f"{week_start.month}/{week_start.day} 週",
                completed=completed,
                prescribed=prescribed,
                rate=round(completed / prescribed, 2) if prescribed else 0.0,
            )
        )
    return points


def get_patient_or_404(db: Session, patient_id: int) -> Patient:
    """以 id 取病患，不存在直接回 404（router/service 共用的守門）。"""
    from fastapi import HTTPException

    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="病患不存在")
    return patient


def get_selectable_teacher_video(db: Session, teacher_video_id: int) -> TeacherVideo:
    """驗證影片庫的影片可被動作選用（存在且已完成萃取）。"""
    from fastapi import HTTPException

    tv = db.get(TeacherVideo, teacher_video_id)
    if not tv:
        raise HTTPException(status_code=404, detail="導師影片不存在")
    if tv.extraction_status != "EXTRACTED":
        raise HTTPException(status_code=400, detail="導師影片尚未完成 2D/3D 萃取，無法選用")
    return tv
