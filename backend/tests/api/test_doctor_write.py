"""醫生計畫調整寫入契約：版本快照（覆蓋式）與非有效中計畫的擋門。

adjust 是整版覆蓋：舊版關閉（is_current=False）、新版 version+1、
status 重設 ONGOING。items payload 從現行版本組回去（帶 teacher_video_id
沿用綁定），模擬前端表單的實際行為。
"""


def _items_payload(version: dict) -> list[dict]:
    """PlanVersionOut.items → PlanItemCreate 列表（保留導師影片綁定）。"""
    return [
        {
            "name": it["name"],
            "frequency": it["frequency"],
            "times_per_week": it["times_per_week"],
            "description": it["description"],
            "precaution": it["precaution"],
            "teacher_video_id": (it.get("teacher_video") or {}).get("id"),
        }
        for it in version["items"]
    ]


def test_adjust_creates_new_version(client, auth):
    r = client.get("/api/doctor/rehabilitation-plans", headers=auth("doctor"))
    assert r.status_code == 200
    ongoing = [p for p in r.json() if p["status"] == "ONGOING"]
    assert ongoing, "demo seed 應有 ONGOING 計畫"
    plan_id = ongoing[0]["id"]

    r = client.get(f"/api/doctor/rehabilitation-plans/{plan_id}", headers=auth("doctor"))
    assert r.status_code == 200
    before = r.json()
    old = before["current_version"]
    assert old is not None

    r = client.post(
        f"/api/doctor/rehabilitation-plans/{plan_id}/adjust",
        headers=auth("doctor"),
        json={
            "change_summary": "API 測試：調整計畫產生新版本",
            "goals": old["goals"] or ["維持關節活動度"],
            "items": _items_payload(old),
        },
    )
    assert r.status_code == 200, r.text

    r = client.get(f"/api/doctor/rehabilitation-plans/{plan_id}", headers=auth("doctor"))
    after = r.json()
    assert after["current_version"]["version"] == old["version"] + 1
    assert after["current_version"]["is_current"] is True
    assert after["status"] == "ONGOING"
    # 舊版本進歷史且已關閉
    old_snap = next(v for v in after["versions"] if v["version"] == old["version"])
    assert old_snap["is_current"] is False
    assert old_snap["ended_at"] is not None
    # 覆蓋式重建後動作數不變（payload 是整版全量）
    assert len(after["current_version"]["items"]) == len(old["items"])


def test_adjust_closed_plan_blocked(client, auth):
    r = client.get(
        "/api/doctor/rehabilitation-plans", headers=auth("doctor"), params={"status": "ALL"}
    )
    assert r.status_code == 200
    closed = [p for p in r.json() if p["status"] == "CLOSED"]
    assert closed, "demo seed 應有 CLOSED 計畫（p07/p15）"
    r = client.post(
        f"/api/doctor/rehabilitation-plans/{closed[0]['id']}/adjust",
        headers=auth("doctor"),
        json={"change_summary": "不該成功", "goals": [], "items": []},
    )
    assert r.status_code == 400
