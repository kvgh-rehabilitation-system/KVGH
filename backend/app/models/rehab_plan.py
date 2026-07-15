from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class RehabPlan(Base):
    """復健計畫主檔（醫生開立、指派護理師追蹤）。

    內容（目標/動作項目）不放這裡而放 PlanVersion：醫生每次「調整計畫」
    產生新版本，舊版本保留成歷史，回顧時才能看到當時的處方內容。
    """

    __tablename__ = "rehab_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    nurse_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(100))
    # ONGOING | PENDING_EVALUATION | COMPLETED | CLOSED | CANCELLED
    status: Mapped[str] = mapped_column(String(30), default="ONGOING", index=True)
    start_date: Mapped[date] = mapped_column(Date)
    evaluation_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_from_visit_id: Mapped[int | None] = mapped_column(ForeignKey("visits.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    patient = relationship("Patient", back_populates="plans")
    doctor = relationship("User", foreign_keys=[doctor_id])
    nurse = relationship("User", foreign_keys=[nurse_id])
    versions = relationship(
        "PlanVersion", back_populates="plan", order_by="PlanVersion.version"
    )

    @property
    def current_version(self) -> "PlanVersion | None":
        return next((v for v in self.versions if v.is_current), None)


class PlanVersion(Base):
    """計畫的一個版本快照（目標 + 動作項目）。

    調整計畫時舊版 is_current=False、ended_at 填今日，新版依請求 payload
    重建 items（導師影片綁定自動沿用前版，見 doctor_service.adjust_plan）；
    submissions 記的是 plan_version_id/plan_item_id，因此舊影片永遠對得回
    「上傳當時」的處方，不會被之後的調整改寫。
    """

    __tablename__ = "plan_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("rehab_plans.id"), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    goals: Mapped[list] = mapped_column(JSON, default=list)
    change_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[date] = mapped_column(Date)
    ended_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True)

    plan = relationship("RehabPlan", back_populates="versions")
    items = relationship("PlanItem", back_populates="version", order_by="PlanItem.id")


class PlanItem(Base):
    """復健動作項目。由負責護理師制定與維護（醫生建計畫時可選填初始項目）。"""

    __tablename__ = "plan_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    version_id: Mapped[int] = mapped_column(ForeignKey("plan_versions.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    frequency: Mapped[str | None] = mapped_column(String(100), nullable=True)
    times_per_week: Mapped[int] = mapped_column(Integer, default=3)  # 完成率分母
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    precaution: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 範例影片說明（URL 欄位保留相容，實際影片改由 teacher_video 承載）
    example_video_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    example_video_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 導師影片：plan 改版 clone item 時 FK 帶走，萃取/標註產物跨版本重用
    teacher_video_id: Mapped[int | None] = mapped_column(
        ForeignKey("teacher_videos.id"), nullable=True
    )

    version = relationship("PlanVersion", back_populates="items")
    teacher_video = relationship("TeacherVideo")
