#!/bin/bash
# 維運用：建立 GitHub Release（預設 weights-v1）並上傳 weights_manifest.txt 列出的權重資產。
# 用法：GITHUB_TOKEN=<PAT> ./scripts/upload_weights_release.sh
# 注意：main 必須已推上 GitHub（建 tag 需要 commit）；已上傳過的資產會自動跳過。
set -euo pipefail
: "${GITHUB_TOKEN:?請先 export GITHUB_TOKEN=<你的 PAT，需 repo Contents 寫入權限>}"

REPO="${REPO:-kvgh-rehabilitation-system/KVGH}"
TAG="${TAG:-weights-v1}"
API="https://api.github.com/repos/$REPO"
AUTH=(-H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json")
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENGINE_ROOT="${ENGINE_ROOT:-$SCRIPT_DIR/../algorithm/2D_and_3D_project}"
MANIFEST="${MANIFEST:-$SCRIPT_DIR/weights_manifest.txt}"

# 取得 release；不存在則建立（tag 會指向預設分支 HEAD）
release_json="$(curl -sS "${AUTH[@]}" "$API/releases/tags/$TAG")"
release_id="$(printf '%s' "$release_json" | python3 -c 'import json,sys
d=json.load(sys.stdin); print(d.get("id",""))')"
if [ -z "$release_id" ]; then
    echo "建立 release $TAG ..."
    release_json="$(curl -fsS "${AUTH[@]}" -X POST "$API/releases" -d "{
        \"tag_name\": \"$TAG\",
        \"name\": \"模型權重 $TAG\",
        \"body\": \"AlphaPose/MotionBERT 模型權重（共 ~1.5GB）。首次 docker compose up 時由 weights-init 服務（scripts/download_weights.sh）自動下載，一般不需手動抓。\"
    }")"
    release_id="$(printf '%s' "$release_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"
fi
existing_assets="$(curl -fsS "${AUTH[@]}" "$API/releases/$release_id/assets?per_page=100" \
    | python3 -c 'import json,sys; print("\n".join(a["name"] for a in json.load(sys.stdin)))')"
echo "release id: $release_id"

grep -v '^#' "$MANIFEST" | while IFS=' ' read -r asset sha size target; do
    [ -n "$asset" ] || continue
    if printf '%s\n' "$existing_assets" | grep -qx "$asset"; then
        echo "已存在，跳過：$asset"
        continue
    fi
    src="$ENGINE_ROOT/$target"
    echo "上傳 $asset（$(du -h "$src" | cut -f1)）..."
    curl -fS --progress-bar "${AUTH[@]}" -H "Content-Type: application/octet-stream" \
        --data-binary @"$src" \
        "https://uploads.github.com/repos/$REPO/releases/$release_id/assets?name=$asset" \
        -o /dev/null
done
echo "完成：https://github.com/$REPO/releases/tag/$TAG"
