from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20))  # doctor | nurse | patient
    name: Mapped[str] = mapped_column(String(50))
    title: Mapped[str | None] = mapped_column(String(50), nullable=True)  # 職稱，如「主治醫師」
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
