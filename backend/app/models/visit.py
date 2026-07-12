from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class Visit(Base):
    __tablename__ = "visits"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    visit_date: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[str] = mapped_column(String(30), default="COMPLETED")  # WAITING | IN_CONSULTATION | COMPLETED
    visit_type: Mapped[str] = mapped_column(String(20), default="FIRST")  # FIRST | FOLLOW_UP
    chief_complaint: Mapped[str | None] = mapped_column(Text, nullable=True)
    diagnosis: Mapped[str | None] = mapped_column(Text, nullable=True)
    assessment: Mapped[str | None] = mapped_column(Text, nullable=True)
    # NO_REHAB | CREATE_PLAN | CONTINUE_PLAN | ADJUST_PLAN | END_PLAN
    rehab_decision: Mapped[str | None] = mapped_column(String(30), nullable=True)
    follow_up_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    patient = relationship("Patient", back_populates="visits")
    doctor = relationship("User")
