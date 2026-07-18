import pytest

LIST_ENDPOINTS = [
    "/api/doctor/patients",
    "/api/doctor/rehabilitation-plans",
    "/api/doctor/reports",
    "/api/doctor/nurses",
]


def test_dashboard(client, auth):
    r = client.get("/api/doctor/dashboard", headers=auth("doctor"))
    assert r.status_code == 200
    assert isinstance(r.json(), dict)


@pytest.mark.parametrize("path", LIST_ENDPOINTS)
def test_lists(client, auth, path):
    r = client.get(path, headers=auth("doctor"))
    assert r.status_code == 200
    assert isinstance(r.json(), list)
