from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class User(Base):
    """登入帳號（四角色共用一表，以 role 區分）。

    patient 角色另有一對一的 Patient 列存病歷資料；
    醫護（doctor/nurse/admin）只需要這張表。
    role 建立後禁改（admin_service 擋），避免 Patient 列變孤兒。
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20))  # admin | doctor | nurse | patient
    name: Mapped[str] = mapped_column(String(50))
    title: Mapped[str | None] = mapped_column(String(50), nullable=True)  # 職稱，如「主治醫師」
    # 停用 = 軟刪除：無法登入、admin 列表預設隱藏，關聯臨床資料保留
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
