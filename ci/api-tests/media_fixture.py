"""media Range 測試的 fixture：在一次性 backend 容器內執行。

    docker compose -p kvgh-ci -f docker-compose.yml -f ci/compose.ci.yml \
      run --rm -v "$PWD/ci/api-tests/media_fixture.py:/app/media_fixture.py:ro" \
      --entrypoint "python /app/media_fixture.py" backend

（掛進 /app/ 是必要的：script 所在目錄 = sys.path[0]，app 套件才 import 得到。）

往 media volume 寫一支 4096 bytes 假影片（開頭 b"KVGH" 供內容斷言），
並把最小 id 的 submission.video_path 指過去。demo seed 的 submission
磁碟本來無檔案（media 端點全 404），這是唯一會回 200 的一筆——
test_media_range.py 以「200 且大小 4096」探測認出它。
"""

import app.db.base  # noqa: F401  載入全部 models（relationship 字串解析需要）
from app.db.session import SessionLocal
from app.models.submission import VideoSubmission
from app.services import media_service

CONTENT = b"KVGH" + b"\x00" * 4092  # SIZE=4096 與 test_media_range.py 耦合


def main() -> None:
    db = SessionLocal()
    sub = db.query(VideoSubmission).order_by(VideoSubmission.id).first()
    assert sub, "無 submission 可掛 media fixture（demo seed 未跑？）"

    rel = f"submissions/{sub.id}/s{sub.id}.mp4"
    dest = media_service.media_root() / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(CONTENT)
    sub.video_path = rel
    db.commit()
    print(f"media fixture OK: submission {sub.id} → {rel}（{len(CONTENT)} bytes）")


if __name__ == "__main__":
    main()
