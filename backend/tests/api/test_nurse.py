import pytest

ENDPOINTS = [
    "/api/nurse/dashboard",
    "/api/nurse/patients",
    "/api/nurse/submissions",
    "/api/nurse/teacher-videos",
    "/api/nurse/reports",
]


@pytest.mark.parametrize("path", ENDPOINTS)
def test_main_endpoints(client, auth, path):
    r = client.get(path, headers=auth("nurse"))
    assert r.status_code == 200
    assert isinstance(r.json(), (list, dict))
