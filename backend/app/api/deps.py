"""認證/授權 FastAPI 依賴。

慣例：一般 API 用 require_admin/doctor/nurse/patient 綁在 router 上；
媒體串流端點用 get_user_flexible（支援 ?token=）。
每個依賴都即時查 DB 而非只信 token，讓「停用帳號」立即生效
（token 效期 12 小時，若只驗 token，停用後仍可操作半天）。
"""

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User

# auto_error=False：缺 header 時不讓 FastAPI 直接回 403，
# 由我們自己回 401 與中文訊息（且 get_user_flexible 還要 fallback 到 ?token=）
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """驗 Bearer token 並回傳 DB 中的 User；停用帳號回 403（非 401，
    讓前端可區分「請重新登入」與「帳號被停用」）。"""
    # 沒帶 Authorization header → 未登入
    if credentials is None:
        raise HTTPException(status_code=401, detail="未登入")
    # 驗簽章與效期；PyJWTError 涵蓋過期、篡改、格式錯誤等所有失敗情況
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="登入已過期，請重新登入")
    # 以 token 的 sub（username）回查 DB——帳號可能在 token 簽發後被刪除
    user = db.query(User).filter(User.username == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=401, detail="使用者不存在")
    # 停用檢查即時看 DB，讓 admin 停用能立刻生效（不用等 token 過期）
    if not user.is_active:
        raise HTTPException(status_code=403, detail="帳號已被停用，請聯絡管理員")
    return user


def require_role(role: str):
    """產生單一角色守門依賴；角色以 DB 目前值為準，不信 token 內的 role。"""

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
    """Bearer header 或 ?token= query 皆可的認證，供 <video> 串流端點使用
    （HTML video 標籤無法帶 Authorization header）。

    停用檢查與 get_current_user 一致——media 串流也要擋停用帳號。
    """
    # 兩者都給時以 header 為準（axios 攔截器自動帶 header，query 是補位手段）
    raw = credentials.credentials if credentials else token
    if not raw:
        raise HTTPException(status_code=401, detail="未登入")
    # 以下驗證流程與 get_current_user 完全一致：驗簽 → 回查 DB → 擋停用
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
