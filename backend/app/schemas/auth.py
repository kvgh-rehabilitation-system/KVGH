"""登入與目前使用者資訊的 request/response 結構。

LoginResponse 帶 role/name 讓前端登入後免再打 /me 即可導向角色首頁；
/me 供重新整理時還原登入狀態。
"""

from pydantic import BaseModel


class LoginRequest(BaseModel):
    """登入表單：帳號 + 密碼。"""

    username: str
    password: str


class LoginResponse(BaseModel):
    """登入成功回應：JWT + 基本身分（前端存 localStorage 並導向角色首頁）。"""

    access_token: str
    token_type: str = "bearer"
    role: str
    name: str
    username: str


class MeResponse(BaseModel):
    """GET /me 回應：目前登入者的完整身分資訊。"""

    id: int
    username: str
    role: str
    name: str
    title: str | None = None
