"""媒體串流 Range/206 契約（media_service.stream_video）。

前置：CI job 在 seed 後執行 ci/api-tests/media_fixture.py（一次性 backend
容器），往 media volume 寫一支 4096 bytes、開頭 b"KVGH" 的假影片並把
最小 id 的 submission.video_path 指過去；api-tests 服務帶 MEDIA_FIXTURE=1
啟用本檔。本機直打 dev stack 沒跑 fixture 時整檔 skip。

已知限制不釘：suffix 語法 `bytes=-N` 實作有誤（media_service 檔內 FIXME），
修好前不對它斷言，避免把壞行為釘成契約。
"""

import os

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("MEDIA_FIXTURE"),
    reason="需先跑 ci/api-tests/media_fixture.py（設 MEDIA_FIXTURE=1 啟用）",
)

SIZE = 4096  # 與 media_fixture.py 的 CONTENT 長度耦合


@pytest.fixture(scope="module")
def video_url(client, auth, tokens):
    """找出 fixture 掛上檔案的那筆 submission（唯一會回 200 且大小吻合的）。"""
    r = client.get("/api/admin/tasks", headers=auth("admin"), params={"page_size": 100})
    assert r.status_code == 200
    sids = sorted(it["submission_id"] for it in r.json()["items"])
    for sid in sids:
        url = f"/api/media/submissions/{sid}/video"
        r = client.get(url, params={"token": tokens["nurse"]})
        if r.status_code == 200 and len(r.content) == SIZE:
            return url
    pytest.fail("找不到 media fixture 的 submission——fixture 步驟沒跑或沒生效")


def test_full_content_without_range(client, tokens, video_url):
    r = client.get(video_url, params={"token": tokens["nurse"]})
    assert r.status_code == 200
    assert r.headers["accept-ranges"] == "bytes"
    assert int(r.headers["content-length"]) == SIZE
    assert r.content[:4] == b"KVGH"


def test_range_start_end(client, tokens, video_url):
    """<video> 邊播邊緩衝的根基：部分內容 206 + Content-Range。"""
    r = client.get(video_url, params={"token": tokens["nurse"]}, headers={"Range": "bytes=0-3"})
    assert r.status_code == 206
    assert r.headers["content-range"] == f"bytes 0-3/{SIZE}"
    assert r.content == b"KVGH"


def test_range_open_ended(client, tokens, video_url):
    """`bytes=N-`（無結尾）= 拖進度條跳播的請求形狀。"""
    r = client.get(
        video_url, params={"token": tokens["nurse"]}, headers={"Range": f"bytes={SIZE - 6}-"}
    )
    assert r.status_code == 206
    assert r.headers["content-range"] == f"bytes {SIZE - 6}-{SIZE - 1}/{SIZE}"
    assert len(r.content) == 6


def test_range_beyond_eof(client, tokens, video_url):
    r = client.get(video_url, params={"token": tokens["nurse"]}, headers={"Range": "bytes=999999-"})
    assert r.status_code == 416
    assert r.headers["content-range"] == f"bytes */{SIZE}"


def test_unparsable_range_falls_back_to_full(client, tokens, video_url):
    """解析不了的 Range 寬鬆回 200 整檔（不是 4xx）——現行契約。"""
    r = client.get(video_url, params={"token": tokens["nurse"]}, headers={"Range": "chunks=1-2"})
    assert r.status_code == 200
    assert int(r.headers["content-length"]) == SIZE
