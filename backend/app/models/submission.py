from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class VideoSubmission(Base):
    """病患針對某復健動作上傳的居家復健影片，以及其分析與審核狀態。

    兩條狀態軸刻意分開：
    - status（業務流）：ANALYZING → PENDING_REVIEW → REVIEWED，驅動護理師佇列
    - analysis_status（演算法管線）：PENDING → TRANSCODING → EXTRACTING →
      COMPARING → DONE|FAILED，由 worker 逐步更新，驅動進度顯示與重試
    合併成一軸會讓「分析失敗但仍需人工處理」這類狀態無法表達。

    plan_id/plan_version_id/plan_item_id 三層 FK 同時保留：查詢常用 plan_id，
    歷史對照用 version/item（見 PlanVersion docstring 的快照設計）。
    """

    __tablename__ = "video_submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("rehab_plans.id"), index=True)
    plan_version_id: Mapped[int] = mapped_column(ForeignKey("plan_versions.id"))
    plan_item_id: Mapped[int] = mapped_column(ForeignKey("plan_items.id"))
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    video_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # ANALYZING | PENDING_REVIEW | REVIEWED
    status: Mapped[str] = mapped_column(String(30), default="ANALYZING", index=True)

    # 相對於 MEDIA_ROOT；轉檔完成後指向 submissions/{id}/s{id}.mp4
    video_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # 比對用的導師影片快照（上傳當下 plan item 綁定的導師影片）
    teacher_video_id: Mapped[int | None] = mapped_column(
        ForeignKey("teacher_videos.id"), nullable=True
    )
    # PENDING | TRANSCODING | EXTRACTING | COMPARING | DONE | FAILED
    analysis_status: Mapped[str] = mapped_column(String(30), default="PENDING", index=True)
    analysis_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    celery_task_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # 護理師審核（一對一，直接放同表）
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # APPROVED | NEEDS_ATTENTION
    decision: Mapped[str | None] = mapped_column(String(30), nullable=True)
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 關聯：analysis 一對一（uselist=False）；reports 為護理師針對此上傳的回報
    plan = relationship("RehabPlan")
    plan_version = relationship("PlanVersion")
    plan_item = relationship("PlanItem")
    patient = relationship("Patient")
    reviewer = relationship("User")
    analysis = relationship("AnalysisResult", back_populates="submission", uselist=False)
    reports = relationship("NurseReport", back_populates="submission")


class AnalysisResult(Base):
    """演算法分析結果（每 submission 一筆，unique FK）。

    worker 比對完成時寫入；seed --demo 也會造假資料列（但磁碟無對應檔案）。
    metrics 是 JSON 直通欄位：joint_deviations、motion_sequence，
    以及未來 LLM 報告的 ai_report 都塞這裡，加欄免 migration（無 Alembic）。
    summary_text 是演算法的規則式輸出，不是護理師評語（那在 VideoSubmission.feedback）。
    """

    __tablename__ = "analysis_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("video_submissions.id"), unique=True, index=True
    )
    analyzed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    overall_score: Mapped[float] = mapped_column(Float)  # 0-100
    joint_angle_score: Mapped[float] = mapped_column(Float)
    stability_score: Mapped[float] = mapped_column(Float)
    posture_score: Mapped[float] = mapped_column(Float)
    # 細項：joint_deviations（各關節角度偏差）+ motion_sequence（關節角度時間序列，驅動 3D 重播）
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    summary_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    submission = relationship("VideoSubmission", back_populates="analysis")


class NurseReport(Base):
    """護理師回報醫生：狀況回報 / 計畫調整建議 / 異常。"""

    __tablename__ = "nurse_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("rehab_plans.id"), index=True)
    submission_id: Mapped[int | None] = mapped_column(
        ForeignKey("video_submissions.id"), nullable=True
    )
    nurse_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    # STATUS_REPORT | ADJUSTMENT_SUGGESTION | ABNORMALITY
    kind: Mapped[str] = mapped_column(String(30), default="STATUS_REPORT")
    severity: Mapped[str] = mapped_column(
        String(20), default="NORMAL"
    )  # NORMAL | PRIORITY | URGENT
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    # PENDING_DOCTOR_REVIEW | REVIEWED
    status: Mapped[str] = mapped_column(String(30), default="PENDING_DOCTOR_REVIEW", index=True)
    doctor_comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    plan = relationship("RehabPlan")
    submission = relationship("VideoSubmission", back_populates="reports")
    nurse = relationship("User")
