"""2D/3D 姿態萃取：在暫時工作目錄跑 get_2D_3D_script.py（AlphaPose → MotionBERT）。

get_2D_3D_script 把輸出寫在 CWD 下的 alphapose_output/ 與 motionbert_output/，
故每個任務用獨立 job 目錄執行，完成後把 artifact 搬到該影片的永久目錄。
導師影片只萃取一次，之後每次比對直接重用 npy。
"""

import shutil
import subprocess
import sys
import uuid
from pathlib import Path

from worker import config
from worker.pipeline import paths


class ExtractionError(RuntimeError):
    def __init__(self, message: str, stderr: str = ""):
        self.stderr = stderr
        super().__init__(message)


def artifacts_exist(kind: str, entity_id: int) -> bool:
    """npy + 2D 渲染影片都在才算萃取完成（短路重用的判定條件）。"""
    name = paths.entity_name(kind, entity_id)
    return (paths.motionbert_dir(kind, entity_id) / f"{name}.npy").is_file() and (
        paths.alphapose_dir(kind, entity_id) / f"{name}.mp4"
    ).is_file()


def run_extraction(kind: str, entity_id: int) -> None:
    """跑 AlphaPose→MotionBERT 萃取，成功後把產物搬到影片的永久目錄。"""
    video = paths.canonical_video(kind, entity_id)
    if not video.is_file():
        raise ExtractionError(f"找不到轉檔後的影片: {video}")

    # 每次任務用唯一的 job 目錄（uuid 後綴），並發萃取互不干擾
    name = paths.entity_name(kind, entity_id)
    job_dir = paths.jobs_dir() / f"extract-{name}-{uuid.uuid4().hex[:8]}"
    job_dir.mkdir(parents=True, exist_ok=True)
    try:
        cmd = [
            sys.executable,
            str(config.ALGORITHM_DIR / "get_2D_3D_script.py"),
            "--alphapose_script_path",
            str(config.ALPHAPOSE_SCRIPT),
            "--motionbert_script_path",
            str(config.MOTIONBERT_SCRIPT),
            "--video_path",
            str(video),
        ]
        proc = subprocess.run(
            cmd,
            cwd=job_dir,
            capture_output=True,
            text=True,
            timeout=config.EXTRACTION_TIMEOUT_SECONDS,
        )
        if proc.returncode != 0:
            raise ExtractionError(
                f"2D/3D 萃取失敗（exit {proc.returncode}）", stderr=proc.stderr[-2000:]
            )

        # 搬 artifact 至永久位置（npy 永久保留，比對時重用）
        _move_outputs(job_dir / "alphapose_output", paths.alphapose_dir(kind, entity_id), name)
        _move_outputs(job_dir / "motionbert_output", paths.motionbert_dir(kind, entity_id), name)

        # 搬完再驗一次：subprocess exit 0 不保證產物齊全（遺留腳本可能吞錯誤）
        if not artifacts_exist(kind, entity_id):
            raise ExtractionError("萃取完成但找不到預期的輸出檔（npy/mp4）")
    except subprocess.TimeoutExpired as exc:
        raise ExtractionError(f"2D/3D 萃取逾時（>{config.EXTRACTION_TIMEOUT_SECONDS}s）") from exc
    finally:
        # 無論成敗都清 job 目錄（成功時產物已搬走，剩的都是中間垃圾）
        shutil.rmtree(job_dir, ignore_errors=True)


def _move_outputs(src_dir: Path, dest_dir: Path, name: str) -> None:
    """只搬檔名主幹等於 charactor 名的產物（job 目錄可能混有其他中間檔）。"""
    dest_dir.mkdir(parents=True, exist_ok=True)
    if not src_dir.is_dir():
        return
    for f in src_dir.iterdir():
        if f.stem == name:
            shutil.move(str(f), str(dest_dir / f.name))
