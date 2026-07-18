def test_health_no_auth(client):
    """health 是唯一驗完整回應值的測試:它本身就是監控契約。"""
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
