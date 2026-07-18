from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class Visit(Base):
    """門診看診紀錄。rehab_decision 記錄醫生的復健決策；
    後端只有 END_PLAN 會連動（關閉進行中計畫，見 doctor_service.create_visit），
    CREATE_PLAN/ADJUST_PLAN 的實際操作由前端導向計畫表單另行呼叫計畫端點。"""

    __tablename__ = "visits"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    visit_date: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[str] = mapped_column(
        String(30), default="COMPLETED"
    )  # WAITING | IN_CONSULTATION | COMPLETED
    visit_type: Mapped[str] = mapped_column(String(20), default="FIRST")  # FIRST | FOLLOW_UP
    chief_complaint: Mapped[str | None] = mapped_column(Text, nullable=True)
    diagnosis: Mapped[str | None] = mapped_column(Text, nullable=True)
    assessment: Mapped[str | None] = mapped_column(Text, nullable=True)
    # NO_REHAB | CREATE_PLAN | CONTINUE_PLAN | ADJUST_PLAN | END_PLAN
    rehab_decision: Mapped[str | None] = mapped_column(String(30), nullable=True)
    follow_up_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # 關聯：所屬病患與看診醫生
    patient = relationship("Patient", back_populates="visits")
    doctor = relationship("User")
