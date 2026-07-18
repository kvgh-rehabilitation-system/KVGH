#!/usr/bin/env bash
#
# KVGH 部署腳本 —— 由 .gitlab-ci.yml 的 deploy job 呼叫；也可在本機驗證邏輯：
#
#   DRY_RUN=1 DEPLOY_DIR=/data/KVGH OLD_SHA=<舊commit> TARGET_SHA=<新commit> \
#     bash scripts/deploy_prod.sh
#
# 核心：git diff 已部署SHA..目標SHA → 只 rebuild 有改到的服務（選擇性 rebuild）。
# algorithm/ 底下的腳本是 bind mount 進 worker 容器的，改了不必 rebuild
# 11GB 的 worker image，restart 容器即可。
#
# 環境變數：
#   DEPLOY_DIR     部署 checkout（預設 /data/kvgh-rehabilitation-system；本機測試可指開發目錄）
#   TARGET_SHA     目標 commit（CI 內自動取 $CI_COMMIT_SHA）
#   OLD_SHA        視為「已部署」的 commit（預設 DEPLOY_DIR 目前 HEAD）
#   DRY_RUN=1      只印出將執行的動作，不 fetch/checkout/build/up/restart
#   KEEP_SHA_TAGS  每個 image 保留的歷史 SHA tag 數（預設 3；磁碟緊繃勿調高）
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/data/kvgh-rehabilitation-system}"
TARGET_SHA="${TARGET_SHA:-${CI_COMMIT_SHA:-}}"
DRY_RUN="${DRY_RUN:-0}"
KEEP_SHA_TAGS="${KEEP_SHA_TAGS:-3}"
# 迴避 compose bake 完成後偶發 hang 不退出的已知問題（見 worker/CLAUDE.md）
export COMPOSE_BAKE=false
# 用 docker driver 的 default builder：直接在 daemon 內 build、無 tarball 搬運。
# 本機預設的 ci-builder（docker-container driver）就算全 cache hit，
# 也要把 11GB worker image 打包傳回 daemon，一次 rebuild 白耗 10 分鐘以上
export BUILDX_BUILDER=default

log() { echo "[deploy] $*"; }
# 實際執行前先印指令；DRY_RUN=1 時只印不跑
run() {
  if [[ "$DRY_RUN" == "1" ]]; then log "(dry-run) $*"; else log "+ $*"; "$@"; fi
}

[[ -n "$TARGET_SHA" ]] || { echo "缺 TARGET_SHA（CI 外執行請自行指定）" >&2; exit 1; }
cd "$DEPLOY_DIR"
[[ -f docker-compose.yml ]] || { echo "$DEPLOY_DIR 不是 KVGH checkout" >&2; exit 1; }

OLD_SHA="${OLD_SHA:-$(git rev-parse HEAD)}"

# ---- 1. 取得目標版本（dry-run 不動 working tree） ----
if [[ "$DRY_RUN" != "1" ]]; then
  run git fetch origin
  # detached checkout：部署目錄永遠等於某個明確 commit，回滾也走同一條路
  run git -c advice.detachedHead=false checkout -f "$TARGET_SHA"
fi
git cat-file -e "${TARGET_SHA}^{commit}" || { echo "本地找不到 commit $TARGET_SHA" >&2; exit 1; }
git cat-file -e "${OLD_SHA}^{commit}"    || { echo "本地找不到 commit $OLD_SHA" >&2; exit 1; }

log "已部署: $(git rev-parse --short "$OLD_SHA")  →  目標: $(git rev-parse --short "$TARGET_SHA")"

# ---- 2. diff → 動作對照 ----
BUILD_FRONTEND=0; BUILD_BACKEND=0; BUILD_WORKER=0; RESTART_WORKERS=0
while IFS= read -r f; do
  [[ -n "$f" ]] || continue
  case "$f" in
    frontend/*)     BUILD_FRONTEND=1 ;;
    # worker/Dockerfile 有 COPY backend/app（共用 SQLAlchemy models）→ 兩者都要
    backend/app/*)  BUILD_BACKEND=1; BUILD_WORKER=1 ;;
    backend/*)      BUILD_BACKEND=1 ;;
    worker/*|algorithm/requirements.txt|.dockerignore) BUILD_WORKER=1 ;;
    # 其餘 algorithm/（含引擎目錄）都是 bind mount：不 rebuild，restart 讓新程式生效
    algorithm/*)    RESTART_WORKERS=1 ;;
    # docker-compose.yml / scripts / docs 等：交給最後的 up -d 處理
    *)              : ;;
  esac
done < <(git diff --name-only "$OLD_SHA" "$TARGET_SHA")

SERVICES=()
(( BUILD_FRONTEND )) && SERVICES+=(frontend)
(( BUILD_BACKEND ))  && SERVICES+=(backend)
(( BUILD_WORKER ))   && SERVICES+=(worker-gpu)

# ---- 3. 選擇性 build + SHA tag（回滾對照用） ----
if (( ${#SERVICES[@]} )); then
  log "選擇性 rebuild：${SERVICES[*]}"
  run docker compose build "${SERVICES[@]}"
  SHORT_SHA=$(git rev-parse --short "$TARGET_SHA")
  (( BUILD_FRONTEND )) && run docker tag kvgh-frontend "kvgh-frontend:$SHORT_SHA"
  (( BUILD_BACKEND ))  && run docker tag kvgh-backend "kvgh-backend:$SHORT_SHA"
  (( BUILD_WORKER ))   && run docker tag kvgh-worker "kvgh-worker:$SHORT_SHA"
else
  log "無服務需要 rebuild"
fi

# ---- 4. 套用：up 只重建 image 有變的容器；純 algorithm 改動另外 restart ----
run docker compose up -d --remove-orphans
if (( RESTART_WORKERS )) && (( ! BUILD_WORKER )); then
  log "algorithm/ 有變（bind mount，免 rebuild）→ restart workers"
  # 用 compose restart（跟著當前 project 走），不能寫死容器名——
  # 部署 checkout 可能以 override 改名跑並行 stack（如 kvgh-worker-gpu-prod）
  run docker compose restart worker-gpu worker-cpu
fi

if [[ "$DRY_RUN" == "1" ]]; then
  log "(dry-run) 略過煙霧測試與清理，結束"
  exit 0
fi

# ---- 5. 煙霧測試（失敗讓 job 標紅，GitLab Environments 頁可對舊部署 re-deploy 回滾） ----
env_port() { # 讀 DEPLOY_DIR/.env 的 port 覆寫，沒有就用預設
  local v=""
  [[ -f .env ]] && v=$(grep -E "^$1=" .env | tail -1 | cut -d= -f2 | tr -d ' ')
  echo "${v:-$2}"
}
smoke() {
  local name=$1 url=$2
  for _ in $(seq 1 10); do
    curl -sf -o /dev/null "$url" && { log "煙霧測試 OK：$name（$url）"; return 0; }
    sleep 3
  done
  echo "[deploy] 煙霧測試失敗：$name（$url）" >&2
  return 1
}
BACKEND_URL="http://localhost:$(env_port BACKEND_PORT 8000)"
smoke frontend "http://localhost:$(env_port FRONTEND_PORT 2000)/"
smoke backend  "$BACKEND_URL/docs"
smoke health   "$BACKEND_URL/api/health"

# 真實登入 + token 驗證：驗 DB / seed / JWT 全鏈路（不只是 API 活著）
login_smoke() {
  local resp token
  for _ in $(seq 1 10); do
    resp=$(curl -sf -H 'Content-Type: application/json' \
      -d '{"username":"admin01","password":"1234"}' \
      "$BACKEND_URL/api/auth/login" 2>/dev/null) || { sleep 3; continue; }
    token=$(printf '%s' "$resp" | sed -n 's/.*"access_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    if [[ -n "$token" ]] && curl -sf -o /dev/null -H "Authorization: Bearer $token" "$BACKEND_URL/api/auth/me"; then
      log "煙霧測試 OK：login + auth/me"
      return 0
    fi
    sleep 3
  done
  echo "[deploy] 煙霧測試失敗：login + auth/me" >&2
  return 1
}
login_smoke

# Celery workers 存活：inspect ping 經 broker 回收所有 worker 的 pong。
# compose exec 跟著當前 project 走，自動命中本部署 stack 的容器（含 override 改名）
celery_smoke() {
  for _ in $(seq 1 10); do
    if docker compose exec -T worker-cpu \
         celery -A worker.celery_app inspect ping --timeout 10 2>/dev/null | grep -q pong; then
      log "煙霧測試 OK：celery workers"
      return 0
    fi
    sleep 6 # workers 依賴 weights-init 成功，冷啟（首次下載權重）可能較慢
  done
  echo "[deploy] 煙霧測試失敗：celery inspect ping" >&2
  return 1
}
celery_smoke

# ---- 6. 磁碟維護：清 dangling layer；每個 image 只留最近 KEEP_SHA_TAGS 個 SHA tag ----
run docker image prune -f
for repo in kvgh-frontend kvgh-backend kvgh-worker; do
  docker images --format '{{.Repository}}:{{.Tag}}' "$repo" \
    | grep -v ':latest$' \
    | tail -n +$((KEEP_SHA_TAGS + 1)) \
    | xargs -r docker rmi >/dev/null 2>&1 || true
done

log "部署完成：$(git rev-parse --short "$TARGET_SHA")"
