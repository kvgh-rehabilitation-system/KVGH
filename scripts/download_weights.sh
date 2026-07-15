#!/bin/sh
# KVGH 模型權重下載器（冪等）：檢查 weights_manifest.txt 列出的權重，
# 缺少或大小不符才從 GitHub Release 下載（tmp + mv 原子落地，sha256 驗證）。
# 由 docker-compose 的 weights-init 服務於每次啟動執行；權重齊全時秒過。
# POSIX sh，可在 curlimages/curl（busybox）內執行。
#
# manifest 格式：每行「<release資產名> <sha256> <bytes> <相對ENGINE_ROOT路徑>」，
# 以 '#' 開頭為註解。注意：檔尾必須有換行，否則最後一行會被 read 迴圈略過。
set -eu

BASE_URL="${WEIGHTS_BASE_URL:-https://github.com/kvgh-rehabilitation-system/KVGH/releases/download/weights-v1}"
ENGINE_ROOT="${ENGINE_ROOT:-/engine/2D_and_3D_project}"
MANIFEST="${MANIFEST:-$(dirname "$0")/weights_manifest.txt}"

fail=0
while IFS=' ' read -r asset sha size target; do
    # 跳過空行與註解
    [ -n "$asset" ] || continue
    case "$asset" in '#'*) continue ;; esac

    dest="$ENGINE_ROOT/$target"
    # 既有檔只驗大小不驗 sha256：1.5GB 全部重算雜湊會拖慢每次 compose up，
    # sha256 只在新下載時驗（下方），足以擋掉下載截斷/損毀
    if [ -f "$dest" ] && [ "$(wc -c < "$dest")" -eq "$size" ]; then
        echo "[weights] OK        $target"
        continue
    fi

    echo "[weights] download  $asset  ->  $target"
    mkdir -p "$(dirname "$dest")"
    # 先落 .part 再 mv：避免下載中斷留下「大小剛好但內容殘缺」的檔案
    # 被下次啟動的大小檢查誤判為完好
    tmp="$dest.part"
    curl -fSL --retry 3 --retry-delay 5 -o "$tmp" "$BASE_URL/$asset"

    actual="$(sha256sum "$tmp" | cut -d' ' -f1)"
    if [ "$actual" != "$sha" ]; then
        echo "[weights] ERROR: $asset sha256 不符（got $actual, want $sha）" >&2
        rm -f "$tmp"
        fail=1
        continue
    fi
    mv "$tmp" "$dest"
    echo "[weights] done      $target"
done < "$MANIFEST"

if [ "$fail" -ne 0 ]; then
    echo "[weights] 有權重下載失敗，workers 不會啟動；修復後重跑 docker compose up -d" >&2
fi
exit "$fail"
