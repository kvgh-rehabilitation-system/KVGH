from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.models.user import User


def authenticate(db: Session, username: str, password: str) -> User | None:
    """驗證帳密，成功回 User、失敗回 None（不區分帳號不存在或密碼錯誤）。

    不在這裡檢查 is_active：停用判斷交給 login 端點，
    讓「密碼對但被停用」能回 403 而非籠統的 401。
    """
    # 查帳號 → 驗 bcrypt；兩種失敗合併回 None（呼叫端統一回「帳號或密碼錯誤」）
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.password_hash):
        return None
    return user
