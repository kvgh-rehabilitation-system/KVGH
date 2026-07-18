#!/usr/bin/env bash
#
# KVGH 部署後驗證（verify stage）—— 對「已部署的運行中環境」跑煙霧測試。
#
# 由 .gitlab-ci.yml 的 verify job 呼叫；手動（非 CI）執行 deploy_prod.sh 時
# 會自動接著執行本腳本。也可單獨驗任一 stack：
#
#   DEPLOY_DIR=/data/KVGH bash scripts/verify_deploy.sh
#
# 驗證項目（任一失敗 exit 非 0 → verify job 紅燈；
# GitLab Operate→Environments 對舊部署 re-deploy 即回滾）：
#   1. frontend 首頁 HTTP 存活
#   2. backend /docs 與 /api/health
#   3. 真實登入 + auth/me（驗 DB / seed / JWT 全鏈路，不只是 API 活著）
#   4. celery inspect ping（驗 workers 經 broker 存活）
#
# 環境變數：
#   DEPLOY_DIR  要驗證的 checkout（預設 /data/kvgh-rehabilitation-system；
#               port 從該目錄的 .env 讀，沒有就用預設值）
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/data/kvgh-rehabilitation-system}"

step() { echo "--- $* ..."; }

# banner 集中在本腳本：CI 的 verify job 與手動執行看到同一份
cat <<'EOF'
=========================================
Verify：部署後煙霧測試
=========================================
本階段會驗證以下內容：
[1/4] HTTP 存活 (frontend / backend)
驗證摘要：
- frontend 首頁、backend /docs 與 /api/health 都要回 2xx
[2/4] 真實登入 + token 驗證 (/api/auth/login → /api/auth/me)
驗證摘要：
- 驗 DB / seed / JWT 全鏈路，不只是 API 活著
[3/4] Celery workers 存活 (celery inspect ping)
驗證摘要：
- 經 broker 回收所有 worker 的 pong
[4/4] 容器狀態總覽 (docker compose ps)
驗證摘要：
- 不擋紅燈，僅供 log 佐證
[失敗代表]
部署上去的版本在真實環境壞了——
GitLab Operate→Environments 對舊部署 re-deploy 即回滾
[執行方式]
[1/4] 煙霧測試 frontend 首頁、backend /docs 與 /api/health
[2/4] login + auth/me 全鏈路
[3/4] celery inspect ping
[4/4] docker compose ps
=========================================
EOF

cd "$DEPLOY_DIR"
[[ -f docker-compose.yml ]] || { echo "✗ $DEPLOY_DIR 不是 KVGH checkout" >&2; exit 1; }

echo "驗證目標：$DEPLOY_DIR（版本 $(git rev-parse --short HEAD 2>/dev/null || echo '?')）"

env_port() { # 讀 DEPLOY_DIR/.env 的 port 覆寫，沒有就用預設
  local v=""
  [[ -f .env ]] && v=$(grep -E "^$1=" .env | tail -1 | cut -d= -f2 | tr -d ' ')
  echo "${v:-$2}"
}
smoke() {
  local name=$1 url=$2
  for _ in $(seq 1 10); do
    curl -sf -o /dev/null "$url" && { echo "✓ $name（$url）"; return 0; }
    sleep 3
  done
  echo "✗ 煙霧測試失敗：$name（$url）" >&2
  return 1
}
BACKEND_URL="http://localhost:$(env_port BACKEND_PORT 8000)"

step "[1/4] HTTP 存活——frontend 首頁、backend /docs 與 /api/health 都要回 2xx"
smoke frontend "http://localhost:$(env_port FRONTEND_PORT 2000)/"
smoke backend  "$BACKEND_URL/docs"
smoke health   "$BACKEND_URL/api/health"
echo "✓ 通過"

step "[2/4] 真實登入 + token 驗證——驗 DB / seed / JWT 全鏈路（不只是 API 活著）"
login_smoke() {
  local resp token
  for _ in $(seq 1 10); do
    resp=$(curl -sf -H 'Content-Type: application/json' \
      -d '{"username":"admin01","password":"1234"}' \
      "$BACKEND_URL/api/auth/login" 2>/dev/null) || { sleep 3; continue; }
    token=$(printf '%s' "$resp" | sed -n 's/.*"access_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    if [[ -n "$token" ]] && curl -sf -o /dev/null -H "Authorization: Bearer $token" "$BACKEND_URL/api/auth/me"; then
      echo "✓ login + auth/me"
      return 0
    fi
    sleep 3
  done
  echo "✗ 煙霧測試失敗：login + auth/me" >&2
  return 1
}
login_smoke
echo "✓ 通過"

step "[3/4] Celery workers 存活——inspect ping 經 broker 回收所有 worker 的 pong"
# compose exec 跟著當前 project 走，自動命中本部署 stack 的容器（含 override 改名）
celery_smoke() {
  local out
  for _ in $(seq 1 10); do
    # 先收完整輸出再 grep：直接 pipe 給 grep -q 會在比中後提早關管線，
    # docker compose exec 收到 EPIPE 回 255，pipefail 下整條被誤判失敗
    if out=$(docker compose exec -T worker-cpu \
         celery -A worker.celery_app inspect ping --timeout 10 2>/dev/null) \
       && grep -q pong <<<"$out"; then
      echo "✓ celery workers"
      return 0
    fi
    sleep 6 # workers 依賴 weights-init 成功，冷啟（首次下載權重）可能較慢
  done
  echo "✗ 煙霧測試失敗：celery inspect ping" >&2
  return 1
}
celery_smoke
echo "✓ 通過"

step "[4/4] 容器狀態總覽——不擋紅燈，僅供 log 佐證"
docker compose ps || true
echo "✓ 通過"

echo "=== Verify 全部通過 ==="
