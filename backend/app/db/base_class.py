from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """所有 ORM model 的共同基底。

    獨立成檔（而非放在 base.py）是為了讓 models 匯入 Base 時
    不會反向觸發 base.py 匯入所有 models 造成循環匯入。
    """
