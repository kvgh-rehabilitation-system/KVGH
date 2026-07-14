from datetime import date, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.patient import Patient
from app.models.rehab_plan import PlanItem, PlanVersion, RehabPlan
from app.models.submission import NurseReport, VideoSubmission
from app.models.user import User
from app.models.visit import Visit
from app.schemas.dashboard import (
    DoctorDashboardOut,
    DoctorDashboardSummary,
    PlanReminderItem,
    TodayPatientItem,
)
from app.schemas.submission import DoctorReportReview
from app.schemas.patient import (
    PatientBasicInfo,
    PatientDetailOut,
    PatientListItem,
    PatientSummaryCards,
)
from app.schemas.rehab_plan import (
    NurseOption,
    PlanAdjust,
    PlanCreate,
    PlanDetailOut,
    PlanListItem,
    PlanListSummary,
)
from app.schemas.visit import VisitCreate, VisitOut
from app.services import common


def get_dashboard(db: Session, doctor: User) -> DoctorDashboardOut:
    today = date.today()
    today_visits = (
        db.query(Visit)
        .filter(Visit.doctor_id == doctor.id, Visit.visit_date == today)
        .order_by(Visit.id)
        .all()
    )

    pending_reports = (
        db.query(NurseReport)
        .join(RehabPlan, NurseReport.plan_id == RehabPlan.id)
        .filter(
            NurseReport.status == "PENDING_DOCTOR_REVIEW",
            RehabPlan.doctor_id == doctor.id,
        )
        .order_by(NurseReport.created_at.desc())
        .all()
    )

    summary = DoctorDashboardSummary(
        today_patient_count=len(today_visits),
        waiting_patient_count=sum(1 for v in today_visits if v.status == "WAITING"),
        completed_patient_count=sum(1 for v in today_visits if v.status == "COMPLETED"),
        pending_report_count=len(pending_reports),
    )

    today_patients = []
    for v in today_visits:
        patient = v.patient
        previous = [
            pv for pv in patient.visits if pv.status == "COMPLETED" and pv.id != v.id
        ]
        last = max(previous, key=lambda x: x.visit_date) if previous else None
        today_patients.append(
            TodayPatientItem(
                patient_id=patient.id,
                patient_name=patient.name,
                patient_number=patient.patient_number,
                visit_id=v.id,
                visit_type=v.visit_type,
                status=v.status,
                last_visit_date=last.visit_date if last else None,
                rehab_status=common.get_rehab_status(patient),
            )
        )

    plan_reminders = []
    plans = (
        db.query(RehabPlan)
        .filter(
            RehabPlan.doctor_id == doctor.id,
            RehabPlan.status.in_(common.ACTIVE_PLAN_STATUSES),
        )
        .all()
    )
    for plan in plans:
        reason = None
        if plan.status == "PENDING_EVALUATION":
            reason = "計畫標記為待評估"
        elif plan.evaluation_date and plan.evaluation_date <= today:
            reason = "已到達預計評估日期"
        elif plan.evaluation_date and plan.evaluation_date <= today + timedelta(days=3):
            reason = "計畫即將到達評估日期"
        if reason:
            plan_reminders.append(
                PlanReminderItem(
                    plan_id=plan.id,
                    patient_name=plan.patient.name,
                    plan_name=plan.name,
                    status=plan.status,
                    evaluation_date=plan.evaluation_date,
                    reason=reason,
                )
            )
    plan_reminders.sort(key=lambda r: (r.evaluation_date or date.max))

    return DoctorDashboardOut(
        summary=summary,
        today_patients=today_patients,
        plan_reminders=plan_reminders,
        pending_reports=[common.report_to_out(r) for r in pending_reports],
    )


def list_patients(
    db: Session,
    search: str | None = None,
    visit_type: str | None = None,
    rehab_status: str | None = None,
) -> list[PatientListItem]:
    query = db.query(Patient)
    if search:
        like = f"%{search}%"
        query = query.filter(
            (Patient.name.like(like)) | (Patient.patient_number.like(like))
        )
    patients = query.order_by(Patient.patient_number).all()

    result = []
    for p in patients:
        last = common.get_last_visit(p)
        status = common.get_rehab_status(p)
        item = PatientListItem(
            id=p.id,
            patient_number=p.patient_number,
            name=p.name,
            age=p.age,
            gender=p.gender,
            last_visit_date=last.visit_date if last else None,
            visit_type=last.visit_type if last else None,
            rehab_status=status,
            is_overdue=common.is_follow_up_overdue(p),
        )
        if visit_type and item.visit_type != visit_type:
            continue
        if rehab_status and status != rehab_status:
            continue
        result.append(item)
    return result


def get_patient_detail(db: Session, patient_id: int) -> PatientDetailOut:
    patient = common.get_patient_or_404(db, patient_id)
    completed_visits = [v for v in patient.visits if v.status == "COMPLETED"]
    last_visit = common.get_last_visit(patient)
    active_plan = common.get_active_plan(patient)

    last_submission = (
        db.query(VideoSubmission)
        .filter(VideoSubmission.patient_id == patient.id)
        .order_by(VideoSubmission.submitted_at.desc())
        .first()
    )

    return PatientDetailOut(
        basic=PatientBasicInfo(
            id=patient.id,
            patient_number=patient.patient_number,
            name=patient.name,
            birth_date=patient.birth_date,
            age=patient.age,
            gender=patient.gender,
            phone=patient.phone,
            created_at=patient.created_at.date(),
        ),
        summary=PatientSummaryCards(
            last_visit_date=last_visit.visit_date if last_visit else None,
            visit_count=len(completed_visits),
            active_plan_count=1 if active_plan else 0,
            last_submission_date=last_submission.submitted_at.date()
            if last_submission
            else None,
        ),
        rehab_status=common.get_rehab_status(patient),
        latest_visit=common.visit_to_out(last_visit) if last_visit else None,
        current_plan=common.plan_to_card(active_plan) if active_plan else None,
    )


def list_patient_visits(db: Session, patient_id: int) -> list[VisitOut]:
    patient = common.get_patient_or_404(db, patient_id)
    visits = sorted(
        [v for v in patient.visits if v.status == "COMPLETED"],
        key=lambda v: (v.visit_date, v.id),
        reverse=True,
    )
    return [common.visit_to_out(v) for v in visits]


def create_visit(db: Session, patient_id: int, doctor: User, data: VisitCreate) -> Visit:
    patient = common.get_patient_or_404(db, patient_id)
    has_completed_visit = any(v.status == "COMPLETED" for v in patient.visits)

    today = date.today()
    # 若今日已有此病患的候診/看診中掛號，直接完成該筆；否則新增一筆
    visit = (
        db.query(Visit)
        .filter(
            Visit.patient_id == patient.id,
            Visit.visit_date == today,
            Visit.status.in_(["WAITING", "IN_CONSULTATION"]),
        )
        .first()
    )
    if visit is None:
        visit = Visit(
            patient_id=patient.id,
            doctor_id=doctor.id,
            visit_date=today,
            visit_type="FOLLOW_UP" if has_completed_visit else "FIRST",
        )
        db.add(visit)

    visit.doctor_id = doctor.id
    visit.status = "COMPLETED"
    visit.chief_complaint = data.chief_complaint
    visit.diagnosis = data.diagnosis
    visit.assessment = data.assessment
    visit.rehab_decision = data.rehab_decision
    visit.follow_up_date = data.follow_up_date

    active_plan = common.get_active_plan(patient)
    if data.rehab_decision == "END_PLAN" and active_plan:
        active_plan.status = "CLOSED"

    db.commit()
    db.refresh(visit)
    return visit


def _plan_to_list_item(plan: RehabPlan) -> PlanListItem:
    return PlanListItem(
        id=plan.id,
        patient_id=plan.patient_id,
        patient_name=plan.patient.name,
        patient_number=plan.patient.patient_number,
        name=plan.name,
        status=plan.status,
        start_date=plan.start_date,
        evaluation_date=plan.evaluation_date,
        nurse_name=plan.nurse.name if plan.nurse else None,
    )


def get_plan_summary(db: Session) -> PlanListSummary:
    today = date.today()
    plans = db.query(RehabPlan).all()
    ending_soon = sum(
        1
        for p in plans
        if p.status in common.ACTIVE_PLAN_STATUSES
        and p.evaluation_date
        and today <= p.evaluation_date <= today + timedelta(days=7)
    )
    return PlanListSummary(
        ongoing=sum(1 for p in plans if p.status == "ONGOING"),
        pending_evaluation=sum(1 for p in plans if p.status == "PENDING_EVALUATION"),
        ending_soon=ending_soon,
        closed=sum(1 for p in plans if p.status in ("CLOSED", "COMPLETED")),
    )


def list_plans(
    db: Session, search: str | None = None, status: str | None = None
) -> list[PlanListItem]:
    query = db.query(RehabPlan).join(Patient)
    if search:
        like = f"%{search}%"
        query = query.filter((Patient.name.like(like)) | (RehabPlan.name.like(like)))
    if status == "ACTIVE" or status is None:
        query = query.filter(RehabPlan.status.in_(common.ACTIVE_PLAN_STATUSES))
    elif status != "ALL":
        query = query.filter(RehabPlan.status == status)
    plans = query.order_by(RehabPlan.evaluation_date.is_(None), RehabPlan.evaluation_date).all()
    return [_plan_to_list_item(p) for p in plans]


def get_plan_or_404(db: Session, plan_id: int) -> RehabPlan:
    plan = db.get(RehabPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="復健計畫不存在")
    return plan


def get_plan_detail(db: Session, plan_id: int) -> PlanDetailOut:
    plan = get_plan_or_404(db, plan_id)
    current = plan.current_version
    versions = sorted(plan.versions, key=lambda v: v.version, reverse=True)
    last_adjusted = max((v.started_at for v in plan.versions), default=None)
    return PlanDetailOut(
        id=plan.id,
        name=plan.name,
        status=plan.status,
        patient_id=plan.patient_id,
        patient_name=plan.patient.name,
        patient_number=plan.patient.patient_number,
        doctor_name=plan.doctor.name,
        nurse_name=plan.nurse.name if plan.nurse else None,
        start_date=plan.start_date,
        evaluation_date=plan.evaluation_date,
        current_version=common.version_to_out(current) if current else None,
        versions=[common.version_to_out(v) for v in versions],
        last_adjusted_at=last_adjusted if last_adjusted != plan.start_date else None,
    )


def create_plan(db: Session, patient_id: int, doctor: User, data: PlanCreate) -> RehabPlan:
    patient = common.get_patient_or_404(db, patient_id)
    if common.get_active_plan(patient):
        raise HTTPException(status_code=400, detail="病患已有進行中的復健計畫")

    plan = RehabPlan(
        patient_id=patient.id,
        doctor_id=doctor.id,
        nurse_id=data.nurse_id,
        name=data.name,
        status="ONGOING",
        start_date=data.start_date,
        evaluation_date=data.evaluation_date,
    )
    db.add(plan)
    db.flush()

    version = PlanVersion(
        plan_id=plan.id, version=1, goals=data.goals, started_at=data.start_date
    )
    db.add(version)
    db.flush()
    for item in data.items:
        db.add(PlanItem(version_id=version.id, **item.model_dump()))

    db.commit()
    db.refresh(plan)
    return plan


def adjust_plan(db: Session, plan_id: int, data: PlanAdjust) -> RehabPlan:
    plan = get_plan_or_404(db, plan_id)
    if plan.status not in common.ACTIVE_PLAN_STATUSES:
        raise HTTPException(status_code=400, detail="只能調整有效中的計畫")

    today = date.today()
    current = plan.current_version
    if current:
        current.is_current = False
        current.ended_at = today

    new_version = PlanVersion(
        plan_id=plan.id,
        version=(current.version + 1) if current else 1,
        goals=data.goals,
        change_summary=data.change_summary,
        started_at=today,
    )
    db.add(new_version)
    db.flush()
    # 導師影片沿用（萃取/標註產物跨版本重用，不需重算）：
    # 前端顯式帶 teacher_video_id 時以它為準（動作改名不斷綁），
    # 沒帶時 fallback 到前一版同名動作的綁定
    prev_items = current.items if current else []
    prev_teacher_videos = {
        i.name: i.teacher_video_id for i in prev_items if i.teacher_video_id
    }
    prev_video_ids = {i.teacher_video_id for i in prev_items if i.teacher_video_id}
    for item in data.items:
        payload = item.model_dump()
        if payload.get("teacher_video_id") is None:
            payload["teacher_video_id"] = prev_teacher_videos.get(item.name)
        elif payload["teacher_video_id"] not in prev_video_ids:
            # 前一版沿用的綁定不重驗（避免舊資料狀態異動擋住調整），新綁定才驗證
            common.get_selectable_teacher_video(db, payload["teacher_video_id"])
        db.add(PlanItem(version_id=new_version.id, **payload))

    plan.status = "ONGOING"
    if data.evaluation_date:
        plan.evaluation_date = data.evaluation_date

    db.commit()
    db.refresh(plan)
    return plan


def close_plan(db: Session, plan_id: int) -> RehabPlan:
    plan = get_plan_or_404(db, plan_id)
    if plan.status not in common.ACTIVE_PLAN_STATUSES:
        raise HTTPException(status_code=400, detail="計畫已結束")
    plan.status = "CLOSED"
    current = plan.current_version
    if current:
        current.ended_at = date.today()
    db.commit()
    db.refresh(plan)
    return plan


def list_nurses(db: Session) -> list[NurseOption]:
    nurses = db.query(User).filter(User.role == "nurse").order_by(User.id).all()
    return [NurseOption(id=n.id, name=n.name) for n in nurses]


def list_reports(db: Session, doctor: User, status: str | None = None) -> list:
    query = (
        db.query(NurseReport)
        .join(RehabPlan, NurseReport.plan_id == RehabPlan.id)
        .filter(RehabPlan.doctor_id == doctor.id)
    )
    if status and status != "ALL":
        query = query.filter(NurseReport.status == status)
    reports = query.order_by(NurseReport.created_at.desc()).all()
    return [common.report_to_out(r) for r in reports]


def review_report(db: Session, report_id: int, data: DoctorReportReview) -> None:
    report = db.get(NurseReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="回報不存在")
    report.status = "REVIEWED"
    report.doctor_comment = data.doctor_comment
    db.commit()


def get_plan_submissions(db: Session, plan_id: int) -> dict:
    """計畫詳細頁的上傳審核紀錄與雙趨勢。"""
    plan = get_plan_or_404(db, plan_id)
    subs = common.plan_submissions(db, plan_id)
    return {
        "submissions": [
            common.submission_to_list_item(s, subs).model_dump(mode="json")
            for s in reversed(subs)
        ],
        "score_trend": [p.model_dump(mode="json") for p in common.score_trend(subs)],
        "completion_trend": [
            p.model_dump(mode="json") for p in common.completion_trend(plan, subs)
        ],
    }
