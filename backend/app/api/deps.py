import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=401, detail="未登入")
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="登入已過期，請重新登入")
    user = db.query(User).filter(User.username == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=401, detail="使用者不存在")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="帳號已被停用，請聯絡管理員")
    return user


def require_role(role: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role != role:
            raise HTTPException(status_code=403, detail="沒有存取此資源的權限")
        return user

    return checker


require_admin = require_role("admin")
require_doctor = require_role("doctor")
require_nurse = require_role("nurse")
require_patient = require_role("patient")


def get_user_flexible(
    token: str | None = None,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Bearer header 或 ?token= 皆可的認證，供 <video> 串流端點使用
    （HTML video 標籤無法帶 Authorization header）。"""
    raw = credentials.credentials if credentials else token
    if not raw:
        raise HTTPException(status_code=401, detail="未登入")
    try:
        payload = decode_access_token(raw)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="登入已過期，請重新登入")
    user = db.query(User).filter(User.username == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=401, detail="使用者不存在")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="帳號已被停用，請聯絡管理員")
    return user
