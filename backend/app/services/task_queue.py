"""Celery 任務發送（backend 只發送、不執行）。

任務一律以名稱發送（send_task / by-name signature），backend 不 import
worker 程式碼——雙方唯一的契約是任務名稱與 JSON 參數（entity id）。

佇列分工：
  gpu — 2D/3D 姿態萃取（受 GPU_MAX_CONCURRENCY 與 VRAM 守門保護）
  cpu — 影片轉檔、humanpose 比對、標註存檔（不佔 GPU 名額）
"""

from celery import Celery, chain

from app.core.config import settings

celery_client = Celery("kvgh", broker=settings.CELERY_BROKER_URL)
celery_client.conf.task_default_queue = "cpu"

TASK_TRANSCODE = "worker.tasks.transcode"
TASK_EXTRACT = "worker.tasks.extract_pose"
TASK_COMPARE = "worker.tasks.run_comparison"
TASK_ANNOTATE = "worker.tasks.save_annotation"


def _sig(name: str, args: tuple, queue: str):
    return celery_client.signature(name, args=args, queue=queue, immutable=True)


def enqueue_teacher_pipeline(teacher_video_id: int) -> str:
    """導師影片：轉檔 → 2D/3D 萃取。"""
    result = chain(
        _sig(TASK_TRANSCODE, ("teacher", teacher_video_id), "cpu"),
        _sig(TASK_EXTRACT, ("teacher", teacher_video_id), "gpu"),
    ).apply_async()
    return result.id


def enqueue_submission_pipeline(submission_id: int, teacher_video_id: int) -> str:
    """病患影片：轉檔 → 2D/3D 萃取 → 與導師影片比對。"""
    result = chain(
        _sig(TASK_TRANSCODE, ("submission", submission_id), "cpu"),
        _sig(TASK_EXTRACT, ("submission", submission_id), "gpu"),
        _sig(TASK_COMPARE, (submission_id, teacher_video_id), "cpu"),
    ).apply_async()
    return result.id


def enqueue_annotation(teacher_video_id: int, frames: list[int]) -> str:
    result = celery_client.send_task(
        TASK_ANNOTATE, args=(teacher_video_id, frames), queue="cpu"
    )
    return result.id
