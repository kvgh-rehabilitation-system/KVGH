def test_users_list(client, auth):
    r = client.get("/api/admin/users", headers=auth("admin"))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_overview(client, auth):
    r = client.get("/api/admin/overview", headers=auth("admin"))
    assert r.status_code == 200
    assert isinstance(r.json(), dict)


def test_tasks(client, auth):
    r = client.get("/api/admin/tasks", headers=auth("admin"))
    assert r.status_code == 200
