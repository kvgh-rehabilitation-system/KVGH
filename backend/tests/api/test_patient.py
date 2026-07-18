import pytest

ENDPOINTS = [
    "/api/patient/dashboard",
    "/api/patient/visits",
    "/api/patient/rehabilitation-plans",
]


@pytest.mark.parametrize("path", ENDPOINTS)
def test_main_endpoints(client, auth, path):
    r = client.get(path, headers=auth("patient"))
    assert r.status_code == 200
    assert isinstance(r.json(), (list, dict))
