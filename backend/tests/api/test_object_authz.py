"""物件層授權契約——三層現況全部釘住：

1. 病患嚴格隔離：只能讀自己的 plan/submission，跨人一律 404（不洩漏存在性）
2. 護理師同儕互通「是設計」：單筆審核不驗管轄（互相支援代審，
   見 nurse_service.py 檔頭說明）——跨管轄審核必須 200
3. 醫師同儕互通「是設計」：病患看診未必固定醫師，任一醫生可調整任一計畫
   ——跨主治調整必須 200

若 2/3 紅燈 = 有人加了管轄檢查：這是行為變更，需醫院流程確認，不是 bug fix。
"""

import pytest


def test_patient_cannot_read_others(client, auth, login_as):
    """patient03 讀 patient01 的 plan / submission → 404。"""
    r = client.get("/api/patient/rehabilitation-plans", headers=auth("patient"))
    assert r.status_code == 200
    plans = r.json()
    assert plans, "demo seed 的 patient01 應有計畫"
    plan_id = plans[0]["id"]

    r = client.get(f"/api/patient/rehabilitation-plans/{plan_id}", headers=auth("patient"))
    assert r.status_code == 200
    subs = r.json()["submissions"]

    other = login_as("patient03")
    r = client.get(f"/api/patient/rehabilitation-plans/{plan_id}", headers=other)
    assert r.status_code == 404, f"跨病患讀 plan 應 404，得到 {r.status_code}"
    if subs:  # 上傳紀錄與刪除同樣以本人為界
        sid = subs[0]["id"]
        assert client.get(f"/api/patient/submissions/{sid}", headers=other).status_code == 404
        assert client.delete(f"/api/patient/submissions/{sid}", headers=other).status_code == 404


def _my_name(client, username: str) -> str:
    r = client.post("/api/auth/login", json={"username": username, "password": "1234"})
    assert r.status_code == 200
    return r.json()["name"]


def test_nurse_cross_jurisdiction_review_allowed(client, auth):
    """nurse01 審「不在自己佇列」的待審件 → 200（互相代審契約）。"""
    r = client.get("/api/nurse/submissions", headers=auth("nurse"))
    mine = {s["id"] for s in r.json()["submissions"]}

    # 全域待審件從 admin 任務監控找（該列表不分護理師）
    r = client.get("/api/admin/tasks", headers=auth("admin"), params={"page_size": 100})
    others = [
        it["submission_id"]
        for it in r.json()["items"]
        if it["status"] == "PENDING_REVIEW" and it["submission_id"] not in mine
    ]
    if not others:
        pytest.skip("找不到 nurse01 佇列以外的待審件（seed 資料被先前測試審完）")

    r = client.get(f"/api/nurse/submissions/{others[0]}", headers=auth("nurse"))
    assert r.status_code == 200, "跨管轄讀取應允許"
    r = client.post(
        f"/api/nurse/submissions/{others[0]}/review",
        headers=auth("nurse"),
        json={"decision": "APPROVED", "feedback": "代審"},
    )
    assert r.status_code == 200, f"跨管轄代審是設計行為，應 200，得到 {r.status_code}"


def test_doctor_cross_jurisdiction_adjust_allowed(client, auth):
    """doctor01 調整其他醫師主治的 ONGOING 計畫 → 200。"""
    me = _my_name(client, "doctor01")
    r = client.get("/api/doctor/rehabilitation-plans", headers=auth("doctor"))
    target = None
    for p in r.json():
        if p["status"] != "ONGOING":
            continue
        detail = client.get(
            f"/api/doctor/rehabilitation-plans/{p['id']}", headers=auth("doctor")
        ).json()
        if detail["doctor_name"] != me:
            target = detail
            break
    assert target, "demo seed 應有其他醫師主治的 ONGOING 計畫"

    old = target["current_version"]
    r = client.post(
        f"/api/doctor/rehabilitation-plans/{target['id']}/adjust",
        headers=auth("doctor"),
        json={
            "change_summary": "跨主治調整契約測試",
            "goals": old["goals"] or ["維持關節活動度"],
            "items": [
                {
                    "name": it["name"],
                    "frequency": it["frequency"],
                    "times_per_week": it["times_per_week"],
                    "teacher_video_id": (it.get("teacher_video") or {}).get("id"),
                }
                for it in old["items"]
            ],
        },
    )
    assert r.status_code == 200, f"跨主治調整是設計行為，應 200，得到 {r.status_code}"
