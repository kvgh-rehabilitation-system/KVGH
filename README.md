# KVGH 高榮智慧復健系統系統

高雄榮總復健科系統原型：醫生端、護理師端、病患端三種角色，
React + FastAPI + PostgreSQL + Celery/RabbitMQ + GPU 演算法 worker。

## 新機器部署（git clone → docker up 即用）

```bash
# 主倉庫（實驗室自架 GitLab）；GitHub 為備份鏡像，clone 哪個都可以
git clone https://ciot.imis.ncku.edu.tw:25388/Jerry/kvgh_rehab.git KVGH
# 或 git clone https://github.com/kvgh-rehabilitation-system/KVGH.git
cd KVGH
docker compose up -d --build
```

- 首次啟動時 `weights-init` 服務會自動下載 ~1.5GB 模型權重到
  `algorithm/2D_and_3D_project/`（sha256 驗證、冪等，之後每次啟動秒過），
  workers 會等權重齊全才啟動——**除了裝好
  Docker + nvidia-container-toolkit，不需要在專案資料夾外做任何事**
- 權重有兩個內容相同的來源：GitLab package registry（Deploy → Package
  Registry → `weights/weights-v1`）與
  [GitHub Release `weights-v1`](https://github.com/kvgh-rehabilitation-system/KVGH/releases/tag/weights-v1)。
  `download_weights.sh` 依 `.git/config` 的 origin 自動優先抓 clone 的那邊，
  失敗自動落到另一邊
- `.env` 可省略（compose 全有預設值）；正式環境才 `cp .env.example .env` 改密碼

### 倉庫分工

| 倉庫 | 角色 |
|---|---|
| GitLab `Jerry/kvgh_rehab`（自架） | 主開發 + CI/CD + 權重 registry |
| GitHub `kvgh-rehabilitation-system/KVGH` | 備份鏡像 + 權重備援（Release `weights-v1`） |

GitLab `main` 有新 commit 後手動備份：`git push github main`。
權重更新流程：改 `scripts/weights_manifest.txt` 後跑
`GITLAB_TOKEN=<PAT> ./scripts/upload_weights_gitlab.sh` 與
`GITHUB_TOKEN=<PAT> ./scripts/upload_weights_release.sh` 各上傳一份。

> 📘 所有 Docker 操作（build/熱修/seed/除錯/磁碟維護/疑難排解）完整參考：[DOCKER.md](DOCKER.md)

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
  `ENGINE_DIR` 預設指向它。程式碼與 .so 都在 git 裡；大權重（~1.5GB）
  首次啟動自動下載（`scripts/download_weights.sh`，GitLab registry 與
  GitHub Release 互為備援）。
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

## CI/CD（GitLab，實驗室自架）

Pipeline 定義在根目錄 [.gitlab-ci.yml](.gitlab-ci.yml)，部署邏輯在
[scripts/deploy_prod.sh](scripts/deploy_prod.sh)（可本機 `DRY_RUN=1` 測試）。

### 升版流程

```
feature branch ──MR──> main（CI 驗證綠）──促版──> prod（CI 重驗 → 自動部署）
                                          git push origin main:prod
```

### 驗證層次（check → build → test → deploy → verify）

五階段收斂同性質 job，同 stage 平行跑；每個 job 的 CI log 開頭都會印出
「這一步在驗什麼、失敗代表什麼」的說明。測試策略：**只驗大功能/穩定契約**
（登入、角色權限、頁面存活、HTTP 狀態碼、task 名稱契約），不驗實作細節——
開發中改功能不需要跟著改測試；測試紅燈 = 大功能真的壞了。

| Stage | Job | 驗什麼 |
|---|---|---|
| check | `preflight-validate` | 組態快篩：compose 檔（主檔+CI override）可解析、`scripts/*.sh` 語法（秒級、不起容器） |
| check | `frontend-lint` / `python-lint` | oxlint；ruff check+format（backend/worker，algorithm 排除） |
| build | `*-build` | docker build 即建置驗證（前端含 tsc），同時預熱 layer cache |
| test | `backend-unit-tests` | 幀映射純函式數學、狀態優先序/門檻、golden 契約（VERSION/OUTPUT_FPS/HOLD_FRAMES 釘住 + `display_status` 值域） |
| test | `frontend-unit-tests` | vitest：utils 純函式 + golden 值域（雙寫契約另一端）+ Testing Library 元件（登入表單、StatusBadge、審核表單、病患上傳、計畫調整表單） |
| test | `worker-contract-test` | worker image 內驗 `import worker.tasks` + backend 發送的 4 個任務名稱都有註冊（不起 stack；`algorithm/**/*.py` 改動也觸發——import 期就載入） |
| test | `backend-api-tests` | 起隔離 CI stack，API 契約：health、四角色登入、角色越權 403、物件層授權（病患跨人 404/醫護代審代調契約）、寫入路徑（審核/計畫調整/帳號 CRUD 軟刪除降級）、媒體 `?token=` 與 Range/206、openapi 關鍵路由釘住 |
| test | `worker-integration` | 起 rabbitmq + postgres + worker-cpu（`--no-deps`，不碰 GPU/權重）：celery ping + 任務註冊 + transcode 任務真執行（broker→worker→ffmpeg→media→DB，成功+失敗路徑） |
| test | `e2e-core-flows` | Playwright：四角色登入+主要頁巡檢、護理師審核頁降級模式、醫師調整計畫寫入路徑、病患上傳影片、審核回饋閉環（backend 改動也觸發） |
| test | `algorithm-golden-pipeline` | **手動觸發**（真 GPU+權重，改 `humanpose_api.py`/引擎時點）：golden 影片全管線，斷言 6 檔產物與四分數值域 |
| deploy | `deploy-prod` | 只部署：git diff 選擇性 rebuild + compose up（[scripts/deploy_prod.sh](scripts/deploy_prod.sh)） |
| verify | `verify-prod` | 部署後對真實環境煙霧測試：frontend、/docs、/api/health、真實登入+auth/me、celery inspect ping（[scripts/verify_deploy.sh](scripts/verify_deploy.sh)） |

#### 八類測試 → job 對照（測試金字塔）

| 測試類別 | 落點 |
|---|---|
| Unit | `backend-unit-tests`＋`frontend-unit-tests` |
| Component | `frontend-unit-tests` 內的 Testing Library 元件測試 |
| Integration | `backend-api-tests`（API↔DB）＋`worker-integration`（Worker↔MQ） |
| Contract | `worker-contract-test`＋[ci/contracts](ci/contracts) golden 值域雙端測試＋`test_openapi.py` |
| API | `backend-api-tests` |
| E2E | `e2e-core-flows` |
| Smoke | e2e 登入 spec＋verify stage 的 `verify_deploy.sh` |
| Regression | golden fixture 測試＋手動 Run pipeline 全量重跑（rules:changes 不比對） |

雙寫契約 golden：[ci/contracts/submission_status.json](ci/contracts/submission_status.json)
是 `display_status` 值域的單一來源，後端 pytest 與前端 vitest 各自斷言一致——
改值域必須同步後端 `common.py`、前端 `submissionStatus.ts` 與 golden。

需要 stack 的三個測試 job（api/worker/e2e）跑在**隔離 CI stack**（project
`kvgh-ci`，見 [ci/compose.ci.yml](ci/compose.ci.yml)）：容器名 `-ci` 後綴、
image `:ci` tag、不發布任何 host port，與 dev(:2000)/prod(:2222) 完全互不
干擾；同 stage 平行排程下靠 `resource_group: ci-test-stack` 輪流獨占全新
stack，job 前後都 `down -v` 清乾淨。本機重現各 job 指令見 DOCKER.md 第 7 節。

手動（非 CI）執行 `deploy_prod.sh` 時會自動接著跑 `verify_deploy.sh`，
行為與拆分前相同；也可單獨驗任一 stack：
`DEPLOY_DIR=/data/KVGH bash scripts/verify_deploy.sh`。

- **選擇性 rebuild**：只 build 有改到的服務。改前端只建 frontend；改
  `backend/app` 連帶建 worker（其 image 內含 backend models，但 pip layer
  有 cache，秒級）；**改 `algorithm/*.py` 完全不 rebuild**（bind mount），
  只 restart 兩個 worker
- **回滾**：GitLab → Operate → Environments → production → 對舊部署按
  re-deploy（layer cache 使其秒級完成）

### 首次接上 GitLab 的設定（之後階段）

1. 實驗室 GitLab 建 project、push 本 repo，並執行
   `GITLAB_TOKEN=<PAT> ./scripts/upload_weights_gitlab.sh` 把權重上傳到
   GitLab package registry（GitHub repo 保留作備份鏡像與權重備援來源）
2. Protected branches：`main`（需 MR + pipeline 綠才可合併）、`prod`
   （僅 Maintainer 可 push）
3. 本機安裝並註冊 gitlab-runner：shell executor、tag `kvgh_prod`、勾
   「protected branches only」；執行 job 的使用者需在 `docker` group
   （本機 service 以 `ciot` 執行，已具權限）
4. 初始化部署 checkout：`git clone <gitlab-url> /data/kvgh-rehabilitation-system`。
   **現階段為並行驗證模式**：開發目錄 `/data/KVGH` 繼續服務 :2000；部署
   checkout 放未追蹤的 `docker-compose.override.yml`（`name: kvgh-prod`＋
   各服務 `container_name` 加 `-prod` 後綴）與自己的 `.env`
   （`FRONTEND_PORT=2222`、其餘 port 錯開、`ENGINE_DIR` 指
   `/data/KVGH/algorithm/2D_and_3D_project` 共用權重、MEDIA_DIR 不設＝
   用自己的空 media），跑完全隔離的 stack（含獨立空 DB），驗證完
   `docker compose down` 關閉。**未來轉正**：刪 override 檔、`.env` 改回
   預設 port 並設 `MEDIA_DIR=/data/KVGH/media` 及正式密碼；一次性遷移：
   開發目錄 `docker compose down` 後改由部署 checkout `up -d`
   （compose `name: kvgh` 寫死，容器與 volume 名不變，資料不搬家）
5. worker 改共用 image 名 `kvgh-worker` 後，首次 build 前先跑一次
   `docker tag kvgh-worker-gpu kvgh-worker`（或 `docker compose build worker-gpu`），
   否則 worker-cpu 找不到 image；下次 `docker compose up -d` 讓容器切換到
   共用 image 後，`docker rmi kvgh-worker-gpu kvgh-worker-cpu` 可回收舊名
   image 佔用的磁碟（本機約 11GB）

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
