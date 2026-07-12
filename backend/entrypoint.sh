#!/bin/sh
set -e

# 等待 PostgreSQL 可連線（compose healthcheck 之外的雙重保險）
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

# 首次啟動（或 DB 尚無資料）時自動建立種子資料；seed 內建防重複機制
python -m app.seed

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
