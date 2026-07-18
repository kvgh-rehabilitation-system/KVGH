"""媒體端點認證契約:auth 依賴先於資源查找。

--demo seed 的 submission 磁碟上沒有影片檔(見根目錄 CLAUDE.md),
所以這裡只驗「認證層」的契約,不驗串流本身:
  - 無 token → 401(不論資源存不存在)
  - ?token= query 認證成立 → 不是 401(可能 200/206/403/404,依資料而定)
"""

MEDIA_PATH = "/api/media/submissions/1/video"


def test_no_token_unauthorized(client):
    r = client.get(MEDIA_PATH)
    assert r.status_code in (401, 403)


def test_query_token_accepted(client, tokens):
    """<video> 標籤帶不了 header,?token= 是前端播放器賴以運作的契約。"""
    r = client.get(MEDIA_PATH, params={"token": tokens["nurse"]})
    assert r.status_code != 401, f"query token 未被接受: {r.status_code}"
