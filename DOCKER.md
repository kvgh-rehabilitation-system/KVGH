# KVGH Docker 指令手冊

本專案所有 Docker 相關操作的完整參考。所有指令都在專案根目錄（`/data/KVGH`）執行。

服務一覽（`docker compose ps` 可看即時狀態）：

| 容器名 | 服務 | 說明 |
|---|---|---|
| `kvgh-frontend` | nginx 靜態站 + /api 反代 | 對外入口 <http://localhost:2000>（**port 2000 勿改**） |
| `kvgh-backend` | FastAPI (uvicorn:8000) | 程式碼打進 image、無 bind mount |
| `kvgh-postgres` | PostgreSQL 16 | 資料在 named volume `kvgh-pgdata`，主機 port 15432 |
| `kvgh-rabbitmq` | Celery broker | 管理介面 <http://localhost:15672>（僅本機） |
| `kvgh-worker-gpu` | Celery worker（gpu 佇列） | 演算法 2D/3D 萃取，需 nvidia-container-toolkit |
| `kvgh-worker-cpu` | Celery worker（cpu 佇列） | 轉檔、比對、標註存檔 |
| `kvgh-weights-init` | 一次性 init | 檢查/下載 ~1.5GB 模型權重，齊全時秒過 |

---

## 1. 日常啟動 / 停止

```bash
docker compose up -d              # 啟動全部服務（已 build 過的話秒級）
docker compose up -d --build      # 啟動前先 rebuild 有變動的 image（cache 齊全時整包約 2 秒）
docker compose ps                 # 看服務狀態與 port
docker compose down               # 停止並移除容器（DB 在 named volume，不會消失）
docker restart kvgh-backend       # 重啟單一容器
```

- `down` **不會**刪資料：PostgreSQL 在 `kvgh-pgdata` volume、影片產物在 `./media`（bind mount）
- 真要清空資料庫才用 `docker compose down -v`（**危險**：連 `kvgh-pgdata` 一起刪，media/ 不受影響）

## 2. Build（選擇性 rebuild）

```bash
docker compose build                    # 全部 image（沒改動時 ~2 秒，全 cache）
docker compose build frontend           # 只建前端（改前端後 2–3 分鐘：npm ci + tsc + vite）
docker compose build backend            # 只建後端（改 backend 後 ~1 分鐘內）
docker compose build worker-gpu         # 建共用 worker image（gpu/cpu 兩容器共用 kvgh-worker，只建這一個）
```

各服務何時需要 rebuild：

| 你改了什麼 | 需要 build 的服務 | 耗時 |
|---|---|---|
| `frontend/**` | frontend | 2–3 分鐘 |
| `backend/app/**` | backend **+ worker-gpu**（worker image 內含 backend models） | ~1 分鐘 |
| `backend/` 其他（requirements、Dockerfile） | backend | 依改動 |
| `worker/**`、`algorithm/requirements.txt` | worker-gpu | 只改程式碼秒級；**動 requirements = 30–60 分鐘真重建** |
| `algorithm/*.py`（含引擎目錄程式碼） | **免 build**（bind mount） | `docker restart kvgh-worker-gpu kvgh-worker-cpu` 即生效 |
| `docker-compose.yml` | 免 build | `docker compose up -d` 會自動重建受影響容器 |

⚠️ **Build 環境兩個關鍵設定**（已設好，這裡記錄原因）：

- 全域 buildx builder 必須是 `default`（`docker buildx ls` 確認 `default*` 有星號）。
  曾被切到 docker-container driver 的 `ci-builder`，導致全 cache hit 也要搬 11GB tarball、
  無改動 rebuild 花 12 分鐘。誤切回去時：`docker buildx use default`
- `.env` 內的 `COMPOSE_BAKE=false`：迴避 compose bake 完成後偶發 hang 不退出的問題

## 3. 快速熱修（不 rebuild 的迭代流程）

```bash
# backend 小改（程式碼在 image 內、無 bind mount）：cp 進容器 + 重啟
docker cp backend/app/services/xxx.py kvgh-backend:/app/app/services/xxx.py
docker restart kvgh-backend

# worker 程式碼小改：同樣 cp + 重啟
docker cp worker/tasks.py kvgh-worker-gpu:/app/worker/tasks.py
docker cp worker/tasks.py kvgh-worker-cpu:/app/worker/tasks.py
docker restart kvgh-worker-gpu kvgh-worker-cpu

# algorithm/ 腳本：bind mount，改完只要重啟 worker（連 cp 都不用）
docker restart kvgh-worker-gpu kvgh-worker-cpu

# 前端沒有熱修（nginx 服務的是 build 產物），一律 rebuild：
docker compose build frontend && docker compose up -d frontend
```

熱修是暫時的——**容器一重建就消失**，收尾記得乾淨 rebuild（`docker compose up -d --build`）。

## 4. 種子資料 / 資料庫

```bash
docker exec kvgh-backend python -m app.seed          # 只建帳號（admin01/doctor01-03/nurse01-03/patient01-20，密碼 1234）
docker exec kvgh-backend python -m app.seed --demo   # 帳號 + 假臨床資料（TODAY 相對日期，重跑永遠有今日資料）

# 直接進資料庫
docker exec -it kvgh-postgres psql -U kvgh -d kvgh
# 或從主機（port 15432）：psql -h localhost -p 15432 -U kvgh kvgh
```

## 5. 觀測 / 除錯

```bash
docker compose logs -f backend            # 追某服務 log（Ctrl+C 離開）
docker compose logs -f worker-gpu worker-cpu
docker logs --tail=100 kvgh-backend       # 只看最後 100 行

docker exec -it kvgh-backend bash         # 進容器 shell
docker exec kvgh-worker-gpu nvidia-smi    # 確認 worker 看得到 GPU

# Celery 佇列積壓（messages > 0 = 有任務排隊）
docker exec kvgh-rabbitmq rabbitmqctl list_queues name messages

# 服務健康快篩
curl -sf -o /dev/null http://localhost:2000/ && echo frontend OK
curl -sf -o /dev/null http://localhost:8000/docs && echo backend OK

docker compose config --quiet && echo compose OK   # compose 語法/變數展開驗證
```

## 6. 磁碟維護（主機常態 9 成滿，重要）

```bash
docker system df          # 總覽：image / build cache / volume 各佔多少、可回收多少
docker image prune -f     # ✅ 清 dangling image（安全，隨時可跑，rebuild 後的例行公事）
df -h /                   # 看根分割區
```

⚠️ **`docker buildx prune` 別隨手跑**：會清掉 build cache（~12GB），那是「整包 rebuild 只要
2 秒」的本體——清掉後下次 worker rebuild 退化回 30–60 分鐘。磁碟真的見底才用。

```bash
docker buildx du                          # 看 build cache 明細（要刪之前先看）
docker rmi kvgh-worker:<舊sha>            # 手動清特定舊版 SHA tag（CI 自動只留最近 3 個）
```

## 7. CI/CD 部署相關（詳見 README「CI/CD」與 `.gitlab-ci.yml`）

```bash
# 本機驗證「這次改動會觸發哪些 build」（dry-run，什麼都不會真的執行）
DRY_RUN=1 DEPLOY_DIR=/data/KVGH OLD_SHA=HEAD~1 TARGET_SHA=HEAD bash scripts/deploy_prod.sh

# 真實部署（僅供部署 checkout /data/kvgh-rehabilitation-system 使用；CI pipeline 會自動呼叫）
# ⚠️ 不要在開發目錄真跑：腳本會 git checkout -f 到目標 commit，把工作目錄切走
bash scripts/deploy_prod.sh   # 需 CI_COMMIT_SHA 或 TARGET_SHA；非 CI 手動跑會自動接 verify_deploy.sh

# 部署後驗證（CI 的 verify stage 跑這支；可單獨對任一 stack 驗證）
DEPLOY_DIR=/data/KVGH bash scripts/verify_deploy.sh
```

### 本機重現 CI 的 validate / lint / test job（與 pipeline 同一條指令）

```bash
# validate（組態快篩：compose 檔可解析、腳本語法正確）
docker compose -f docker-compose.yml config -q
docker compose -p kvgh-ci -f docker-compose.yml -f ci/compose.ci.yml config -q
bash -n scripts/*.sh

# lint（版本 pin 與 .gitlab-ci.yml 對齊：oxlint 同 frontend/package.json、ruff 同 RUFF_IMAGE）
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend:/app" -w /app node:24-alpine npx -y oxlint@1.71.0
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/io" -w /io ghcr.io/astral-sh/ruff:0.15.22 check backend worker --no-cache

# API 契約測試（隔離 stack kvgh-ci；demo seed 必須在 backend 啟動前，見 .gitlab-ci.yml 註解）
C="docker compose -p kvgh-ci -f docker-compose.yml -f ci/compose.ci.yml"
$C build backend && $C up -d --wait postgres rabbitmq
$C run --rm --entrypoint "python -m app.seed --demo" backend
$C up -d --wait backend && $C run --rm --build api-tests

# e2e 登入煙霧（Playwright image 版本必須與 frontend/e2e/package.json 同號）
$C up -d --build --wait postgres rabbitmq backend frontend
docker run --rm --network kvgh-ci_default --user "$(id -u):$(id -g)" -e HOME=/tmp -e PW_BASE_URL=http://frontend \
  -v "$PWD/frontend/e2e:/e2e" -w /e2e mcr.microsoft.com/playwright:v1.61.1-noble sh -c "npm ci && npx playwright test"

$C down -v --remove-orphans     # 收工必拆（CI job 的 after_script 也做同一件事）

# worker 契約測試（不需 GPU/權重/broker）
docker compose build worker-gpu
docker run --rm -v "$PWD/algorithm:/algorithm" -v "$PWD/worker/tests:/app/worker/tests:ro" \
  kvgh-worker python /app/worker/tests/check_task_contract.py
```

## 8. 從零重建（新機器 / 災難恢復）

```bash
git clone https://ciot.imis.ncku.edu.tw:25388/Jerry/kvgh_rehab.git KVGH && cd KVGH
# GitLab 不可用時改 clone 備份鏡像：https://github.com/kvgh-rehabilitation-system/KVGH.git
docker compose up -d --build
# 首次啟動 weights-init 自動下載 ~1.5GB 權重（sha256 驗證、冪等；
# 依 origin 優先抓 clone 來源那邊：GitLab package registry ↔ GitHub Release 互為備援）
# workers 會等權重齊全才啟動；除了 Docker + nvidia-container-toolkit 不需要任何額外安裝
```

搬既有資料才需要另外拷貝 `media/`（影片與分析產物）與 `kvgh-pgdata` volume。

## 9. 已知問題與對策速查

| 症狀 | 原因 | 對策 |
|---|---|---|
| rebuild 異常變慢（十幾分鐘起跳） | 全域 builder 被切走 或 build cache 被清 | `docker buildx use default`；cache 被清只能重養一次 |
| `compose build` 結束後卡住不退出 | bake 偶發 hang | `.env` 已設 `COMPOSE_BAKE=false`；仍遇到就 kill 後 `docker compose up -d`（image 已 tag 好） |
| worker-cpu 起不來：找不到 `kvgh-worker` | 共用 image 還沒 build 過 | `docker compose build worker-gpu`（或 `docker tag kvgh-worker-gpu kvgh-worker`） |
| worker 啟動即掛：CUDA / .so ImportError | image 的 torch 不是 cu126、或 python 版本不對 | 見 `worker/CLAUDE.md` 環境硬約束，勿改 Dockerfile 的版本組合 |
| 磁碟爆 | 舊 image 層堆積 | `docker image prune -f`；仍不夠再考慮 `docker rmi` 舊 SHA tag |
