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
