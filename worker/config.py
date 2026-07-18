"""Worker 設定（全部由環境變數提供，見 docker-compose.yml 與 .env.example）。"""

import os
from pathlib import Path

CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "amqp://kvgh:change-me-mq@localhost:5672//")
DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+psycopg://kvgh:change-me-pg@localhost:5432/kvgh"
)

# 媒體根目錄（與 backend 共掛同一個 bind mount）
MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", "/data/media"))

# git 追蹤的演算法腳本目錄（get_2D_3D_script.py / humanpose_api.py / make_vid_json_api.py）
ALGORITHM_DIR = Path(os.environ.get("ALGORITHM_DIR", "/algorithm"))
# 含權重與已編譯 .so 的演算法引擎（AlphaPose-master / MotionBERT-main）
ENGINE_DIR = Path(os.environ.get("ENGINE_DIR", "/engine/2D_and_3D_project"))

ALPHAPOSE_SCRIPT = ENGINE_DIR / "AlphaPose-master" / "demo_inference.py"
MOTIONBERT_SCRIPT = ENGINE_DIR / "MotionBERT-main" / "infer_wild.py"

# GPU 任務啟動前要求的最低剩餘 VRAM（MB），防止與他人共用 GPU 時 OOM
GPU_MIN_FREE_VRAM_MB = int(os.environ.get("GPU_MIN_FREE_VRAM_MB", "3000"))

# humanpose 比對 subprocess 逾時（秒）
COMPARISON_TIMEOUT_SECONDS = int(os.environ.get("COMPARISON_TIMEOUT_SECONDS", "1800"))
# 2D/3D 萃取 subprocess 逾時（秒）
EXTRACTION_TIMEOUT_SECONDS = int(os.environ.get("EXTRACTION_TIMEOUT_SECONDS", "3600"))
