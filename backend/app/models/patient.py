from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class Patient(Base):
    """病患病歷主檔，與 User（登入帳號）一對一。

    與 users 分表：臨床資料（病歷號、生日、性別）不該混進認證表，
    且 visits/plans 等臨床 FK 全部指向這裡而非 users。
    """

    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    patient_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(50))
    birth_date: Mapped[date] = mapped_column(Date)
    gender: Mapped[str] = mapped_column(String(10))  # MALE | FEMALE | OTHER
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # 關聯：登入帳號（一對一）、看診紀錄（新到舊）、復健計畫
    user = relationship("User")
    visits = relationship("Visit", back_populates="patient", order_by="desc(Visit.visit_date)")
    plans = relationship("RehabPlan", back_populates="patient")

    @property
    def age(self) -> int:
        """實歲。年差先算好，若今年生日還沒到，用 tuple 比較的布林值（0/1）扣 1。"""
        today = date.today()
        return (
            today.year
            - self.birth_date.year
            - ((today.month, today.day) < (self.birth_date.month, self.birth_date.day))
        )
