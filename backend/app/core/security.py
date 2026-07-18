"""密碼雜湊（bcrypt）與 JWT 簽發/驗證的最小封裝。

其他模組不直接碰 passlib / PyJWT，統一走這裡，
之後換演算法或加 refresh token 只需改此檔。
"""

from datetime import UTC, datetime, timedelta

import jwt
from passlib.context import CryptContext

from app.core.config import settings

# deprecated="auto"：未來若換雜湊演算法，舊 bcrypt 雜湊仍可驗證並在下次登入時升級
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """明文密碼 → bcrypt 雜湊字串（含隨機 salt，同密碼每次結果不同）。"""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """比對明文密碼與 bcrypt 雜湊是否相符（登入驗證用）。"""
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str, role: str) -> str:
    """簽發 JWT。

    Args:
        subject: 使用者帳號（username，非 id）——deps.py 以此回查 User
        role: 使用者角色，放進 payload 供前端路由用；後端授權仍以 DB 為準
              （require_role 重新查 DB，不信 token 裡的 role）
    Returns:
        HS256 簽章的 JWT 字串，效期見 settings.JWT_EXPIRE_MINUTES
    """
    # 效期以 UTC 計算（JWT exp 標準要求）；payload 僅放不敏感的識別資訊
    expire = datetime.now(UTC) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """驗證簽章與效期並回傳 payload；失敗時拋 jwt.PyJWTError 由呼叫端轉 401。"""
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
