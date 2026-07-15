from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse, MeResponse
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """帳密登入，成功回傳 JWT 與角色資訊（前端據此導向角色首頁）。"""
    # 驗證帳密（帳號不存在或密碼錯都回 None）
    user = auth_service.authenticate(db, data.username, data.password)
    if not user:
        # 帳號不存在與密碼錯誤刻意回同一訊息，避免洩漏帳號是否存在
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    # 停用檢查放在密碼驗證之後：密碼錯的人不該得知帳號被停用
    if not user.is_active:
        raise HTTPException(status_code=403, detail="帳號已被停用，請聯絡管理員")
    # 簽發 12 小時效期的 JWT（sub=username、role 供前端路由）
    token = create_access_token(user.username, user.role)
    return LoginResponse(
        access_token=token, role=user.role, name=user.name, username=user.username
    )


@router.get("/me", response_model=MeResponse)
def me(user: User = Depends(get_current_user)):
    """回傳目前登入者資訊；前端重新整理時以此還原登入狀態並驗 token 是否仍有效。"""
    return MeResponse(
        id=user.id, username=user.username, role=user.role, name=user.name, title=user.title
    )
