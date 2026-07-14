# KVGH 高榮智慧復健系統系統

高雄榮總復健科系統原型：醫生端、護理師端、病患端三種角色，
React + FastAPI + PostgreSQL + Celery/RabbitMQ + GPU 演算法 worker。

## 新機器部署（git clone → docker up 即用）

```bash
git clone https://github.com/kvgh-rehabilitation-system/KVGH.git
cd KVGH
docker compose up -d --build
```

- 首次啟動時 `weights-init` 服務會自動從本 repo 的
  [GitHub Release `weights-v1`](https://github.com/kvgh-rehabilitation-system/KVGH/releases/tag/weights-v1)
  下載 ~1.5GB 模型權重到 `algorithm/2D_and_3D_project/`（sha256 驗證、冪等，
  之後每次啟動秒過），workers 會等權重齊全才啟動——**除了裝好
  Docker + nvidia-container-toolkit，不需要在專案資料夾外做任何事**
- `.env` 可省略（compose 全有預設值）；正式環境才 `cp .env.example .env` 改密碼

## 快速啟動（Docker）

```bash
cp .env.example .env   # 修改密碼等設定（可省略，全有預設值）
docker compose up -d --build
```

- 前端：<http://localhost:2000>
- RabbitMQ 管理介面：<http://localhost:15672>
- 後端直連（遠端開發用）：<http://localhost:8000>
- 主機 port 皆可在 `.env` 調整（`FRONTEND_PORT` / `BACKEND_PORT` /
  `POSTGRES_HOST_PORT` / `RABBITMQ_HOST_PORT` / `RABBITMQ_MGMT_PORT`），
  未設定則用上列預設值
- 首次啟動自動建立種子資料（PostgreSQL 存於 named volume `kvgh-pgdata`）
- GPU worker 需要 nvidia-container-toolkit；演算法引擎（AlphaPose/MotionBERT
  程式碼 + 編譯 .so）內含於 `algorithm/2D_and_3D_project/`，`.env` 的
  `ENGINE_DIR` 預設指向它。程式碼與 .so 都在 git 裡；大權重（~1.5GB）由
  GitHub Release `weights-v1` 首次啟動自動下載（`scripts/download_weights.sh`）。
  `media/`（影片與分析產物）不進 git，搬既有資料才需要另外拷貝

## 影片分析流程

```
導師影片：護理師上傳 → [cpu] 轉檔(faststart mp4) → [gpu] 2D/3D 萃取
        → 護理師網頁標註重點動作幀 → [cpu] 產生演算法標註 JSON
病患影片：病患上傳 → [cpu] 轉檔 → [gpu] 2D/3D 萃取
        → [cpu] humanpose 比對（DTW + cosine）→ AnalysisResult 真分數
        → 儀表板 / 分數趨勢 / 3D 動作重播 / 比對視覺化影片
```

影片與演算法產物永久存放於 `media/`（僅使用者主動刪除才移除），
播放一律走 HTTP Range 串流（faststart mp4，邊播邊緩衝）。
GPU 併發受 `GPU_MAX_CONCURRENCY` 與 VRAM 守門雙層保護，詳見 [worker/README.md](worker/README.md)。

## 測試帳號（密碼一律 `1234`）

| 角色 | 帳號 | 姓名 |
|---|---|---|
| 醫生 | `doctor01` / `doctor02` / `doctor03` | 王志遠 / 陳怡蓁 / 李承翰 |
| 護理師 | `nurse01` / `nurse02` / `nurse03` | 林佳穎 / 張淑婷 / 黃詩涵 |
| 病患 | `patient01` ～ `patient20` | 20 位多情境病患 |

種子資料涵蓋：全新病患、逾期未回診、多次看診、進行中/待評估/已結案計畫、
計畫版本調整、影片分析分數趨勢、護理師審核佇列與醫生回報處理等情境。

## 本機開發

```bash
# Backend（http://localhost:8000）
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m app.seed        # 建立種子資料
.venv/bin/uvicorn app.main:app --reload

# Frontend（http://localhost:5173，/api 由 Vite proxy 至 8000）
cd frontend
npm install
npm run dev

# 前端在別台機器開發（如 Mac）、後端跑在本專案的 Docker 上：
# /api proxy 改指到這台機器（port = .env 的 BACKEND_PORT，預設 8000）
VITE_API_TARGET=http://<server-ip>:8000 npm run dev
```

## 架構

```
backend/app/
├── core/       # 設定（pydantic-settings）、JWT 與密碼雜湊
├── db/         # SQLAlchemy engine / session / Base
├── models/     # ORM models（一領域一模組）
├── schemas/    # Pydantic schemas
├── services/   # 商業邏輯層（router 不直接查詢）
├── api/        # deps（角色守衛）與 routers（auth / doctor / nurse / patient）
└── seed.py     # 種子資料

frontend/src/
├── api/        # axios client + 各角色 API
├── types/      # 共用 TS 型別
├── components/ # 共用 UI（動畫、分數/完成率圖表、3D 動作重播）
├── features/   # doctor / nurse / patient 各自的頁面與元件
├── layouts/    # 角色 Sidebar Layout
├── routes/     # 角色守衛
└── contexts/   # AuthContext
```

## 切換 PostgreSQL

於 `docker-compose.yml` 新增 `postgres` service，
並將 backend 的 `DATABASE_URL` 改為
`postgresql+psycopg://user:pass@postgres:5432/kvgh`（需在 requirements 加入 `psycopg[binary]`）。
