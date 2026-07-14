from datetime import datetime

from pydantic import BaseModel


class TeacherVideoFolderOut(BaseModel):
    id: int
    name: str
    video_count: int
    created_at: datetime


class TeacherVideoFolderIn(BaseModel):
    name: str


class TeacherVideoUpdate(BaseModel):
    """PATCH 導師影片：改名與/或移動資料夾。

    folder_id 用 model_fields_set 區分「未傳」（不動）與「明確 null」（移回未分類）。
    """

    name: str | None = None
    folder_id: int | None = None


class TeacherVideoOut(BaseModel):
    id: int
    name: str | None = None
    original_filename: str | None = None
    folder_id: int | None = None
    uploader_name: str | None = None
    fps: float | None = None
    frame_count: int | None = None
    extraction_status: str  # PENDING | TRANSCODING | EXTRACTING | EXTRACTED | FAILED
    extraction_error: str | None = None
    annotation_status: str  # UNANNOTATED | ANNOTATING | ANNOTATED
    annotation_frames: list[int] | None = None
    created_at: datetime


class AnnotationOut(BaseModel):
    teacher_video_id: int
    fps: float | None = None
    frame_count: int | None = None
    annotation_status: str
    frames: list[int]


class AnnotationSubmit(BaseModel):
    frames: list[int]  # 重點動作幀（遞增）


class SubmissionStatusOut(BaseModel):
    """病患端輪詢上傳影片的分析進度。"""

    id: int
    status: str  # ANALYZING | PENDING_REVIEW | REVIEWED
    analysis_status: str  # PENDING | TRANSCODING | EXTRACTING | COMPARING | DONE | FAILED
    display_status: str  # 統一顯示狀態（見 common.submission_display_status）
    analysis_error: str | None = None
    overall_score: float | None = None
