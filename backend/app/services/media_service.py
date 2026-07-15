"""媒體檔案儲存與串流。

所有影片與演算法產物存於 MEDIA_ROOT（容器內 /data/media，對應專案 media/），
DB 只存相對路徑。除 jobs/ 外全部永久保留，僅使用者主動刪除才移除。

播放採 YouTube 式邊播邊緩衝：faststart mp4 + HTTP Range（206），
瀏覽器 <video> 即可漸進式緩衝與拖曳，不必等整支下載。
"""

import os
import re
import shutil
from pathlib import Path

from fastapi import HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, Response, StreamingResponse

from app.core.config import settings

ALLOWED_UPLOAD_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}

_RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")
_CHUNK_SIZE = 1024 * 1024  # 1MB


def media_root() -> Path:
    """MEDIA_ROOT 的 Path（順手確保目錄存在，首次啟動即可用）。"""
    root = Path(settings.MEDIA_ROOT)
    root.mkdir(parents=True, exist_ok=True)
    return root


def abs_path(rel_path: str) -> Path:
    """相對路徑轉絕對路徑，並防止路徑跳脫 MEDIA_ROOT。"""
    root = media_root().resolve()
    target = (root / rel_path).resolve()
    if not target.is_relative_to(root):
        raise HTTPException(status_code=400, detail="非法路徑")
    return target


# 三類媒體目錄的路徑約定（與 worker/演算法共用的磁碟契約，見根目錄 CLAUDE.md）

def teacher_video_dir(teacher_video_id: int) -> Path:
    return media_root() / "teacher_videos" / str(teacher_video_id)


def submission_dir(submission_id: int) -> Path:
    return media_root() / "submissions" / str(submission_id)


def results_dir(submission_id: int) -> Path:
    return media_root() / "results" / str(submission_id)


def save_upload(upload: UploadFile, dest_dir: Path) -> tuple[str, str]:
    """儲存原始上傳檔為 upload.<副檔名>，回傳 (相對路徑, 原始檔名)。"""
    # 白名單副檔名檢查（轉檔交給 worker 的 ffmpeg，這裡只擋明顯非影片）
    original_name = upload.filename or "video"
    ext = Path(original_name).suffix.lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支援的影片格式 {ext or '(無副檔名)'}，支援：{'、'.join(sorted(ALLOWED_UPLOAD_EXTENSIONS))}",
        )
    # 固定存成 upload.<ext>（不信任使用者檔名，避免路徑注入與編碼問題）
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"upload{ext}"
    # 串流分塊落地，大檔不佔記憶體
    with dest.open("wb") as f:
        shutil.copyfileobj(upload.file, f, length=_CHUNK_SIZE)
    rel = dest.relative_to(media_root())
    return str(rel), original_name


def delete_media_dir(path: Path) -> None:
    """整目錄刪除（冪等；不存在就靜默跳過）。副作用：磁碟檔案不可復原。"""
    if path.exists():
        shutil.rmtree(path)


def send_file(rel_path: str, media_type: str = "application/octet-stream"):
    """整檔回傳（小檔用，如 .npy 骨架資料），沿用 abs_path 路徑守衛。"""
    path = abs_path(rel_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="檔案不存在")
    return FileResponse(path, media_type=media_type)


def stream_video(request: Request, rel_path: str | None):
    """HTTP Range 串流（206 Partial Content），支援 <video> 邊播邊緩衝與拖曳。"""
    if not rel_path:
        raise HTTPException(status_code=404, detail="影片尚未就緒")
    path = abs_path(rel_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="影片檔案不存在")

    file_size = path.stat().st_size
    range_header = request.headers.get("range")

    start, end = 0, file_size - 1
    status_code = 200
    if range_header:
        match = _RANGE_RE.match(range_header)
        # 解析不了的 Range 一律回 200 整檔（寬鬆處理，瀏覽器可自行重試）
        # FIXME: 未支援後綴語法「bytes=-N」（最後 N bytes）——目前會被誤解成
        # 「前 N+1 bytes」。主流瀏覽器播 mp4 不用此語法，故暫可接受
        if match:
            if match.group(1):
                start = int(match.group(1))
            if match.group(2):
                end = min(int(match.group(2)), file_size - 1)
            if start > end or start >= file_size:
                return Response(
                    status_code=416,
                    headers={"Content-Range": f"bytes */{file_size}"},
                )
            status_code = 206

    content_length = end - start + 1

    # 產生器逐塊讀取請求範圍：seek 到起點、只吐 content_length bytes
    def iter_file():
        with path.open("rb") as f:
            f.seek(start)
            remaining = content_length
            while remaining > 0:
                chunk = f.read(min(_CHUNK_SIZE, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(content_length),
        "Content-Type": "video/mp4",
    }
    if status_code == 206:
        headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"
    return StreamingResponse(iter_file(), status_code=status_code, headers=headers)
