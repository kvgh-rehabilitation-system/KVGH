"""Celery 任務：transcode → extract_pose →（病患）run_comparison；save_annotation。

冪等設計（acks_late 重派安全）：
  - transcode：正式 mp4 已存在則短路
  - extract_pose：npy/mp4 artifact 已存在則短路（導師影片只萃取一次）
  - run_comparison：重跑會覆蓋 results/，無副作用

防 OOM：extract_pose 進場先查剩餘 VRAM，不足延後重試；
subprocess 以 CUDA OOM 失敗也視為暫時性錯誤重試，不會拖垮系統。
"""

from datetime import datetime

from celery.utils.log import get_task_logger

from worker import config
from worker.celery_app import app
from worker.db import AnalysisResult, TeacherVideo, VideoSubmission, session_scope
from worker.pipeline import annotate, compare, extract, gpu_guard, paths, transcode

logger = get_task_logger(__name__)

# VRAM 不足時的重試（每 60 秒看一次，最多等 1 小時後放棄）
VRAM_RETRY_COUNTDOWN = 60
VRAM_MAX_RETRIES = 60
# CUDA OOM 的重試（backoff）
OOM_RETRY_COUNTDOWN = 120
OOM_MAX_RETRIES = 5

_MODEL = {"teacher": TeacherVideo, "submission": VideoSubmission}
_STATUS_FIELD = {"teacher": "extraction_status", "submission": "analysis_status"}
_ERROR_FIELD = {"teacher": "extraction_error", "submission": "analysis_error"}


def _update(kind: str, entity_id: int, **fields) -> None:
    """對 teacher/submission 列做欄位更新（獨立短交易，寫完即 commit）。"""
    with session_scope() as s:
        obj = s.get(_MODEL[kind], entity_id)
        # 實體被刪（如病患撤回上傳）就讓任務炸掉，不要對空氣寫狀態
        if obj is None:
            raise RuntimeError(f"{kind} #{entity_id} 不存在（可能已被使用者刪除）")
        for key, value in fields.items():
            setattr(obj, key, value)


def _set_status(kind: str, entity_id: int, status: str, error: str | None = None) -> None:
    """更新管線狀態欄（teacher→extraction_status、submission→analysis_status）。"""
    _update(
        kind,
        entity_id,
        **{_STATUS_FIELD[kind]: status, _ERROR_FIELD[kind]: error},
    )


def _fail(kind: str, entity_id: int, message: str, stderr: str = "") -> None:
    """標記 FAILED 並記錄錯誤明細（截 4000 字防塞爆 Text 欄與前端）。"""
    detail = f"{message}\n{stderr}".strip() if stderr else message
    logger.error("%s #%s FAILED: %s", kind, entity_id, detail)
    _set_status(kind, entity_id, "FAILED", detail[:4000])


@app.task(name="worker.tasks.transcode", bind=True, queue="cpu")
def transcode_task(self, kind: str, entity_id: int):
    """任意上傳格式 → faststart mp4（h264 來源秒級 remux）。"""
    dest = paths.canonical_video(kind, entity_id)
    try:
        if dest.is_file():  # 重派/重新分析時短路
            fps, frame_count = transcode.video_meta(dest)
        else:
            _set_status(kind, entity_id, "TRANSCODING")
            uploads = sorted(paths.entity_dir(kind, entity_id).glob("upload.*"))
            if not uploads:
                raise transcode.TranscodeError("找不到原始上傳檔")
            fps, frame_count = transcode.transcode_to_mp4(uploads[0], dest)
            uploads[0].unlink(missing_ok=True)  # 永久保留正式 mp4，原始檔移除

        fields = {"video_path": paths.rel_to_media(dest)}
        if kind == "teacher":  # 標註頁的逐幀步進需要 fps/frame_count
            fields.update(fps=round(fps, 3), frame_count=frame_count)
        _update(kind, entity_id, **fields)
        logger.info(
            "%s #%s 轉檔完成: %s (fps=%.2f, frames=%d)", kind, entity_id, dest, fps, frame_count
        )
        return entity_id
    except transcode.TranscodeError as exc:
        _fail(kind, entity_id, str(exc))
        raise


@app.task(name="worker.tasks.extract_pose", bind=True, queue="gpu")
def extract_pose(self, kind: str, entity_id: int):
    """2D/3D 姿態萃取（GPU）。artifact 已存在則短路重用。"""
    try:
        if extract.artifacts_exist(kind, entity_id):
            logger.info("%s #%s 已有萃取產物，短路重用", kind, entity_id)
            if kind == "teacher":
                _set_status(kind, entity_id, "EXTRACTED")
            return entity_id

        # 防 OOM 守門：GPU 可能被其他程式佔用，不足就延後
        try:
            gpu_guard.ensure_vram(config.GPU_MIN_FREE_VRAM_MB)
        except gpu_guard.InsufficientVram as exc:
            logger.warning("%s #%s %s（%d 秒後重試）", kind, entity_id, exc, VRAM_RETRY_COUNTDOWN)
            raise self.retry(
                exc=exc, countdown=VRAM_RETRY_COUNTDOWN, max_retries=VRAM_MAX_RETRIES
            ) from exc

        _set_status(kind, entity_id, "EXTRACTING")
        extract.run_extraction(kind, entity_id)
        if kind == "teacher":
            _set_status(kind, entity_id, "EXTRACTED")
        logger.info("%s #%s 2D/3D 萃取完成", kind, entity_id)
        return entity_id
    except extract.ExtractionError as exc:
        if gpu_guard.is_cuda_oom(exc.stderr):
            logger.warning("%s #%s CUDA OOM，%d 秒後重試", kind, entity_id, OOM_RETRY_COUNTDOWN)
            raise self.retry(
                exc=exc, countdown=OOM_RETRY_COUNTDOWN, max_retries=OOM_MAX_RETRIES
            ) from exc
        _fail(kind, entity_id, str(exc), exc.stderr)
        raise


@app.task(name="worker.tasks.run_comparison", bind=True, queue="cpu")
def run_comparison(self, submission_id: int, teacher_video_id: int):
    """humanpose 比對 + 寫入 AnalysisResult（儀表板真分數）。"""
    try:
        _set_status("submission", submission_id, "COMPARING")
        analysis = compare.run_comparison(submission_id, teacher_video_id)

        # metrics.raw 記錄所有磁碟產物的相對路徑，讓 DB 列自帶產物索引
        metrics = analysis.get("metrics") or {}
        metrics["raw"] = {
            "results_dir": f"results/{submission_id}",
            "scores_json": f"results/{submission_id}/scores.json",
            "stair_json": f"results/{submission_id}/stair.json",
            "angles_json": f"results/{submission_id}/angles.json",
            "output_video": f"results/{submission_id}/output.mp4",
            "output_plain_video": f"results/{submission_id}/output_plain.mp4",
            "action_similarity": analysis.get("action_similarity"),
            "mentor": paths.teacher_name(teacher_video_id),
        }

        # 分析結果 upsert（重新分析時覆寫既有列，submission_id 唯一）
        with session_scope() as s:
            sub = s.get(VideoSubmission, submission_id)
            if sub is None:
                raise RuntimeError(f"submission #{submission_id} 不存在")
            result = (
                s.query(AnalysisResult)
                .filter(AnalysisResult.submission_id == submission_id)
                .first()
            )
            if result is None:
                result = AnalysisResult(submission_id=submission_id)
                s.add(result)
            result.analyzed_at = datetime.now()
            result.overall_score = float(analysis["overall_score"])
            result.joint_angle_score = float(analysis["joint_angle_score"])
            result.stability_score = float(analysis["stability_score"])
            result.posture_score = float(analysis["posture_score"])
            result.metrics = metrics
            result.summary_text = analysis.get("summary_text")
            sub.analysis_status = "DONE"
            sub.analysis_error = None
            sub.status = "PENDING_REVIEW"

        logger.info(
            "submission #%s 分析完成 overall=%.1f → PENDING_REVIEW",
            submission_id,
            float(analysis["overall_score"]),
        )
        return submission_id
    except compare.ComparisonError as exc:
        _fail("submission", submission_id, str(exc), exc.stderr)
        raise


@app.task(name="worker.tasks.save_annotation", bind=True, queue="cpu")
def save_annotation(self, teacher_video_id: int, frames: list[int]):
    """以 make_vid_json_api 產生演算法標註 JSON。"""
    try:
        rel = annotate.write_annotation(teacher_video_id, frames)
        _update("teacher", teacher_video_id, annotation_status="ANNOTATED")
        logger.info("teacher #%s 標註完成: %s", teacher_video_id, rel)
        return rel
    except annotate.AnnotationError as exc:
        # 失敗退回 UNANNOTATED 讓護理師可重標。
        # 錯誤訊息借放 extraction_error（模型沒有 annotation_error 欄位，免 migration）
        logger.error("teacher #%s 標註失敗: %s", teacher_video_id, exc)
        _update(
            "teacher",
            teacher_video_id,
            annotation_status="UNANNOTATED",
            extraction_error=f"標註失敗：{exc}",
        )
        raise
