#!/bin/sh
# backend 容器啟動序：等 DB → 跑 seed（冪等）→ 啟動 uvicorn。
# 資料表建立不在這裡：app.main 的 create_app() 會跑 create_all + ensure_schema。
set -e

# 等待 PostgreSQL 可連線（compose healthcheck 之外的雙重保險：
# healthcheck 只保證 pg_isready 過，不保證從本容器可完成 SQL 往返）
python - <<'PY'
import time
import sys
from sqlalchemy import create_engine, text
from app.core.config import settings

for attempt in range(30):
    try:
        engine = create_engine(settings.DATABASE_URL)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        sys.exit(0)
    except Exception as exc:
        print(f"waiting for database ({attempt + 1}/30): {exc}", flush=True)
        time.sleep(2)
sys.exit("database not reachable")
PY

# 首次啟動（或 DB 尚無資料）時自動建立種子帳號；seed 內建防重複機制。
# 注意：預設只建帳號，假臨床資料要手動跑 python -m app.seed --demo
python -m app.seed

# exec 讓 uvicorn 取代 shell 成為 PID 1，才能正確收到 docker stop 的 SIGTERM
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
