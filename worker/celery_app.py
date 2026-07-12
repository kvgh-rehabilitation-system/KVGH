"""Celery worker 應用。

佇列：gpu（2D/3D 萃取）與 cpu（轉檔、比對、標註）。
GPU 佇列由 docker-compose 以 --autoscale=${GPU_MAX_CONCURRENCY},1 啟動：
無任務時常駐 1 個 process，任務進來依佇列量擴增，硬上限防 VRAM OOM。
"""

from celery import Celery

from worker import config

app = Celery("kvgh_worker", broker=config.CELERY_BROKER_URL)

app.conf.update(
    task_default_queue="cpu",
    task_acks_late=True,               # worker 中途死亡時任務重派（任務本身冪等）
    worker_prefetch_multiplier=1,      # GPU 任務不預抓，讓佇列長度真實反映負載
    task_reject_on_worker_lost=True,
    broker_connection_retry_on_startup=True,
    result_backend=None,               # 狀態直接寫 DB，不需要 result backend
    task_ignore_result=True,
)

app.autodiscover_tasks(["worker"])

from worker import tasks  # noqa: E402,F401  確保任務註冊
