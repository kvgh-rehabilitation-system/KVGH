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
    user = auth_service.authenticate(db, data.username, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="帳號已被停用，請聯絡管理員")
    token = create_access_token(user.username, user.role)
    return LoginResponse(
        access_token=token, role=user.role, name=user.name, username=user.username
    )


@router.get("/me", response_model=MeResponse)
def me(user: User = Depends(get_current_user)):
    return MeResponse(
        id=user.id, username=user.username, role=user.role, name=user.name, title=user.title
    )
