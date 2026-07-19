"""admin 帳號 CRUD 寫入契約：建立/更新/重設密碼/停用/刪除全生命週期。

穩定契約原則：只驗狀態碼與關鍵欄位（軟刪除的 deleted 布林、停用後登入被擋），
不驗回應細節。測試自建帳號（uuid 後綴避免重跑撞名），不動 seed 的代表帳號
（admin01/nurse01 等被其他測試的 session token 依賴，停用會連坐）。
"""

import io
import uuid


def _uname(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _login_status(client, username, password):
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    return r.status_code


def test_user_lifecycle(client, auth):
    """建立 → 登入 → 改名 → 重設密碼 → 停用 → 啟用 → 真刪（無關聯帳號）。"""
    username = _uname("doc")
    r = client.post(
        "/api/admin/users",
        headers=auth("admin"),
        json={"username": username, "password": "pw1", "role": "doctor", "name": "測試醫師"},
    )
    assert r.status_code == 201, r.text
    uid = r.json()["id"]
    assert _login_status(client, username, "pw1") == 200

    # 更新基本資料（禁改 role——schema 就不收 role 欄位）
    r = client.patch(f"/api/admin/users/{uid}", headers=auth("admin"), json={"name": "改名醫師"})
    assert r.status_code == 200
    assert r.json()["name"] == "改名醫師"

    # 重設密碼後：新密碼可登入、舊密碼 401
    r = client.post(
        f"/api/admin/users/{uid}/reset-password",
        headers=auth("admin"),
        json={"new_password": "pw2"},
    )
    assert r.status_code == 200
    assert _login_status(client, username, "pw2") == 200
    assert _login_status(client, username, "pw1") == 401

    # 停用：登入 403（非 401——密碼對但帳號停用）、既發 token 打 API 也 403
    r = client.post("/api/auth/login", json={"username": username, "password": "pw2"})
    old_token = r.json()["access_token"]
    r = client.post(
        f"/api/admin/users/{uid}/set-active", headers=auth("admin"), json={"is_active": False}
    )
    assert r.status_code == 200
    assert r.json()["is_active"] is False
    assert _login_status(client, username, "pw2") == 403
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {old_token}"})
    assert r.status_code == 403, "停用帳號的既發 token 應被每請求檢查擋下"

    # 重新啟用可再登入
    r = client.post(
        f"/api/admin/users/{uid}/set-active", headers=auth("admin"), json={"is_active": True}
    )
    assert r.status_code == 200
    assert _login_status(client, username, "pw2") == 200

    # 無任何臨床關聯 → 真刪
    r = client.delete(f"/api/admin/users/{uid}", headers=auth("admin"))
    assert r.status_code == 200
    assert r.json()["deleted"] is True
    assert _login_status(client, username, "pw2") == 401


def test_create_patient_requires_profile(client, auth):
    """patient 角色必附 patient_profile（422）；附了連動建 Patient 列、可真刪。"""
    username = _uname("pat")
    r = client.post(
        "/api/admin/users",
        headers=auth("admin"),
        json={"username": username, "role": "patient", "name": "測試病患"},
    )
    assert r.status_code == 422

    r = client.post(
        "/api/admin/users",
        headers=auth("admin"),
        json={
            "username": username,
            "role": "patient",
            "name": "測試病患",
            "patient_profile": {
                "patient_number": f"T{uuid.uuid4().hex[:8]}",
                "birth_date": "1960-01-01",
                "gender": "MALE",
            },
        },
    )
    assert r.status_code == 201, r.text
    uid = r.json()["id"]
    assert r.json()["patient_number"] is not None

    # 乾淨病患真刪（連 Patient 列一起）
    r = client.delete(f"/api/admin/users/{uid}", headers=auth("admin"))
    assert r.status_code == 200
    assert r.json()["deleted"] is True


def test_duplicate_username_conflict(client, auth):
    username = _uname("dup")
    payload = {"username": username, "role": "nurse", "name": "撞名測試"}
    r = client.post("/api/admin/users", headers=auth("admin"), json=payload)
    assert r.status_code == 201
    uid = r.json()["id"]
    r = client.post("/api/admin/users", headers=auth("admin"), json=payload)
    assert r.status_code == 409
    client.delete(f"/api/admin/users/{uid}", headers=auth("admin"))


def test_delete_referenced_user_degrades_to_deactivate(client, auth, login_as):
    """有 FK 引用的帳號「刪除」自動降級為停用（軟刪除優先）。

    引用來源刻意挑 teacher_videos.uploaded_by：曾漏計此 FK（admin_service
    的 _user_ref_count），只上傳過導師影片的護理師會被誤判可真刪、
    db.delete 撞 FK 直接 500——此測試釘住修復。
    """
    username = _uname("nur")
    r = client.post(
        "/api/admin/users",
        headers=auth("admin"),
        json={"username": username, "password": "1234", "role": "nurse", "name": "上傳護理師"},
    )
    assert r.status_code == 201, r.text
    uid = r.json()["id"]

    # 以該護理師上傳一支導師影片（multipart；管線任務進 broker 無 worker 消化，無妨）
    r = client.post(
        "/api/nurse/teacher-videos",
        headers=login_as(username),
        data={"name": "ref-count 測試影片"},
        files={"video": ("t.mp4", io.BytesIO(b"\x00" * 1024), "video/mp4")},
    )
    assert r.status_code == 202, r.text

    # 刪除 → 降級為停用，不是 500 也不是真刪
    r = client.delete(f"/api/admin/users/{uid}", headers=auth("admin"))
    assert r.status_code == 200, f"應降級停用而非爆炸: {r.status_code} {r.text}"
    assert r.json()["deleted"] is False
    assert _login_status(client, username, "1234") == 403


def test_admin_and_self_protected(client, auth):
    """不能刪除/停用 admin 或自己（系統不可失去管理能力）。"""
    r = client.get("/api/auth/me", headers=auth("admin"))
    my_id = r.json()["id"]
    r = client.delete(f"/api/admin/users/{my_id}", headers=auth("admin"))
    assert r.status_code == 400
    r = client.post(
        f"/api/admin/users/{my_id}/set-active", headers=auth("admin"), json={"is_active": False}
    )
    assert r.status_code == 400
