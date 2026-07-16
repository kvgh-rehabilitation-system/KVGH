"""影片轉檔：任意上傳格式 → H.264/AAC mp4 + faststart。

驗算法只吃 mp4；faststart（moov atom 前置）讓瀏覽器 <video> 能
YouTube 式邊播邊緩衝。h264 來源只 remux（-c copy，秒級），其他編碼才重編。
"""

import json
import subprocess
from pathlib import Path


class TranscodeError(RuntimeError):
    pass


def probe(path: Path) -> dict:
    """ffprobe 讀取影片的 streams/format 資訊（JSON）。"""
    cmd = [
        "ffprobe", "-v", "error",
        "-print_format", "json",
        "-show_streams", "-show_format",
        str(path),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise TranscodeError(f"ffprobe 失敗（檔案可能損壞）: {proc.stderr[-500:]}")
    return json.loads(proc.stdout)


def _video_stream(info: dict) -> dict:
    """取第一條影像軌（沒有就是壞檔/純音訊，直接失敗）。"""
    for s in info.get("streams", []):
        if s.get("codec_type") == "video":
            return s
    raise TranscodeError("找不到影像軌")


def video_meta(path: Path) -> tuple[float, int]:
    """回傳 (fps, frame_count)。"""
    info = probe(path)
    vs = _video_stream(info)
    # r_frame_rate 是分數字串（如 "30000/1001"），自行相除
    num, _, den = (vs.get("r_frame_rate") or "30/1").partition("/")
    fps = float(num) / float(den or 1)
    # 幀數優先信 nb_frames；部分容器不帶此欄，退而用 時長×fps 估算
    nb = vs.get("nb_frames")
    if nb and str(nb).isdigit():
        return fps, int(nb)
    duration = float(vs.get("duration") or info.get("format", {}).get("duration") or 0)
    return fps, int(duration * fps)


def transcode_to_mp4(src: Path, dest: Path) -> tuple[float, int]:
    """轉出 faststart mp4，回傳 (fps, frame_count)。"""
    info = probe(src)
    vs = _video_stream(info)
    audio = next(
        (s for s in info.get("streams", []) if s.get("codec_type") == "audio"), None
    )

    # 已是 h264（音軌無或 aac）→ 只換容器（-c copy，秒級完成）；否則重編碼
    can_remux = vs.get("codec_name") == "h264" and (
        audio is None or audio.get("codec_name") == "aac"
    )

    dest.parent.mkdir(parents=True, exist_ok=True)
    if can_remux:
        codec_args = ["-c", "copy"]
    else:
        # yuv420p：避免手機拍的 10-bit/4:2:2 影片在部分瀏覽器無法播放
        codec_args = [
            "-c:v", "libx264", "-crf", "23", "-preset", "medium",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
        ]
    cmd = [
        "ffmpeg", "-y", "-i", str(src),
        *codec_args,
        "-movflags", "+faststart",
        str(dest),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        # 失敗要清掉半成品：殘留的 dest 會被下次任務的短路檢查誤判為轉檔完成
        dest.unlink(missing_ok=True)
        raise TranscodeError(f"ffmpeg 轉檔失敗: {proc.stderr[-800:]}")
    return video_meta(dest)


def remux_faststart(path: Path) -> None:
    """就地補 faststart（用於演算法輸出的比對影片）。

    ffmpeg 無法原地改寫，先輸出暫存檔再 replace 原檔（同目錄下為原子操作）。
    """
    tmp = path.with_name(f"{path.stem}_faststart.mp4")
    cmd = ["ffmpeg", "-y", "-i", str(path), "-c", "copy", "-movflags", "+faststart", str(tmp)]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        tmp.unlink(missing_ok=True)
        raise TranscodeError(f"faststart remux 失敗: {proc.stderr[-500:]}")
    tmp.replace(path)
