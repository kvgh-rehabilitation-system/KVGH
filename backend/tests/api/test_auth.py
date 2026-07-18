import pytest
from conftest import ROLE_USERS, ROLES


@pytest.mark.parametrize("role", ROLES)
def test_login_each_role(client, role):
    r = client.post("/api/auth/login", json={"username": ROLE_USERS[role], "password": "1234"})
    assert r.status_code == 200
    body = r.json()
    assert set(body) >= {"access_token", "role", "name", "username"}
    assert body["role"] == role


def test_login_wrong_password(client):
    r = client.post("/api/auth/login", json={"username": "admin01", "password": "wrong"})
    assert r.status_code == 401


def test_login_unknown_user(client):
    """不存在帳號與錯密碼同回 401(不洩漏帳號存在性)。"""
    r = client.post("/api/auth/login", json={"username": "no-such-user", "password": "1234"})
    assert r.status_code == 401


@pytest.mark.parametrize("role", ROLES)
def test_me_with_token(client, auth, role):
    r = client.get("/api/auth/me", headers=auth(role))
    assert r.status_code == 200
    assert set(r.json()) >= {"username", "role"}


def test_me_without_token(client):
    r = client.get("/api/auth/me")
    assert r.status_code in (401, 403)
