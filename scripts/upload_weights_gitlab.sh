#!/bin/bash
# 維運用：把 weights_manifest.txt 列出的權重上傳到實驗室自架 GitLab 的
# generic package registry（Deploy → Package Registry → weights/weights-v1）。
# 用法：GITLAB_TOKEN=<PAT> ./scripts/upload_weights_gitlab.sh   （token scope: api）
# 冪等：registry 已有同名且大小相符的資產會跳過；重跑只補缺的檔。
# 結尾會用「匿名」HEAD 驗證每個資產（證明新機器不帶 token 也抓得到）。
set -euo pipefail
: "${GITLAB_TOKEN:?請先 export GITLAB_TOKEN=<你的 GitLab PAT，scope 需含 api>}"

# registry 位置需與 download_weights.sh 的 GITLAB_WEIGHTS_URL 一致
GITLAB_API="${GITLAB_API:-https://ciot.imis.ncku.edu.tw:25388/api/v4}"
PROJECT_ID="${PROJECT_ID:-50}"
PACKAGE="${PACKAGE:-weights}"
VERSION="${VERSION:-weights-v1}"
BASE="$GITLAB_API/projects/$PROJECT_ID/packages/generic/$PACKAGE/$VERSION"
# 權重來源目錄與 manifest 都以腳本位置定位（不依賴執行時的 cwd）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENGINE_ROOT="${ENGINE_ROOT:-$SCRIPT_DIR/../algorithm/2D_and_3D_project}"
MANIFEST="${MANIFEST:-$SCRIPT_DIR/weights_manifest.txt}"

# 匿名 HEAD 資產，輸出「<http_code> <content-length>」（拿不到長度時為空）
head_asset() {
    curl -sI "$BASE/$1" \
        | tr -d '\r' \
        | awk 'NR==1{code=$2} tolower($1)=="content-length:"{len=$2} END{print code, len}'
}

# manifest 格式同 download_weights.sh：<資產名> <sha256> <bytes> <相對路徑>，檔尾需換行
grep -v '^#' "$MANIFEST" | while IFS=' ' read -r asset sha size target; do
    [ -n "$asset" ] || continue
    read -r code len <<< "$(head_asset "$asset")"
    if [ "${code:-}" = "200" ] && [ "${len:-}" = "$size" ]; then
        echo "已存在，跳過：$asset"
        continue
    fi
    src="$ENGINE_ROOT/$target"
    echo "上傳 $asset（$(du -h "$src" | cut -f1)）..."
    # --upload-file = PUT 串流上傳，大檔不吃記憶體；若 413 表示撞到
    # GitLab/nginx 上傳大小上限，需管理員調整後單獨重跑本腳本
    curl -fS --progress-bar -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
        --upload-file "$src" "$BASE/$asset" -o /dev/null
done

# 全部資產匿名驗證：HTTP 200 且 Content-Length 與 manifest 相符才算部署成功
echo "--- 匿名下載驗證 ---"
fail=0
while IFS=' ' read -r asset sha size target; do
    [ -n "$asset" ] || continue
    read -r code len <<< "$(head_asset "$asset")"
    if [ "${code:-}" = "200" ] && [ "${len:-}" = "$size" ]; then
        echo "OK   $asset"
    else
        echo "FAIL $asset（http=$code, len=${len:-?}, want=$size）" >&2
        fail=1
    fi
done < <(grep -v '^#' "$MANIFEST")
[ "$fail" -eq 0 ] && echo "完成：$BASE/<asset> 皆可匿名下載"
exit "$fail"
