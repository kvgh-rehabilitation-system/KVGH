"""無 Alembic 的輕量欄位補齊。

`Base.metadata.create_all` 只建缺少的表，不會替既有表加欄位；
本模組在 create_all 之後跑，對宣告清單中的缺欄位下 ALTER TABLE 補上。

限制：ALTER 只補 plain column（SQLite 無法事後加 FK 約束）——
全新 DB 由 create_all 建出真正的 FK/index，被補欄位的舊 DB 只有欄位本身，
參照完整性由 service 層驗證把關（folder_id 皆先查資料夾存在才寫入）。
"""

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

# (table, column, DDL 型別) — 新增欄位時在此登記
_COLUMNS: list[tuple[str, str, str]] = [
    ("teacher_videos", "name", "VARCHAR(100)"),
    ("teacher_videos", "folder_id", "INTEGER"),
    ("users", "is_active", "BOOLEAN NOT NULL DEFAULT TRUE"),
]


def ensure_schema(engine: Engine) -> None:
    """冪等補齊宣告清單中的缺欄位（在 create_all 之後呼叫）。"""
    inspector = inspect(engine)
    existing: dict[str, set[str]] = {}
    with engine.begin() as conn:
        for table, column, ddl_type in _COLUMNS:
            if table not in existing:
                existing[table] = {c["name"] for c in inspector.get_columns(table)}
            if column in existing[table]:
                continue
            conn.execute(
                text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}")
            )
            existing[table].add(column)
            logger.info("ensure_schema: added %s.%s %s", table, column, ddl_type)
