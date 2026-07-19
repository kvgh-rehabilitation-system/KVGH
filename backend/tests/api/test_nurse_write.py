"""護理師審核寫入契約：狀態轉移、覆寫修正、擋分析中。

demo seed 保證 nurse01 的佇列有 PENDING_REVIEW（submission_series 的
pending_last）與全域有 ANALYZING（p17/p19）。審核會把 seed 資料轉成
REVIEWED——既有 GET 測試只驗狀態碼與頂層形狀，不受影響。
"""

import pytest


@pytest.fixture(scope="module")
def pending_id(client, auth):
    """nurse01 佇列裡第一筆待審 submission。"""
    r = client.get(
        "/api/nurse/submissions", headers=auth("nurse"), params={"status": "PENDING_REVIEW"}
    )
    assert r.status_code == 200
    subs = r.json()["submissions"]
    assert subs, "demo seed 應有 PENDING_REVIEW submission（nurse01 佇列為空？）"
    return subs[0]["id"]


def test_review_approve(client, auth, pending_id):
    """送出審核：狀態轉 REVIEWED、記錄 decision/feedback/審核者。"""
    r = client.post(
        f"/api/nurse/submissions/{pending_id}/review",
        headers=auth("nurse"),
        json={"decision": "APPROVED", "feedback": "動作標準，繼續保持"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "REVIEWED"
    assert body["decision"] == "APPROVED"
    assert body["feedback"] == "動作標準，繼續保持"
    assert body["reviewer_name"], "應記錄審核者"

    # re-GET 確認寫入落地（不是只有回應好看）
    r = client.get(f"/api/nurse/submissions/{pending_id}", headers=auth("nurse"))
    assert r.status_code == 200
    assert r.json()["status"] == "REVIEWED"


def test_review_overwrite_is_allowed(client, auth, pending_id):
    """REVIEWED 後可再送 = 修正審核契約（覆寫 decision 與 feedback）。"""
    r = client.post(
        f"/api/nurse/submissions/{pending_id}/review",
        headers=auth("nurse"),
        json={"decision": "NEEDS_ATTENTION", "feedback": "重看後發現代償"},
    )
    assert r.status_code == 200
    assert r.json()["decision"] == "NEEDS_ATTENTION"


def test_review_invalid_decision(client, auth, pending_id):
    r = client.post(
        f"/api/nurse/submissions/{pending_id}/review",
        headers=auth("nurse"),
        json={"decision": "MAYBE"},
    )
    assert r.status_code == 422


def test_review_analyzing_blocked(client, auth):
    """分析中（含 FAILED）不給審——先重新分析才有演算法佐證。"""
    r = client.get("/api/admin/tasks", headers=auth("admin"), params={"page_size": 100})
    assert r.status_code == 200
    analyzing = [it["submission_id"] for it in r.json()["items"] if it["status"] == "ANALYZING"]
    assert analyzing, "demo seed 應有 ANALYZING submission（p17/p19）"
    r = client.post(
        f"/api/nurse/submissions/{analyzing[0]}/review",
        headers=auth("nurse"),
        json={"decision": "APPROVED"},
    )
    assert r.status_code == 400
