"""跨角色共用的查詢與序列化 helpers。"""

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.patient import Patient
from app.models.rehab_plan import PlanVersion, RehabPlan
from app.models.submission import NurseReport, VideoSubmission
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

ACTIVE_PLAN_STATUSES = ("ONGOING", "PENDING_EVALUATION")

# 需注意判定：整體分數低於門檻，或連續兩次下滑
ATTENTION_SCORE_THRESHOLD = 65


def get_active_plan(patient: Patient) -> RehabPlan | None:
    active = [p for p in patient.plans if p.status in ACTIVE_PLAN_STATUSES]
    return max(active, key=lambda p: p.start_date) if active else None


def get_rehab_status(patient: Patient) -> str:
    """NO_PLAN | ONGOING | PENDING_EVALUATION | CLOSED"""
    active = get_active_plan(patient)
    if active:
        return active.status
    return "CLOSED" if patient.plans else "NO_PLAN"


def get_last_visit(patient: Patient) -> Visit | None:
    completed = [v for v in patient.visits if v.status == "COMPLETED"]
    return max(completed, key=lambda v: v.visit_date) if completed else None


def is_follow_up_overdue(patient: Patient) -> bool:
    last = get_last_visit(patient)
    if not last or not last.follow_up_date:
        return False
    later_visit = any(v.visit_date > last.visit_date for v in patient.visits)
    return last.follow_up_date < date.today() and not later_visit


def visit_to_out(visit: Visit) -> VisitOut:
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


def plan_to_card(plan: RehabPlan) -> PlanCardOut:
    current = plan.current_version
    return PlanCardOut(
        id=plan.id,
        name=plan.name,
        status=plan.status,
        start_date=plan.start_date,
        evaluation_date=plan.evaluation_date,
        nurse_name=plan.nurse.name if plan.nurse else None,
        current_version=current.version if current else None,
    )


# ---- 上傳與審核 ----

def plan_submissions(db: Session, plan_id: int) -> list[VideoSubmission]:
    return (
        db.query(VideoSubmission)
        .filter(VideoSubmission.plan_id == plan_id)
        .order_by(VideoSubmission.submitted_at)
        .all()
    )


def submission_needs_attention(sub: VideoSubmission, history: list[VideoSubmission] | None = None) -> bool:
    """分數偏低，或與同動作前一次相比明顯下滑。"""
    if not sub.analysis:
        return False
    if sub.analysis.overall_score < ATTENTION_SCORE_THRESHOLD:
        return True
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


def submission_to_list_item(
    sub: VideoSubmission, history: list[VideoSubmission] | None = None
) -> SubmissionListItem:
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
        decision=sub.decision,
        overall_score=sub.analysis.overall_score if sub.analysis else None,
        needs_attention=submission_needs_attention(sub, history),
    )


def analysis_to_out(analysis) -> AnalysisOut:
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
    by_day: dict[date, list] = {}
    for s in submissions:
        if s.analysis:
            by_day.setdefault(s.submitted_at.date(), []).append(s.analysis)
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
    current = plan.current_version
    if not current:
        return 0
    return sum(i.times_per_week for i in current.items)


def completion_trend(
    plan: RehabPlan, submissions: list[VideoSubmission], weeks: int = 4
) -> list[CompletionTrendPoint]:
    """近 N 週的每週完成率：實際上傳次數 / 當週處方次數。"""
    prescribed = weekly_prescribed(plan)
    today = date.today()
    this_monday = today - timedelta(days=today.weekday())
    points = []
    for offset in range(weeks - 1, -1, -1):
        week_start = this_monday - timedelta(weeks=offset)
        week_end = week_start + timedelta(days=7)
        completed = sum(
            1 for s in submissions if week_start <= s.submitted_at.date() < week_end
        )
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
    from fastapi import HTTPException

    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="病患不存在")
    return patient
