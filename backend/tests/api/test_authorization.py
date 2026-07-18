"""角色越權矩陣:每個角色打其他角色的代表端點必須 403,無 token 必須 401。

只挑各 prefix 一個代表端點——驗的是 require_{role} 依賴有掛上,
不是逐端點窮舉(那是實作細節,由各角色測試檔的 200 路徑覆蓋)。
"""

import pytest

# (端點, 該端點的合法角色)
GUARDED = [
    ("/api/admin/users", "admin"),
    ("/api/doctor/dashboard", "doctor"),
    ("/api/nurse/dashboard", "nurse"),
    ("/api/patient/dashboard", "patient"),
]


@pytest.mark.parametrize("path,allowed_role", GUARDED)
def test_cross_role_forbidden(client, auth, path, allowed_role):
    for role in ("admin", "doctor", "nurse", "patient"):
        if role == allowed_role:
            continue
        r = client.get(path, headers=auth(role))
        assert r.status_code == 403, f"{role} 打 {path} 應 403,得到 {r.status_code}"


@pytest.mark.parametrize("path,_allowed", GUARDED)
def test_no_token_unauthorized(client, path, _allowed):
    r = client.get(path)
    assert r.status_code in (401, 403), f"無 token 打 {path} 應 401/403,得到 {r.status_code}"
