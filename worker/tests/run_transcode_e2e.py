"""transcode 任務端到端驗證（CI 快測：cpu 佇列，不碰 GPU/權重）。

在 kvgh-ci stack 的 worker image 一次性容器內執行（需 rabbitmq + postgres +
消化 cpu 佇列的 worker-cpu 已啟動；media 為 stack 共用 volume）：

    docker compose -p kvgh-ci -f docker-compose.yml -f ci/compose.ci.yml \
      run --rm --no-deps -v "$PWD/worker/tests:/app/worker/tests:ro" \
      --entrypoint "python /app/worker/tests/run_transcode_e2e.py" worker-cpu

驗證 broker → worker → ffmpeg → media volume → DB 全鏈路（worker-integration
的 ping/registered 只到「任務有註冊」，這裡真的執行一次）：
  1. 成功路徑：ffmpeg 產 1 秒測試影片放 upload.*，以 backend 的
     enqueue_teacher_pipeline 發送（與正式上傳同一條發送路徑；chain 後段的
     extract_pose 進 gpu 佇列無人消化，僅驗 transcode 段）→ 輪詢斷言
     t{id}.mp4 產物出現、DB 回填 video_path/fps/frame_count
  2. 失敗路徑：塞垃圾 bytes → 斷言 _fail 把 FAILED + 錯誤明細寫進 DB

自我完備：自建資料表（create_all，冪等）與 uploader 使用者列，
不依賴 backend image 或 seed。
"""

import subprocess
import sys
import time
import uuid

POLL_TIMEOUT = 90  # 秒；1 秒小影片轉檔本身秒級，餘裕留給佇列與 worker 熱身
POLL_INTERVAL = 2


def _make_uploader() -> int:
    from app.db.base import Base
    from app.models.user import User
    from worker.db import engine, session_scope

    Base.metadata.create_all(bind=engine)  # 全新 CI DB 無 backend 先起，自建表
    with session_scope() as s:
        u = User(
            username=f"e2e-{uuid.uuid4().hex[:8]}",
            password_hash="!",  # 不登入，僅滿足 NOT NULL
            role="nurse",
            name="transcode e2e",
        )
        s.add(u)
        s.flush()
        return u.id


def _make_teacher_row(uploader_id: int) -> int:
    from worker.db import TeacherVideo, session_scope

    with session_scope() as s:
        tv = TeacherVideo(uploaded_by=uploader_id, name="transcode e2e")
        s.add(tv)
        s.flush()
        return tv.id


def _poll(predicate, what: str):
    deadline = time.monotonic() + POLL_TIMEOUT
    while time.monotonic() < deadline:
        result = predicate()
        if result is not None:
            return result
        time.sleep(POLL_INTERVAL)
    print(f"FAIL: {POLL_TIMEOUT} 秒內未等到 {what}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    from app.services import task_queue
    from worker.db import TeacherVideo, session_scope
    from worker.pipeline import paths

    uploader_id = _make_uploader()

    # ---- 成功路徑 ----
    tid = _make_teacher_row(uploader_id)
    src = paths.entity_dir("teacher", tid) / "upload.mp4"
    src.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "testsrc=duration=1:size=192x144:rate=30",
            "-pix_fmt",
            "yuv420p",
            str(src),
        ],
        check=True,
    )
    task_queue.enqueue_teacher_pipeline(tid)  # 與正式上傳同一條發送路徑
    print(f"已發送 teacher #{tid} 管線，等待 transcode 完成 ...")

    def _done():
        # session 內取純值回傳（ORM 物件出 scope 即 detached）
        with session_scope() as s:
            tv = s.get(TeacherVideo, tid)
            if tv.extraction_status == "FAILED":
                print(f"FAIL: transcode 意外失敗: {tv.extraction_error}", file=sys.stderr)
                sys.exit(1)
            return (tv.video_path, tv.fps, tv.frame_count) if tv.video_path else None

    video_path, fps, frame_count = _poll(_done, "video_path 回填")
    dest = paths.canonical_video("teacher", tid)
    assert dest.is_file(), f"FAIL: 正式影片未產出: {dest}"
    assert video_path == paths.rel_to_media(dest), f"FAIL: video_path 不符: {video_path}"
    assert fps and fps > 0, f"FAIL: fps 未回填: {fps}"
    assert frame_count and frame_count > 0, f"FAIL: frame_count 未回填: {frame_count}"
    print(f"  ✓ 成功路徑：t{tid}.mp4 產出、DB 回填 fps={fps} frames={frame_count}")

    # ---- 失敗路徑 ----
    tid2 = _make_teacher_row(uploader_id)
    bad = paths.entity_dir("teacher", tid2) / "upload.bin"
    bad.parent.mkdir(parents=True, exist_ok=True)
    bad.write_bytes(b"this is not a video" * 64)
    task_queue.celery_client.send_task(
        task_queue.TASK_TRANSCODE, args=("teacher", tid2), queue="cpu"
    )
    print(f"已發送 teacher #{tid2}（垃圾檔），等待 FAILED 落 DB ...")

    def _failed():
        with session_scope() as s:
            tv2 = s.get(TeacherVideo, tid2)
            return (tv2.extraction_error or "") if tv2.extraction_status == "FAILED" else None

    error = _poll(_failed, "FAILED 狀態")
    assert error, "FAIL: FAILED 但 extraction_error 為空"
    print(f"  ✓ 失敗路徑：FAILED + 錯誤明細落 DB（{error[:40]}…）")

    print("OK: transcode 任務端到端（成功 + 失敗路徑）全部通過")


if __name__ == "__main__":
    main()
