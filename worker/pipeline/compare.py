"""humanpose 比對：組裝工作目錄 → subprocess 執行 humanpose_api.py → 收取產物。

humanpose_api.py 以 CWD 相對路徑找檔案，故在 media/jobs/ 下建立獨立
工作目錄，symlink 既有 artifact（npy/影片皆已永久保存、萃取只跑一次）：

    json/{t}.json               ← 導師標註
    motionbert_output/{t,s}.npy ← 3D 骨架
    alphapose_output/{t,s}.mp4  ← 渲染用 2D 影片
    motionbert_output/{t,s}.mp4 ← 渲染用 3D 影片

輸出（analysis_json/scores_json/stair_json/angles_json/output_video/
output_4_video）搬至 media/results/{submission_id}/ 永久保存。
"""

import json
import shutil
import subprocess
import sys
import uuid
from pathlib import Path

from worker import config
from worker.pipeline import paths
from worker.pipeline.transcode import remux_faststart


class ComparisonError(RuntimeError):
    def __init__(self, message: str, stderr: str = ""):
        self.stderr = stderr
        super().__init__(message)


def _link(src: Path, dest: Path) -> None:
    if not src.is_file():
        raise ComparisonError(f"缺少必要的輸入檔: {src}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.symlink_to(src)


def run_comparison(submission_id: int, teacher_video_id: int) -> dict:
    """執行比對並回傳 analysis.json 內容（儀表板格式）。"""
    t = paths.teacher_name(teacher_video_id)
    s = paths.submission_name(submission_id)

    ws = paths.jobs_dir() / f"compare-{s}-{uuid.uuid4().hex[:8]}"
    ws.mkdir(parents=True, exist_ok=True)
    # humanpose_api 對 fig/、vid/ 等中間產物目錄以 CWD 相對路徑直接寫入
    # （原專案工作目錄既存），沒有 makedirs——需預先建立
    # output_video 也必須預建：cv2.VideoWriter 對不存在的目錄靜默失敗，
    # 會導致比對影片無聲消失
    for _d in ("fig", "vid", "output_video"):
        (ws / _d).mkdir(exist_ok=True)
    # 渲染用靜態素材（alpha/belta/cosine/AoL-based）也是 CWD 相對讀取
    (ws / "ppt").symlink_to(config.ALGORITHM_DIR / "assets" / "ppt")
    try:
        _link(paths.annotation_json(teacher_video_id), ws / "json" / f"{t}.json")
        for kind, entity_id, name in (
            ("teacher", teacher_video_id, t),
            ("submission", submission_id, s),
        ):
            _link(
                paths.motionbert_dir(kind, entity_id) / f"{name}.npy",
                ws / "motionbert_output" / f"{name}.npy",
            )
            _link(
                paths.alphapose_dir(kind, entity_id) / f"{name}.mp4",
                ws / "alphapose_output" / f"{name}.mp4",
            )
            _link(
                paths.motionbert_dir(kind, entity_id) / f"{name}.mp4",
                ws / "motionbert_output" / f"{name}.mp4",
            )

        cmd = [
            sys.executable,
            str(config.ALGORITHM_DIR / "humanpose_api.py"),
            "--charactor1", t,
            "--charactor", s,
        ]
        proc = subprocess.run(
            cmd,
            cwd=ws,
            capture_output=True,
            text=True,
            timeout=config.COMPARISON_TIMEOUT_SECONDS,
        )
        if proc.returncode != 0:
            raise ComparisonError(
                f"humanpose 比對失敗（exit {proc.returncode}）",
                stderr=proc.stderr[-2000:],
            )

        analysis_path = ws / "analysis_json" / f"{s}.json"
        if not analysis_path.is_file():
            raise ComparisonError("比對完成但缺少 analysis_json 輸出（humanpose_api 版本過舊？）")

        results = paths.results_dir(submission_id)
        results.mkdir(parents=True, exist_ok=True)
        _collect(analysis_path, results / "analysis.json")
        _collect(ws / "scores_json" / f"{s}.json", results / "scores.json")
        _collect(ws / "stair_json" / f"{s}.json", results / "stair.json")
        _collect(ws / "angles_json" / f"{s}.json", results / "angles.json")

        output_video = ws / "output_video" / f"{s}.mp4"
        output_plain = ws / "output_4_video" / f"{s}_plain.mp4"
        if output_video.is_file():
            remux_faststart(output_video)
            _collect(output_video, results / "output.mp4")
        if output_plain.is_file():
            remux_faststart(output_plain)
            _collect(output_plain, results / "output_plain.mp4")

        with (results / "analysis.json").open(encoding="utf-8") as f:
            return json.load(f)
    except subprocess.TimeoutExpired:
        raise ComparisonError(
            f"humanpose 比對逾時（>{config.COMPARISON_TIMEOUT_SECONDS}s）"
        )
    finally:
        shutil.rmtree(ws, ignore_errors=True)


def _collect(src: Path, dest: Path) -> None:
    if src.is_file():
        shutil.move(str(src), str(dest))
