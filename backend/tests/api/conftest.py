"""API 契約測試共用 fixtures。

對「已起好的容器 stack」打真 HTTP(API_BASE_URL 指向 backend;CI 由
ci/compose.ci.yml 的 api-tests 服務執行,本機可直打 dev stack :8000)。

穩定契約原則:只驗 HTTP 狀態碼與回應頂層形狀(型別/關鍵 key),
不驗欄位值、筆數、排序——開發中改實作/版面/資料不應弄斷這些測試;
測試紅燈 = 登入、權限、主要端點這類大功能真的壞了。

前置:帳號由 backend entrypoint 自動 seed;列表端點需先跑
`python -m app.seed --demo`(CI job 會做;空資料其實也過,只是路徑更真實)。
"""

import os

import httpx
import pytest

BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")
PASSWORD = "1234"
ROLE_USERS = {
    "admin": "admin01",
    "doctor": "doctor01",
    "nurse": "nurse01",
    "patient": "patient01",
}
ROLES = tuple(ROLE_USERS)


@pytest.fixture(scope="session")
def client():
    with httpx.Client(base_url=BASE_URL, timeout=30) as c:
        yield c


@pytest.fixture(scope="session")
def tokens(client):
    """四角色各登入一次,整個 session 共用 token。"""
    out = {}
    for role, username in ROLE_USERS.items():
        r = client.post("/api/auth/login", json={"username": username, "password": PASSWORD})
        assert r.status_code == 200, f"{role}({username})登入失敗: {r.status_code} {r.text}"
        out[role] = r.json()["access_token"]
    return out


@pytest.fixture(scope="session")
def auth(tokens):
    """auth("nurse") → Bearer header dict。"""
    return lambda role: {"Authorization": f"Bearer {tokens[role]}"}
