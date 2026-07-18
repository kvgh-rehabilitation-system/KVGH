"""Worker 任務契約檢查(CI 快測,不跑 GPU 管線)。

在 kvgh-worker image 內執行,需掛載 ./algorithm:/algorithm
(worker/pipeline/annotate.py 在 import 期載入 make_vid_json_api)。
不需 GPU、權重、rabbitmq、postgres——import 期不建立任何連線。

    docker run --rm -v $PWD/algorithm:/algorithm \\
      -v $PWD/worker/tests:/app/worker/tests:ro \\
      kvgh-worker python /app/worker/tests/check_task_contract.py

驗兩件事:
  1. import worker.tasks 成功(= Celery app 設定 + 全 pipeline 模組可載入)
  2. backend task_queue 以字串名稱發送的每個任務,worker 都有註冊
     (兩端只以名稱耦合,改名/漏註冊不會在 build 期被抓到,只會上線後炸)
"""

import sys


def main() -> int:
    import worker.tasks  # noqa: F401  觸發任務註冊;import 本身即測試 1

    # image 內含 backend/app(共用 models),同一容器可驗契約兩端
    from app.services import task_queue
    from worker.celery_app import app as celery_app

    sent = {
        task_queue.TASK_TRANSCODE,
        task_queue.TASK_EXTRACT,
        task_queue.TASK_COMPARE,
        task_queue.TASK_ANNOTATE,
    }
    registered = set(celery_app.tasks)
    missing = sent - registered
    if missing:
        print(f"FAIL: backend 會發送但 worker 未註冊的任務: {sorted(missing)}")
        worker_tasks = sorted(t for t in registered if not t.startswith("celery."))
        print(f"worker 已註冊: {worker_tasks}")
        return 1
    print(f"OK: {len(sent)} 個任務名稱契約成立")
    return 0


if __name__ == "__main__":
    sys.exit(main())
