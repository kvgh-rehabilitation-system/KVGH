from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class TeacherVideoFolder(Base):
    """導師影片庫的資料夾（跨護理師共享的扁平分類，無巢狀）。"""

    __tablename__ = "teacher_video_folders"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class TeacherVideo(Base):
    """導師（範例）影片：護理師上傳，經轉檔、2D/3D 萃取後供病患影片比對使用。

    獨立於 plan_items 成表：plan 改版 clone item 時 FK 一併帶走，
    同一支導師影片的萃取/標註產物即可跨版本重用，不需重算。
    檔案存於 media/teacher_videos/{id}/，正式檔名為 t{id}.mp4（charactor 名）。
    """

    __tablename__ = "teacher_videos"

    id: Mapped[int] = mapped_column(primary_key=True)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    # 所屬資料夾；NULL = 未分類。刪除資料夾時影片移回未分類（service 層處理）
    folder_id: Mapped[int | None] = mapped_column(
        ForeignKey("teacher_video_folders.id"), nullable=True, index=True
    )
    # 醫護人員上傳時自訂的影片名稱（影片庫顯示用；fallback original_filename）
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # 相對於 MEDIA_ROOT 的路徑；轉檔完成後指向 teacher_videos/{id}/t{id}.mp4
    video_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    fps: Mapped[float | None] = mapped_column(Float, nullable=True)
    frame_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # PENDING | TRANSCODING | EXTRACTING | EXTRACTED | FAILED
    extraction_status: Mapped[str] = mapped_column(
        String(30), default="PENDING", index=True
    )
    extraction_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # UNANNOTATED | ANNOTATING | ANNOTATED
    annotation_status: Mapped[str] = mapped_column(String(30), default="UNANNOTATED")
    # 護理師標註的重點動作幀（遞增的 frame index 清單）
    annotation_frames: Mapped[list | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    uploader = relationship("User")
