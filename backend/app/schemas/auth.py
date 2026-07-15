"""登入與目前使用者資訊的 request/response 結構。

LoginResponse 帶 role/name 讓前端登入後免再打 /me 即可導向角色首頁；
/me 供重新整理時還原登入狀態。
"""

from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str
    username: str


class MeResponse(BaseModel):
    id: int
    username: str
    role: str
    name: str
    title: str | None = None
