"""golden 全管線驗證（手動 CI job：真 GPU + 真權重，日常不跑）。

在 kvgh-ci stack 的 worker 一次性容器內執行（需 postgres + rabbitmq +
worker-cpu + worker-gpu 已啟動、demo seed 已跑）：

    docker compose -p kvgh-ci -f docker-compose.yml -f ci/compose.ci.yml \
      run --rm --no-deps -v "$PWD/worker/tests:/app/worker/tests:ro" \
      -v "${GOLDEN_MEDIA:-/data/KVGH/media}:/golden:ro" \
      --entrypoint "python /app/worker/tests/run_golden_pipeline.py" worker-cpu

golden 素材 = 磁碟保留的舊產物（根目錄 CLAUDE.md）：teacher_videos/2 的
完整萃取+標註產物、submissions/74 的病患原片。沿用原 id 顯式插列
（seed 序列跳到 teacher≥100/submission≥1000，2 與 74 保證空著），
產物原樣複製免改名——charactor 名（t2/s74）貫穿演算法所有下游檔名。

流程：導師產物就位（extract 短路重用）→ enqueue_submission_pipeline
→ 病患片走 transcode → extract_pose（GPU+權重）→ run_comparison
→ 斷言 6 檔產物齊全、四分數值域、狀態轉 PENDING_REVIEW。
"""

import shutil
import sys
import time
from pathlib import Path

GOLDEN = Path("/golden")
TID, SID = 2, 74
POLL_TIMEOUT = 45 * 60  # 全管線含 GPU 萃取，寬鬆給到 45 分鐘
POLL_INTERVAL = 15


def _require(path: Path) -> Path:
    if not path.exists():
        print(f"FAIL: golden 素材缺失: {path}（此機器沒有保留的舊產物？）", file=sys.stderr)
        sys.exit(1)
    return path


def _prepare_media() -> None:
    from worker import config

    # 導師：整個目錄複製（t2.mp4 + motionbert/ + alphapose/ + annotation/）
    src = _require(GOLDEN / "teacher_videos" / str(TID))
    for name in ("t2.mp4", "motionbert/t2.npy", "alphapose/t2.mp4", "annotation/t2.json"):
        _require(src / name)
    dest = config.MEDIA_ROOT / "teacher_videos" / str(TID)
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(src, dest)

    # 病患：只取原片當作新上傳（萃取與比對就是要重跑的部分）
    patient_src = _require(GOLDEN / "submissions" / str(SID) / f"s{SID}.mp4")
    sub_dir = config.MEDIA_ROOT / "submissions" / str(SID)
    if sub_dir.exists():
        shutil.rmtree(sub_dir)
    sub_dir.mkdir(parents=True)
    shutil.copy2(patient_src, sub_dir / "upload.mp4")


def _prepare_rows() -> None:
    from app.models.rehab_plan import PlanItem, PlanVersion, RehabPlan
    from app.models.user import User
    from worker.db import TeacherVideo, VideoSubmission, session_scope

    with session_scope() as s:
        nurse = s.query(User).filter(User.role == "nurse").first()
        assert nurse, "FAIL: 無 nurse 帳號（demo seed 未跑？）"
        # 掛在 demo seed 任一 ONGOING 計畫的動作下（submission 的三層 FK 需要）
        item = (
            s.query(PlanItem, PlanVersion, RehabPlan)
            .join(PlanVersion, PlanItem.plan_version_id == PlanVersion.id)
            .join(RehabPlan, PlanVersion.plan_id == RehabPlan.id)
            .filter(RehabPlan.status == "ONGOING")
            .first()
        )
        assert item, "FAIL: 無 ONGOING 計畫（demo seed 未跑？）"
        plan_item, version, plan = item

        if s.get(TeacherVideo, TID) is None:
            s.add(
                TeacherVideo(
                    id=TID,
                    uploaded_by=nurse.id,
                    name="golden 導師影片",
                    video_path=f"teacher_videos/{TID}/t{TID}.mp4",
                    extraction_status="EXTRACTED",
                    annotation_status="ANNOTATED",
                )
            )
        if s.get(VideoSubmission, SID) is None:
            s.add(
                VideoSubmission(
                    id=SID,
                    plan_id=plan.id,
                    plan_version_id=version.id,
                    plan_item_id=plan_item.id,
                    patient_id=plan.patient_id,
                    teacher_video_id=TID,
                    status="ANALYZING",
                    analysis_status="PENDING",
                )
            )


def main() -> None:
    from app.services import task_queue
    from worker import config
    from worker.db import AnalysisResult, VideoSubmission, session_scope

    _prepare_media()
    _prepare_rows()
    task_queue.enqueue_submission_pipeline(SID, TID)
    print(f"已發送 submission #{SID} 全管線（transcode → extract(GPU) → compare）...")

    last = None
    deadline = time.monotonic() + POLL_TIMEOUT
    while time.monotonic() < deadline:
        with session_scope() as s:
            sub = s.get(VideoSubmission, SID)
            status, err = sub.analysis_status, sub.analysis_error
        if status != last:
            print(f"  analysis_status → {status}")
            last = status
        if status == "FAILED":
            print(f"FAIL: 管線失敗: {err}", file=sys.stderr)
            sys.exit(1)
        if status == "DONE":
            break
        time.sleep(POLL_INTERVAL)
    else:
        print(f"FAIL: {POLL_TIMEOUT} 秒內未完成（卡在 {last}）", file=sys.stderr)
        sys.exit(1)

    # 產物契約：pipeline/compare.py 的 _collect 邊界 6 檔
    results = config.MEDIA_ROOT / "results" / str(SID)
    for name in (
        "analysis.json",
        "scores.json",
        "stair.json",
        "angles.json",
        "output.mp4",
        "output_plain.mp4",
    ):
        assert (results / name).is_file(), f"FAIL: 產物缺失: {results / name}"
    print("  ✓ 6 檔產物齊全")

    with session_scope() as s:
        sub = s.get(VideoSubmission, SID)
        result = s.query(AnalysisResult).filter(AnalysisResult.submission_id == SID).one()
        scores = {
            "overall": result.overall_score,
            "joint_angle": result.joint_angle_score,
            "stability": result.stability_score,
            "posture": result.posture_score,
        }
        assert sub.status == "PENDING_REVIEW", f"FAIL: status 應轉 PENDING_REVIEW: {sub.status}"
        for key, value in scores.items():
            assert value is not None and 0 < value <= 100, f"FAIL: {key} 分數值域異常: {value}"
    print(f"  ✓ 四分數值域正常: {scores}")
    print("OK: golden 全管線通過")


if __name__ == "__main__":
    main()
