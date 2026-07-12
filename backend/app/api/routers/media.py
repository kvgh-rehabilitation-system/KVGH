"""影片串流端點（HTTP Range，206 邊播邊緩衝）。

認證支援 Bearer header 或 ?token= query（<video> 標籤無法帶 header）。
權限：導師影片任何登入者可看（病患要看範例）；病患影片限本人與醫護。
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import get_user_flexible
from app.db.session import get_db
from app.models.patient import Patient
from app.models.submission import VideoSubmission
from app.models.teacher_video import TeacherVideo
from app.models.user import User
from app.services import media_service

router = APIRouter(prefix="/api/media", tags=["media"])


@router.get("/teacher-videos/{teacher_video_id}/video")
def stream_teacher_video(
    teacher_video_id: int,
    request: Request,
    user: User = Depends(get_user_flexible),
    db: Session = Depends(get_db),
):
    tv = db.get(TeacherVideo, teacher_video_id)
    if not tv:
        raise HTTPException(status_code=404, detail="導師影片不存在")
    return media_service.stream_video(request, tv.video_path)


def _get_viewable_submission(
    db: Session, user: User, submission_id: int
) -> VideoSubmission:
    sub = db.get(VideoSubmission, submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="上傳紀錄不存在")
    if user.role == "patient":
        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        if not patient or sub.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="沒有存取此影片的權限")
    return sub


@router.get("/submissions/{submission_id}/video")
def stream_submission_video(
    submission_id: int,
    request: Request,
    user: User = Depends(get_user_flexible),
    db: Session = Depends(get_db),
):
    sub = _get_viewable_submission(db, user, submission_id)
    return media_service.stream_video(request, sub.video_path)


@router.get("/teacher-videos/{teacher_video_id}/pose3d")
def get_teacher_pose3d(
    teacher_video_id: int,
    user: User = Depends(get_user_flexible),
    db: Session = Depends(get_db),
):
    """導師 3D 骨架 .npy（MotionBERT，幀×17×3 float32）。預留給導師動作對照。"""
    tv = db.get(TeacherVideo, teacher_video_id)
    if not tv:
        raise HTTPException(status_code=404, detail="導師影片不存在")
    rel = f"teacher_videos/{tv.id}/motionbert/t{tv.id}.npy"
    return media_service.send_file(rel)


@router.get("/submissions/{submission_id}/pose3d")
def get_submission_pose3d(
    submission_id: int,
    user: User = Depends(get_user_flexible),
    db: Session = Depends(get_db),
):
    """病患 3D 骨架 .npy（MotionBERT，幀×17×3 float32），驅動前端素體重播。"""
    sub = _get_viewable_submission(db, user, submission_id)
    rel = f"submissions/{sub.id}/motionbert/s{sub.id}.npy"
    return media_service.send_file(rel)


@router.get("/submissions/{submission_id}/analysis-video")
def stream_analysis_video(
    submission_id: int,
    request: Request,
    variant: str = "full",
    user: User = Depends(get_user_flexible),
    db: Session = Depends(get_db),
):
    """演算法輸出的比對視覺化影片（variant=full|plain）。"""
    sub = _get_viewable_submission(db, user, submission_id)
    if sub.analysis_status != "DONE":
        raise HTTPException(status_code=404, detail="分析尚未完成")
    filename = "output_plain.mp4" if variant == "plain" else "output.mp4"
    rel = f"results/{sub.id}/{filename}"
    return media_service.stream_video(request, rel)
